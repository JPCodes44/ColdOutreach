import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { requireOperator } from './operator';
import {
  checkDraftForApproval,
  asLetterContent,
  claimsAcknowledged,
  evidenceCorpus,
  validateOutreachContent,
} from '@emailstrat/common';
import { loadCurrentSettings } from './settings';
import { hasActiveSends } from './send';
import {
  analysisValidator,
  evidenceValidator,
  outreachContentValidator,
  runStageValidator,
} from './schema';

/** Runs still "running" after this long are treated as abandoned. */
export const STALE_RUN_MS = 10 * 60 * 1000;

export type DraftState =
  | 'none'
  | 'running'
  | 'ready'
  | 'approved'
  | 'failed'
  | 'legacy';

async function companyByExternalId(ctx: QueryCtx, companyId: string) {
  return ctx.db
    .query('companies')
    .withIndex('by_externalId', (q) => q.eq('externalId', companyId))
    .unique();
}

export async function latestRun(ctx: QueryCtx, companyId: string) {
  return ctx.db
    .query('pipelineRuns')
    .withIndex('by_company', (q) => q.eq('companyId', companyId))
    .order('desc')
    .first();
}

export async function draftForCompany(ctx: QueryCtx, companyId: string) {
  const draft = await ctx.db
    .query('outreachDrafts')
    .withIndex('by_company', (q) => q.eq('companyId', companyId))
    .unique();
  if (draft === null) return null;
  const run = await ctx.db.get(draft.runId);
  // Also normalize older research-only drafts so review and future sends agree.
  return run?.websiteReviewEnabled === false
    ? { ...draft, content: asLetterContent(draft.content) }
    : draft;
}

async function hasLegacyArtifact(ctx: QueryCtx, companyId: string) {
  const legacy = await ctx.db
    .query('artifacts')
    .withIndex('by_companyId', (q) => q.eq('companyId', companyId))
    .first();
  return legacy !== null;
}

function isActiveRun(run: Doc<'pipelineRuns'> | null, now: number): boolean {
  return (
    run !== null &&
    run.status === 'running' &&
    now - run.startedAt < STALE_RUN_MS
  );
}

/** Summarize a company's draft state for list views. */
export async function draftState(
  ctx: QueryCtx,
  companyId: string,
): Promise<{
  state: DraftState;
  run: Doc<'pipelineRuns'> | null;
  draft: Doc<'outreachDrafts'> | null;
}> {
  const [run, draft] = await Promise.all([
    latestRun(ctx, companyId),
    draftForCompany(ctx, companyId),
  ]);
  const now = Date.now();
  let state: DraftState;
  if (isActiveRun(run, now)) state = 'running';
  else if (draft !== null) state = draft.status;
  else if (run !== null && run.status !== 'completed') state = 'failed';
  else if (await hasLegacyArtifact(ctx, companyId)) state = 'legacy';
  else state = 'none';
  return { state, run, draft };
}

/**
 * Start the pipeline for the given companies. Each run snapshots the current
 * Settings and is executed in the background; generation never sends email.
 */
