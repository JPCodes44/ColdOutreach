import { v } from 'convex/values';
// `./_generated/server` is produced by `bunx convex dev`. Until you run it once,
// this import will not resolve — that is expected for a fresh checkout.
import {
  action,
  internalQuery,
  mutation,
  type ActionCtx,
} from './_generated/server';
import { requireOperator, requireOperatorAction } from './operator';
import { internal } from './_generated/api';
import { computeCostUsd, GEMINI_GROUNDING_EST_USD } from './pricing';
import { runGeminiWithFallback } from './gemini';
import { COMPANY_RESEARCH_SYSTEM_PROMPT } from './prompts/company_research_system';
import { deletePipelineState } from './outreachRuns';
import { industryScope } from './outreach/industryScopes';
import { deleteLegacyArtifacts, hasActiveSends } from './send';
import {
  normalizeCompanyDomain,
  slugify,
  stripMarkdownCodeFence,
} from '@emailstrat/common';

interface ResearchArgs {
  keywords?: string;
  industry: string;
  companySize: string;
  location: string;
  techStack: string[];
  limit: number;
}

interface ResearchPromptArgs extends ResearchArgs {
  excludedCompanyDomains: string[];
  outreachTarget: { niche: string; offer: string };
}

interface CompanyResearchCandidate {
  name?: string;
  domain?: string;
  industry?: string;
  description?: string;
  location?: string;
  size?: string;
  techStack?: string[];
  confidence?: number;
  manufacturingRole?: unknown;
  plantBasedFocus?: unknown;
}

interface CompanyResearchResult {
  id: string;
  name: string;
  domain: string;
  industry: string;
  description?: string;
  location: string;
  size: string;
  techStack: string[];
  confidence: number;
  /** Preset-specific label, e.g. "Exclusively vegan" / "Mixed manufacturer". */
  segment?: string;
}

interface CompanyResearchResponse {
  companies: CompanyResearchResult[];
  total: number;
}

function getDeploymentEnv(): Record<string, string | undefined> {
  const runtime = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.process?.env ?? {};
}

function normalizeCompany(
  company: CompanyResearchCandidate,
): CompanyResearchResult {
  const name = company.name?.trim() || 'Unknown Company';
  const domain = company.domain?.trim() || slugify(name);
  return {
    id: domain,
    name,
    domain,
    industry: company.industry?.trim() || 'Unknown',
    ...(company.description?.trim()
      ? { description: company.description.trim().slice(0, 1000) }
      : {}),
    location: company.location?.trim() || 'Unknown',
    size: company.size?.trim() || 'Unknown',
    techStack: Array.isArray(company.techStack) ? company.techStack : [],
    confidence:
      typeof company.confidence === 'number'
        ? Math.min(Math.max(company.confidence, 0), 100)
        : 0,
  };
}

/**
 * Apply an industry preset: drop out-of-scope candidates (e.g. retailers for
 * a manufacturers-only scope), retaining their researched descriptions.
 */
export function classifyCandidates(
  industry: string,
  candidates: CompanyResearchCandidate[],
): CompanyResearchResult[] {
  const preset = industryScope(industry);
  if (preset === undefined) return candidates.map(normalizeCompany);
  const kept: CompanyResearchResult[] = [];
  for (const candidate of candidates) {
    const { keep } = preset.classify(candidate);
    if (keep) kept.push(normalizeCompany(candidate));
  }
  return kept;
}

async function filterPreviouslyEmailed(
  ctx: ActionCtx,
  companies: CompanyResearchResult[],
): Promise<CompanyResearchResult[]> {
  const fresh: CompanyResearchResult[] = [];
  const seenDomains = new Set<string>();

  for (const company of companies) {
    const normalizedDomain = normalizeCompanyDomain(company.domain);
    if (normalizedDomain.length === 0 || seenDomains.has(normalizedDomain)) {
      continue;
    }
    seenDomains.add(normalizedDomain);

    const emailed = await ctx.runQuery(internal.companies.hasEmailedDomain, {
      normalizedDomain,
    });
    if (!emailed) fresh.push(company);
  }

  return fresh;
}