export const requestRuns = mutation({
  args: {
    companyIds: v.array(v.string()),
    websiteReviewEnabled: v.optional(v.boolean()),
    regenerate: v.optional(v.boolean()),
  },
  returns: v.object({
    started: v.array(v.string()),
    skipped: v.array(v.object({ companyId: v.string(), reason: v.string() })),
  }),
  handler: async (
    ctx,
    { companyIds, websiteReviewEnabled = false, regenerate = false },
  ) => {
    await requireOperator(ctx);
    const unique = [...new Set(companyIds)];
    const settings = await loadCurrentSettings(ctx);
    const now = Date.now();
    // Each company gets an independent background action. Queue them together;
    // Convex schedules execution subject to the deployment's action capacity.
    const results = await Promise.all(
      unique.map(async (companyId) => {
        const company = await companyByExternalId(ctx, companyId);
        if (company === null) {
          return { companyId, reason: 'Company not found.' };
        }
        if (websiteReviewEnabled && company.domain.trim().length === 0) {
          return { companyId, reason: 'Company has no website domain.' };
        }
        const previous = await latestRun(ctx, companyId);
        if (isActiveRun(previous, now)) {
          return { companyId, reason: 'A run is already in progress.' };
        }
        if (!regenerate && (await draftForCompany(ctx, companyId)) !== null) {
          return {
            companyId,
            reason:
              'A draft already exists. Use Regenerate in Review to replace it.',
          };
        }
        if (previous !== null && previous.status === 'running') {
          await ctx.db.patch(previous._id, {
            status: 'failed',
            error: 'Run did not finish in time and was abandoned.',
            finishedAt: now,
          });
        }
        const runId = await ctx.db.insert('pipelineRuns', {
          companyId,
          status: 'running',
          stage: 'queued',
          websiteReviewEnabled,
          settings,
          startedAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.outreachPipeline.execute, {
          runId,
        });
        return { companyId, reason: null };
      }),
    );
    const started: string[] = [];
    const skipped: { companyId: string; reason: string }[] = [];
    for (const { companyId, reason } of results) {
      if (reason === null) started.push(companyId);
      else skipped.push({ companyId, reason });
    }
    return { started, skipped };
  },
});

/** Everything the background action needs for one run. */
export const loadRunInput = internalQuery({
  args: { runId: v.id('pipelineRuns') },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (run === null || run.status !== 'running') return null;
    const company = await companyByExternalId(ctx, run.companyId);
    if (company === null) return null;
    return {
      settings: run.settings,
      websiteReviewEnabled: run.websiteReviewEnabled ?? true,
      company: {
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        location: company.location,
        size: company.size,
        techStack: company.techStack,
        ...(company.description === undefined
          ? {}
          : { description: company.description }),
      },
    };
  },
});

export const setRunStage = internalMutation({
  args: { runId: v.id('pipelineRuns'), stage: runStageValidator },
  handler: async (ctx, { runId, stage }) => {
    const run = await ctx.db.get(runId);
    if (run !== null && run.status === 'running') {
      await ctx.db.patch(runId, { stage });
    }
  },
});

export const failRun = internalMutation({
  args: { runId: v.id('pipelineRuns'), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const run = await ctx.db.get(runId);
    if (run === null || run.status !== 'running') return;
    await ctx.db.patch(runId, {
      status: 'failed',
      error: error.slice(0, 600),
      finishedAt: Date.now(),
    });
  },
});

/**
 * Record a successful run. The draft is replaced only when this run is newer
 * than the run that produced the current draft, so a slow, older run can
 * never overwrite a newer result.
 */
export const completeRun = internalMutation({
  args: {
    runId: v.id('pipelineRuns'),
    evidence: evidenceValidator,
    analysis: analysisValidator,
    content: outreachContentValidator,
    model: v.string(),
  },
  returns: v.object({ appliedToDraft: v.boolean() }),
  handler: async (ctx, { runId, evidence, analysis, content, model }) => {
    const run = await ctx.db.get(runId);
    if (run === null || run.status !== 'running') {
      return { appliedToDraft: false };
    }
    const nowIso = new Date().toISOString();
    const draft = await draftForCompany(ctx, run.companyId);
    const applies = draft === null || draft.runStartedAt <= run.startedAt;

    await ctx.db.patch(runId, {
      status: 'completed',
      stage: 'done',
      evidence,
      analysis,
      content,
      model,
      finishedAt: Date.now(),
      appliedToDraft: applies,
    });
    if (!applies) return { appliedToDraft: false };

    const fields = {
      runId,
      runStartedAt: run.startedAt,
      settingsVersion: run.settings.version,
      content,
      status: 'ready' as const,
      approvedAt: undefined,
      acknowledgedClaims: undefined,
      editedAt: undefined,
      updatedAt: nowIso,
    };
    if (draft === null) {
      await ctx.db.insert('outreachDrafts', {
        companyId: run.companyId,
        ...fields,
        createdAt: nowIso,
      });
    } else {
      await ctx.db.patch(draft._id, fields);
    }
    return { appliedToDraft: true };
  },
});

/** Pipeline table rows: company + draft/run status. */
export const listPipelineCompanies = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const companies = await ctx.db.query('companies').collect();
    const rows = await Promise.all(
      companies.map(async (company) => {
        const { state, run, draft } = await draftState(ctx, company.externalId);
        // Match the mode to the status shown: an active/failed run, or the
        // retained draft when a later attempt failed without replacing it.
        const statusRun =
          state === 'running' || state === 'failed'
            ? run
            : draft !== null
              ? await ctx.db.get(draft.runId)
              : null;
        return {
          id: company.externalId,
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          segment: null,
          description: company.description ?? null,
          confidence: company.confidence,
          draftState: state,
          websiteReviewEnabled:
            statusRun === null
              ? null
              : (statusRun.websiteReviewEnabled ?? true),
          stage: run?.status === 'running' ? run.stage : null,
          lastError: run?.status === 'failed' ? (run.error ?? null) : null,
          subject: draft?.content.subject ?? '',
          recipientCount: [company.email1, company.email2, company.email3]
            .map((email) => email?.trim() ?? '')
            .filter((email) => email.length > 0).length,
          sendStatus: company.emailStatus ?? 'Not Sent',
        };
      }),
    );
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

/** Everything the review screen shows for one company. */
export const getReview = query({
  args: { companyId: v.string() },
  handler: async (ctx, { companyId }) => {
    await requireOperator(ctx);
    const company = await companyByExternalId(ctx, companyId);
    if (company === null) return null;
    const { state, run, draft } = await draftState(ctx, companyId);
    const draftRun = draft !== null ? await ctx.db.get(draft.runId) : null;
    return {
      company: {
        id: company.externalId,
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        recipients: [company.email1, company.email2, company.email3]
          .map((email) => email?.trim() ?? '')
          .filter((email) => email.length > 0),
      },
      draftState: state,
      latestRun:
        run === null
          ? null
          : {
              id: run._id,
              status: run.status,
              stage: run.stage,
              error: run.error ?? null,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt ?? null,
              settingsVersion: run.settings.version,
              websiteReviewEnabled: run.websiteReviewEnabled ?? true,
            },
      draft:
        draft === null
          ? null
          : {
              id: draft._id,
              status: draft.status,
              content: draft.content,
              approvedAt: draft.approvedAt ?? null,
              acknowledgedClaims: draft.acknowledgedClaims ?? [],
              editedAt: draft.editedAt ?? null,
              updatedAt: draft.updatedAt,
              settingsVersion: draft.settingsVersion,
              websiteReviewEnabled: draftRun?.websiteReviewEnabled ?? true,
            },
      evidence: draftRun?.evidence ?? null,
      analysis: draftRun?.analysis ?? null,
      generatedAt: draftRun?.finishedAt ?? null,
    };
  },
});

async function requireDraft(ctx: MutationCtx, companyId: string) {
  const draft = await draftForCompany(ctx, companyId);
  if (draft === null) {
    throw new Error('No generated draft exists for this company yet.');
  }
  return draft;
}

/** Save reviewer edits. Any edit withdraws a previous approval. */
export const saveDraftEdits = mutation({
  args: {
    companyId: v.string(),
    subject: v.string(),
    opening: v.string(),
    closing: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { companyId, ...edits }) => {
    await requireOperator(ctx);
    const draft = await requireDraft(ctx, companyId);
    const content = { ...draft.content, ...edits };
    const issues = validateOutreachContent(content);
    if (issues.length > 0) throw new Error(issues.join(' '));
    const now = new Date().toISOString();
    await ctx.db.patch(draft._id, {
      content,
      status: 'ready',
      approvedAt: undefined,
      acknowledgedClaims: undefined,
      editedAt: now,
      updatedAt: now,
    });
  },
});