function parseResearchResponse(
  text: string | undefined,
): CompanyResearchCandidate[] {
  if (text === undefined || text.length === 0) {
    throw new Error('Gemini returned no company research output.');
  }
  const json = stripMarkdownCodeFence(text, 'json');
  const parsed = JSON.parse(json) as { companies: CompanyResearchCandidate[] };
  return parsed.companies;
}

/** Build the grounded research request payload sent to Gemini. */
export function buildResearchContents(args: ResearchPromptArgs): string {
  const { excludedCompanyDomains, outreachTarget, ...criteria } = args;
  const preset = industryScope(criteria.industry);
  const researchCriteria = preset
    ? { ...criteria, industry: preset.label, scope: preset.scope }
    : criteria;
  const extraFields = preset?.responseFields ?? {};
  return JSON.stringify({
    role: 'company_research_request',
    instruction: COMPANY_RESEARCH_SYSTEM_PROMPT,
    outreachTarget,
    researchCriteria,
    excludedCompanyDomains,
    request: `Find ${args.limit} companies.`,
    responseShape: {
      companies: [
        {
          name: 'string',
          domain: 'string',
          industry: 'string',
          description:
            'A concise factual description of what the company makes or does, including specific products or services supported by search results; no category badges or inferred exclusivity claims.',
          location: 'string',
          size: 'string',
          techStack: ['string'],
          confidence: 'number from 0 to 100',
          ...extraFields,
        },
      ],
    },
    outputRequirements: {
      includeFields: [
        ...new Set([
          'name',
          'domain',
          'industry',
          'description',
          'location',
          'size',
          'techStack',
          'confidence',
          ...Object.keys(extraFields),
        ]),
      ],
    },
  });
}

/** Research companies from the discovery filters with one grounded Gemini call. */
export const research = action({
  args: {
    keywords: v.optional(v.string()),
    industry: v.string(),
    companySize: v.string(),
    location: v.string(),
    techStack: v.array(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<CompanyResearchResponse> => {
    await requireOperatorAction(ctx);
    const requestedLimit = Math.max(1, Math.floor(args.limit));
    const discoveryLimit = Math.min(requestedLimit * 2, 100);
    const excludedCompanyDomains = await ctx.runQuery(
      internal.companies.listRecentlyEmailedDomains,
      { limit: 200 },
    );
    const settings = await ctx.runQuery(internal.settings.current, {});
    const researchArgs = {
      ...args,
      limit: discoveryLimit,
      excludedCompanyDomains,
      outreachTarget: { niche: settings.niche, offer: settings.offer },
    };
    const env = getDeploymentEnv();
    const freeKey = env.GEMINI_API_KEY;
    if (freeKey === undefined || freeKey.length === 0) {
      throw new Error('GEMINI_API_KEY is required for company research.');
    }
    // Optional paid (billing-enabled) key. When the free tier's daily quota is
    // exhausted, fall back to this so research keeps working — and we only ever
    // pay once the free quota is spent. Resets daily, so the free key is tried
    // first again after midnight Pacific.
    const paidKey = env.GEMINI_API_KEY_PAID;
    // gemini-2.5-flash is no longer offered to new API users.
    const model = env.GEMINI_RESEARCH_MODEL ?? 'gemini-3.8-flash';

    // Free key first, falling back to the paid key on quota exhaustion.
    const result = await runGeminiWithFallback({
      freeKey,
      paidKey,
      params: {
        model,
        contents: buildResearchContents(researchArgs),
        // Google Search grounding for live, current company discovery.
        config: { tools: [{ googleSearch: {} }] },
      },
    });

    // Update the navbar balance tracker (best-effort). The free key only burns
    // a daily request; the paid key drains estimated dollars (tokens + grounding).
    try {
      if (result.usedFreeKey) {
        await ctx.runMutation(internal.usageDb.recordUsage, {
          provider: 'gemini',
          usedFreeGemini: true,
        });
      } else {
        await ctx.runMutation(internal.usageDb.recordUsage, {
          provider: 'gemini',
          costUsd: computeCostUsd(
            model,
            result.promptTokens,
            result.completionTokens,
          ),
          groundingCostUsd: GEMINI_GROUNDING_EST_USD,
        });
      }
    } catch (trackErr) {
      console.error('Gemini usage tracking failed:', trackErr);
    }

    const candidates = classifyCandidates(
      args.industry,
      parseResearchResponse(result.text).slice(0, discoveryLimit),
    );
    const companies = (await filterPreviouslyEmailed(ctx, candidates)).slice(
      0,
      requestedLimit,
    );

    return { companies, total: companies.length };
  },
  returns: v.object({
    companies: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        domain: v.string(),
        industry: v.string(),
        description: v.optional(v.string()),
        location: v.string(),
        size: v.string(),
        techStack: v.array(v.string()),
        confidence: v.number(),
        segment: v.optional(v.string()),
      }),
    ),
    total: v.number(),
  }),
});

/** Domain lookup used by research filtering without exposing the full history. */
export const hasEmailedDomain = internalQuery({
  args: { normalizedDomain: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { normalizedDomain }) => {
    const existing = await ctx.db
      .query('emailedCompanies')
      .withIndex('by_normalizedDomain', (q) =>
        q.eq('normalizedDomain', normalizedDomain),
      )
      .unique();
    return existing !== null;
  },
});

/** Compact history used to steer grounded research away from old targets. */
export const listRecentlyEmailedDomains = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query('emailedCompanies').collect();
    return rows
      .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt))
      .slice(0, Math.max(0, Math.floor(limit)))
      .map((row) => row.normalizedDomain)
      .filter((domain) => domain.length > 0);
  },
});

/** Fields persisted for an imported company (the frontend `Company` shape). */
const companyInput = v.object({
  externalId: v.string(),
  name: v.string(),
  domain: v.string(),
  initial: v.string(),
  industry: v.string(),
  description: v.optional(v.string()),
  location: v.string(),
  size: v.string(),
  techStack: v.array(v.string()),
  confidence: v.number(),
  confidenceTone: v.union(v.literal('positive'), v.literal('neutral')),
  segment: v.optional(v.string()),
});

/**
 * Upsert selected companies into the pipeline; idempotent by `externalId`.
 * Returns how many were newly inserted (vs skipped as existing duplicates).
 */
export const importCompanies = mutation({
  args: { companies: v.array(companyInput) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { companies }) => {
    await requireOperator(ctx);
    let inserted = 0;
    for (const company of companies) {
      const existing = await ctx.db
        .query('companies')
        .withIndex('by_externalId', (q) =>
          q.eq('externalId', company.externalId),
        )
        .unique();
      if (existing === null) {
        await ctx.db.insert('companies', {
          ...company,
          createdAt: new Date().toISOString(),
        });
        inserted += 1;
      } else if (company.description?.trim()) {
        await ctx.db.patch(existing._id, {
          description: company.description.trim(),
          industry: company.industry,
          segment: undefined,
        });
      }
    }
    return { inserted };
  },
});

/**
 * Remove companies from the pipeline with their runs, drafts, and legacy
 * artifacts. Refuses companies with sends still queued, in flight, or awaiting
 * review. Sent history in `sentEmails` is never removed.
 */
export const deleteCompanies = mutation({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, { externalIds }) => {
    await requireOperator(ctx);
    for (const externalId of externalIds) {
      if (await hasActiveSends(ctx, externalId)) {
        const company = await ctx.db
          .query('companies')
          .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
          .unique();
        throw new Error(
          `${company?.name ?? externalId} has sends queued, in flight, or awaiting review. Cancel or resolve them first.`,
        );
      }
    }
    for (const externalId of externalIds) {
      const company = await ctx.db
        .query('companies')
        .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
        .unique();
      if (company !== null) await ctx.db.delete(company._id);
      await deletePipelineState(ctx, externalId);
      await deleteLegacyArtifacts(ctx, externalId);
    }
  },
});