/** The evidence corpus the draft's claims are checked against. */
async function draftCorpus(ctx: QueryCtx, draft: Doc<'outreachDrafts'>) {
  const run = await ctx.db.get(draft.runId);
  return evidenceCorpus(
    run?.evidence?.facts ?? [],
    run?.evidence?.excerpts,
    run?.evidence?.researchContext,
  );
}

/**
 * Legacy compatibility endpoint; sending no longer requires approval. Refuses
 * structural problems and a missing signature outright; unsupported claims
 * must each be explicitly acknowledged by the reviewer.
 */
export const approveDraft = mutation({
  args: {
    companyId: v.string(),
    acknowledgedClaims: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { companyId, acknowledgedClaims = [] }) => {
    await requireOperator(ctx);
    const draft = await requireDraft(ctx, companyId);
    const check = checkDraftForApproval(
      draft.content,
      await draftCorpus(ctx, draft),
    );
    if (check.blockers.length > 0) throw new Error(check.blockers.join(' '));
    if (!claimsAcknowledged(check.claims, acknowledgedClaims)) {
      throw new Error(
        `Confirm these claims are accurate, or edit them out, before approving: ${check.claims.join(', ')}`,
      );
    }
    const now = new Date().toISOString();
    await ctx.db.patch(draft._id, {
      status: 'approved',
      approvedAt: now,
      acknowledgedClaims: check.claims,
      updatedAt: now,
    });
  },
});

/** Legacy compatibility endpoint for withdrawing a historical approval. */
export const unapproveDraft = mutation({
  args: { companyId: v.string() },
  handler: async (ctx, { companyId }) => {
    await requireOperator(ctx);
    const draft = await requireDraft(ctx, companyId);
    await ctx.db.patch(draft._id, {
      status: 'ready',
      approvedAt: undefined,
      acknowledgedClaims: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Remove current drafts while preserving companies and their historical runs. */
export const deleteDrafts = mutation({
  args: { companyIds: v.array(v.string()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { companyIds }) => {
    await requireOperator(ctx);
    const now = Date.now();
    const selected = [];
    for (const companyId of new Set(companyIds)) {
      const runs = await ctx.db
        .query('pipelineRuns')
        .withIndex('by_company', (q) => q.eq('companyId', companyId))
        .collect();
      const company = await companyByExternalId(ctx, companyId);
      const name = company?.name ?? companyId;
      if (runs.some((run) => isActiveRun(run, now))) {
        throw new Error(
          `${name}: Draft generation is in progress. Wait for it to finish before deleting the draft.`,
        );
      }
      if (await hasActiveSends(ctx, companyId)) {
        throw new Error(
          `${name} has sends queued, in flight, or awaiting review. Cancel or resolve them before deleting its draft.`,
        );
      }
      selected.push({ runs, draft: await draftForCompany(ctx, companyId) });
    }
    let deleted = 0;
    for (const { runs, draft } of selected) {
      // A stale action must not recreate the draft if it eventually returns.
      for (const run of runs) {
        if (run.status === 'running') {
          await ctx.db.patch(run._id, {
            status: 'failed',
            error: 'Run was abandoned before draft deletion.',
            finishedAt: now,
          });
        }
      }
      if (draft !== null) {
        await ctx.db.delete(draft._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/** Remove a company's pipeline state (runs + draft). Used by cleanup paths. */
export async function deletePipelineState(ctx: MutationCtx, companyId: string) {
  const runs = await ctx.db
    .query('pipelineRuns')
    .withIndex('by_company', (q) => q.eq('companyId', companyId))
    .collect();
  for (const run of runs) await ctx.db.delete(run._id);
  const draft = await draftForCompany(ctx, companyId);
  if (draft !== null) await ctx.db.delete(draft._id);
}

export type RunId = Id<'pipelineRuns'>;
