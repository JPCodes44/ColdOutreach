import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { requireOperator } from './operator';
import {
  escapeHtml,
  nonEmptyStrings,
  normalizeCompanyDomain,
  normalizeEmailAddress,
  renderOutreachEmail,
  validateOutreachContent,
  type RenderedOutreachEmail,
} from '@emailstrat/common';
import {
  deletePipelineState,
  draftForCompany,
  draftState,
} from './outreachRuns';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
/** A claimed row older than this without an outcome is treated as uncertain. */
export const STALE_SENDING_MS = 10 * 60 * 1000;
export const SELF_TEST_PREFIX = '[ColdOutreach self-test]';

type QueueStatus = Doc<'sendQueue'>['status'];
/** Rows that reserve their recipient and company against duplicate sends. */
const ACTIVE_STATUSES: ReadonlySet<QueueStatus> = new Set([
  'queued',
  'sending',
  'uncertain',
]);

function recipientEmails(company: Doc<'companies'>): string[] {
  return nonEmptyStrings([company.email1, company.email2, company.email3]);
}

async function companyByExternalId(ctx: QueryCtx, companyId: string) {
  return ctx.db
    .query('companies')
    .withIndex('by_externalId', (q) => q.eq('externalId', companyId))
    .unique();
}

async function queueRowsForCompany(ctx: QueryCtx, companyId: string) {
  return ctx.db
    .query('sendQueue')
    .withIndex('by_company', (q) => q.eq('companyId', companyId))
    .collect();
}

function isReservation(row: Doc<'sendQueue'>): boolean {
  return row.isTest !== true && ACTIVE_STATUSES.has(row.status);
}

/* ---------------------------------------------------------- summaries */

/** Per-company readiness preview for the Schedule screen. */
export const getScheduleSummary = query({
  args: { companyIds: v.array(v.string()) },
  handler: async (ctx, { companyIds }) => {
    await requireOperator(ctx);
    const entities = [];
    let readyDrafts = 0;
    let totalEmailsQueued = 0;
    const batchDomains = new Set<string>();
    const batchEmails = new Set<string>();
    for (const companyId of new Set(companyIds)) {
      const company = await companyByExternalId(ctx, companyId);
      if (company === null) continue;
      const contacts = recipientEmails(company).length;
      const { state, draft } = await draftState(ctx, companyId);
      const emails = recipientEmails(company);
      let notReadyReason =
        draft === null
          ? 'No draft'
          : validateOutreachContent(draft.content).length > 0
            ? 'Draft incomplete'
            : !draft.content.signature.trim()
              ? 'Missing signature'
              : contacts === 0
                ? 'No recipients'
                : emails.some((email) => normalizeEmailAddress(email) === null)
                  ? 'Invalid recipients'
                  : null;
      const normalizedDomain = normalizeCompanyDomain(company.domain);
      const normalizedEmails = emails
        .map(normalizeEmailAddress)
        .filter((email): email is string => email !== null);
      if (notReadyReason === null) {
        notReadyReason = await companySendBlockReason(
          ctx,
          company,
          normalizedDomain,
        );
      }
      if (
        notReadyReason === null &&
        normalizedDomain &&
        batchDomains.has(normalizedDomain)
      ) {
        notReadyReason = `Company appears more than once: ${company.domain}`;
      }
      const companyEmails = new Set<string>();
      if (notReadyReason === null) {
        for (const email of normalizedEmails) {
          if (batchEmails.has(email) || companyEmails.has(email)) {
            notReadyReason = `Duplicate recipient in batch: ${email}`;
            break;
          }
          companyEmails.add(email);
          notReadyReason = await recipientSendBlockReason(ctx, email);
          if (notReadyReason !== null) break;
        }
      }
      const ready = notReadyReason === null;
      if (ready) {
        if (normalizedDomain) batchDomains.add(normalizedDomain);
        for (const email of normalizedEmails) batchEmails.add(email);
        readyDrafts += 1;
        totalEmailsQueued += contacts;
      }
      entities.push({
        id: company.externalId,
        name: company.name,
        initial: company.name.trim().charAt(0).toUpperCase() || '?',
        segment: company.industry,
        contacts,
        status: company.emailStatus ?? 'Not Sent',
        draftState: state,
        ready,
        notReadyReason,
      });
    }
    return {
      entities,
      totalCompanies: entities.length,
      readyDrafts,
      totalEmailsQueued,
    };
  },
});

/* ------------------------------------------------------------ enqueue */

interface PendingSend {
  company: Doc<'companies'>;
  draft: Doc<'outreachDrafts'>;
  snapshot: RenderedOutreachEmail;
  to: string;
  normalizedEmail: string;
  normalizedDomain: string;
}

async function companySendBlockReason(
  ctx: QueryCtx,
  company: Doc<'companies'>,
  normalizedDomain: string,
) {
  if (normalizedDomain.length > 0) {
    const ledger = await ctx.db
      .query('emailedCompanies')
      .withIndex('by_normalizedDomain', (q) =>
        q.eq('normalizedDomain', normalizedDomain),
      )
      .unique();
    if (ledger !== null) {
      return `Company already contacted: ${company.name}`;
    }
  }
  const rows = await queueRowsForCompany(ctx, company.externalId);
  if (rows.some(isReservation)) {
    return `${company.name} already has outreach queued, sending, or awaiting review.`;
  }
  return null;
}

async function recipientSendBlockReason(
  ctx: QueryCtx,
  normalizedEmail: string,
) {
  const ledger = await ctx.db
    .query('emailedRecipients')
    .withIndex('by_normalizedEmail', (q) =>
      q.eq('normalizedEmail', normalizedEmail),
    )
    .unique();
  if (ledger !== null) {
    return `Recipient already contacted: ${ledger.email}`;
  }
  const rows = await ctx.db
    .query('sendQueue')
    .withIndex('by_normalizedEmail', (q) =>
      q.eq('normalizedEmail', normalizedEmail),
    )
    .collect();
  if (rows.some(isReservation)) {
    return `Recipient already has a pending send: ${normalizedEmail}`;
  }
  return null;
}

/** Render the saved draft into an immutable snapshot, or throw. */
export function snapshotForDraft(
  draft: Doc<'outreachDrafts'> | null,
  companyName: string,
): RenderedOutreachEmail {
  if (draft === null) {
    throw new Error(`${companyName}: generate an outreach draft first.`);
  }
  const issues = validateOutreachContent(draft.content);
  if (issues.length > 0) {
    throw new Error(`${companyName}: ${issues.join(' ')}`);
  }
  if (!draft.content.signature.trim()) {
    throw new Error(`${companyName}: Add a signature before sending.`);
  }
  return renderOutreachEmail(draft.content);
}

async function buildPendingSends(
  ctx: MutationCtx,
  companyIds: string[],
): Promise<PendingSend[]> {
  const pending: PendingSend[] = [];
  const batchEmails = new Set<string>();
  const batchDomains = new Set<string>();

  for (const companyId of new Set(companyIds)) {
    const company = await companyByExternalId(ctx, companyId);
    if (company === null) throw new Error(`Company not found: ${companyId}`);
    const emails = recipientEmails(company);
    if (emails.length === 0) {
      throw new Error(`${company.name} has no recipient email addresses.`);
    }
    const normalizedDomain = normalizeCompanyDomain(company.domain);
    if (normalizedDomain.length > 0) {
      if (batchDomains.has(normalizedDomain)) {
        throw new Error(`Company appears more than once: ${company.domain}`);
      }
      batchDomains.add(normalizedDomain);
    }
    const companyBlock = await companySendBlockReason(
      ctx,
      company,
      normalizedDomain,
    );
    if (companyBlock !== null) throw new Error(companyBlock);

    const draft = await draftForCompany(ctx, companyId);
    const snapshot = snapshotForDraft(draft, company.name);

    for (const to of emails) {
      const normalizedEmail = normalizeEmailAddress(to);
      if (normalizedEmail === null) {
        throw new Error(`Invalid recipient email for ${company.name}: ${to}`);
      }
      if (batchEmails.has(normalizedEmail)) {
        throw new Error(`Duplicate recipient in batch: ${normalizedEmail}`);
      }
      batchEmails.add(normalizedEmail);
      const recipientBlock = await recipientSendBlockReason(
        ctx,
        normalizedEmail,
      );
      if (recipientBlock !== null) throw new Error(recipientBlock);
      pending.push({
        company,
        draft: draft!,
        snapshot,
        to: to.trim(),
        normalizedEmail,
        normalizedDomain,
      });
    }
  }
  return pending;
}

async function insertQueueRow(
  ctx: MutationCtx,
  row: {
    batchId: string;
    company: Doc<'companies'>;
    draft: Doc<'outreachDrafts'>;
    snapshot: RenderedOutreachEmail;
    to: string;
    normalizedEmail: string;
    atMs: number;
    isTest: boolean;
  },
): Promise<Id<'sendQueue'>> {
  const itemId = await ctx.db.insert('sendQueue', {
    batchId: row.batchId,
    companyId: row.company.externalId,
    company: row.company.name,
    companyDomain: row.company.domain,
    to: row.to,
    normalizedEmail: row.normalizedEmail,
    subject: row.snapshot.subject,
    snapshot: row.snapshot,
    draftId: row.draft._id,
    runId: row.draft.runId,
    status: 'queued',
    scheduledAt: new Date(row.atMs).toISOString(),
    createdAt: new Date().toISOString(),
    ...(row.isTest ? { isTest: true } : {}),
  });
  const scheduledFunctionId = await ctx.scheduler.runAt(
    row.atMs,
    internal.sendActions.processQueueItem,
    { itemId },
  );
  await ctx.db.patch(itemId, { scheduledFunctionId });
  return itemId;
}

/**
 * Queue an immutable snapshot of each saved draft for each recipient and
 * schedule dispatch. Rejects the whole batch on any invalid or duplicate entry.
 */
export const enqueueSend = mutation({
  args: {
    companyIds: v.array(v.string()),
    scheduledAtMs: v.number(),
    method: v.union(v.literal('immediate'), v.literal('batch')),
  },
  returns: v.object({ batchId: v.string(), queued: v.number() }),
  handler: async (ctx, { companyIds, scheduledAtMs, method }) => {
    await requireOperator(ctx);
    const now = Date.now();
    if (
      !Number.isFinite(scheduledAtMs) ||
      scheduledAtMs > now + MAX_SCHEDULE_AHEAD_MS
    ) {
      throw new Error('Choose a send time within the next year.');
    }
    const startMs = Math.max(scheduledAtMs, now);
    const pending = await buildPendingSends(ctx, companyIds);
    if (pending.length === 0) throw new Error('Nothing to queue.');
    const batchId = `batch-${now}-${Math.random().toString(36).slice(2, 8)}`;

    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i]!;
      const offset =
        method === 'batch' && pending.length > 1
          ? Math.floor((i / (pending.length - 1)) * TWO_HOURS_MS)
          : 0;
      await insertQueueRow(ctx, {
        batchId,
        ...item,
        atMs: startMs + offset,
        isTest: false,
      });
    }
    for (const companyId of new Set(
      pending.map((item) => item.company.externalId),
    )) {
      await refreshCompanyStatus(ctx, companyId);
    }
    return { batchId, queued: pending.length };
  },
});

/**
 * Queue a clearly labeled self-test of a company's current draft to the
 * configured Gmail account itself. Never addressed to a prospect; excluded
 * from contact ledgers and company status.
 */
export const enqueueSelfTest = internalMutation({
  args: { companyId: v.string(), to: v.string() },
  returns: v.id('sendQueue'),
  handler: async (ctx, { companyId, to }) => {
    const company = await companyByExternalId(ctx, companyId);
    if (company === null) throw new Error('Company not found.');
    const draft = await draftForCompany(ctx, companyId);
    if (draft === null) throw new Error('No draft to test.');
    const normalizedEmail = normalizeEmailAddress(to);
    if (normalizedEmail === null) throw new Error('Invalid self-test address.');
    const rendered = renderOutreachEmail(draft.content);
    const banner = `SELF-TEST: sent only to the sender's own inbox to check rendering. Intended for ${company.name}; not sent to the prospect.`;
    const snapshot = {
      subject: `${SELF_TEST_PREFIX} ${rendered.subject}`,
      text: `${banner}\n\n${rendered.text}`,
      html: rendered.html.replace(
        '<body style="margin:0;padding:0;background:#ffffff;">',
        `<body style="margin:0;padding:0;background:#ffffff;"><p style="font-family:Arial,sans-serif;font-size:13px;background:#fff4e5;color:#7a3e00;padding:10px 16px;margin:0;">${escapeHtml(banner)}</p>`,
      ),
    };
    return insertQueueRow(ctx, {
      batchId: `selftest-${Date.now()}`,
      company,
      draft,
      snapshot,
      to,
      normalizedEmail,
      atMs: Date.now(),
      isTest: true,
    });
  },
});

/* ----------------------------------------------------------- dispatch */

/**
 * Atomically claim a queued row for dispatch. Returns null when the row is not
 * dispatchable (already claimed, canceled, sent, or legacy), so concurrent or
 * repeated invocations can never send twice.
 */
export const claimQueueItem = internalMutation({
  args: { itemId: v.id('sendQueue'), actualTo: v.optional(v.string()) },
  handler: async (ctx, { itemId, actualTo }) => {
    const item = await ctx.db.get(itemId);
    if (item === null || item.status !== 'queued') return null;
    if (item.snapshot === undefined) {
      await ctx.db.patch(itemId, {
        status: 'legacy-blocked',
        error: 'Legacy job-application draft. Regenerate a new outreach draft.',
      });
      await refreshCompanyStatus(ctx, item.companyId);
      return null;
    }
    const target = actualTo?.trim() || item.to;
    await ctx.db.patch(itemId, {
      status: 'sending',
      claimedAt: new Date().toISOString(),
      actualTo: target,
    });
    await refreshCompanyStatus(ctx, item.companyId);
    return {
      to: item.to,
      actualTo: target,
      snapshot: item.snapshot,
      isTest: item.isTest === true,
    };
  },
});

async function recordSent(
  ctx: MutationCtx,
  item: Doc<'sendQueue'>,
  acceptance: 'smtp-accepted' | 'manually-confirmed',
  providerMessageId: string | undefined,
) {
  const sentAt = new Date().toISOString();
  await ctx.db.patch(item._id, {
    status: 'sent',
    sentAt,
    error: undefined,
    ...(providerMessageId !== undefined ? { providerMessageId } : {}),
    ...(acceptance === 'manually-confirmed' ? { resolvedAt: sentAt } : {}),
  });
  const company = await companyByExternalId(ctx, item.companyId);
  const companyDomain = item.companyDomain ?? company?.domain ?? item.companyId;
  const actualTo = item.actualTo ?? item.to;
  const redirected = isRedirected(item);
  await ctx.db.insert('sentEmails', {
    queueItemId: item._id,
    companyId: item.companyId,
    companyName: company?.name ?? item.company,
    companyDomain,
    intendedTo: item.to,
    actualTo,
    redirected,
    subject: item.snapshot?.subject ?? item.subject,
    text: item.snapshot?.text ?? '',
    html: item.snapshot?.html ?? '',
    sentAt,
    acceptance,
    isTest: item.isTest === true,
    ...(providerMessageId !== undefined ? { providerMessageId } : {}),
    ...(item.runId !== undefined ? { runId: item.runId } : {}),
  });
  // Self-tests and GMAIL_REDIRECT_TO rehearsals never reached the prospect,
  // so they must not mark the company or recipient as contacted.
  if (item.isTest === true || redirected) {
    await refreshCompanyStatus(ctx, item.companyId);
    return;
  }
  await recordContactedCompany(
    ctx,
    item.companyId,
    item.company,
    companyDomain,
    sentAt,
  );
  await recordContactedRecipient(ctx, item, companyDomain, sentAt);
  await refreshCompanyStatus(ctx, item.companyId);
}

/** Gmail accepted the message: the only automatic path to `sent`. */
export const markQueueItemSent = internalMutation({
  args: {
    itemId: v.id('sendQueue'),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, providerMessageId }) => {
    const item = await ctx.db.get(itemId);
    if (item === null || item.status !== 'sending') return;
    await recordSent(ctx, item, 'smtp-accepted', providerMessageId);
  },
});

/** Gmail definitely did not accept the message; the reservation is released. */
export const markQueueItemFailed = internalMutation({
  args: { itemId: v.id('sendQueue'), error: v.string() },
  handler: async (ctx, { itemId, error }) => {
    const item = await ctx.db.get(itemId);
    if (item === null || item.status !== 'sending') return;
    await ctx.db.patch(itemId, { status: 'failed', error });
    await refreshCompanyStatus(ctx, item.companyId);
  },
});

/** The outcome is ambiguous; hold the reservation for a human decision. */
export const markQueueItemUncertain = internalMutation({
  args: { itemId: v.id('sendQueue'), error: v.string() },
  handler: async (ctx, { itemId, error }) => {
    const item = await ctx.db.get(itemId);
    if (item === null || item.status !== 'sending') return;
    await ctx.db.patch(itemId, { status: 'uncertain', error });
    await refreshCompanyStatus(ctx, item.companyId);
  },
});

function isStaleSending(row: Doc<'sendQueue'>, now: number): boolean {
  return (
    row.status === 'sending' &&
    row.claimedAt !== undefined &&
    now - Date.parse(row.claimedAt) > STALE_SENDING_MS
  );
}

/**
 * Resolve an uncertain (or stuck) send after checking the Gmail Sent folder.
 * `sent` records it in history; `not-sent` marks it failed and frees the
 * recipient so it can be queued again deliberately. Never resends.
 */
export const resolveUncertainSend = mutation({
  args: {
    itemId: v.id('sendQueue'),
    outcome: v.union(v.literal('sent'), v.literal('not-sent')),
  },
  handler: async (ctx, { itemId, outcome }) => {
    await requireOperator(ctx);
    const item = await ctx.db.get(itemId);
    if (
      item === null ||
      !(item.status === 'uncertain' || isStaleSending(item, Date.now()))
    ) {
      throw new Error('Only uncertain or stuck sends can be resolved.');
    }
    if (outcome === 'sent') {
      await recordSent(ctx, item, 'manually-confirmed', undefined);
      return;
    }
    await ctx.db.patch(itemId, {
      status: 'failed',
      error: `${item.error ?? 'Uncertain outcome'} — confirmed not sent after review.`,
      resolvedAt: new Date().toISOString(),
    });
    await refreshCompanyStatus(ctx, item.companyId);
  },
});

/* ------------------------------------------------------- cancellation */

async function cancelRow(ctx: MutationCtx, row: Doc<'sendQueue'>) {
  if (row.status !== 'queued') return false;
  await ctx.db.patch(row._id, {
    status: 'canceled',
    resolvedAt: new Date().toISOString(),
  });
  if (row.scheduledFunctionId !== undefined) {
    const scheduled = await ctx.db.system.get(row.scheduledFunctionId);
    if (scheduled?.state.kind === 'pending') {
      await ctx.scheduler.cancel(row.scheduledFunctionId);
    }
  }
  return true;
}

/** Cancel every still-queued send for the given companies. */
export const cancelScheduledSends = mutation({
  args: { companyIds: v.array(v.string()) },
  returns: v.object({ canceled: v.number() }),
  handler: async (ctx, { companyIds }) => {
    await requireOperator(ctx);
    let canceled = 0;
    for (const companyId of new Set(companyIds)) {
      for (const row of await queueRowsForCompany(ctx, companyId)) {
        if (await cancelRow(ctx, row)) canceled += 1;
      }
      await refreshCompanyStatus(ctx, companyId);
    }
    return { canceled };
  },
});

/** Cancel one queued send. */
export const cancelQueueItem = mutation({
  args: { itemId: v.id('sendQueue') },
  handler: async (ctx, { itemId }) => {
    await requireOperator(ctx);
    const row = await ctx.db.get(itemId);
    if (row === null || !(await cancelRow(ctx, row))) {
      throw new Error('Only queued sends can be canceled.');
    }
    await refreshCompanyStatus(ctx, row.companyId);
  },
});

/* ------------------------------------------------------------ history */

/** Queue rows (newest first) for the History screen. Snapshot bodies omitted. */
export const listQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const now = Date.now();
    const rows = await ctx.db.query('sendQueue').order('desc').take(300);
    return rows.map((row) => ({
      id: row._id,
      companyId: row.companyId,
      company: row.company,
      to: row.to,
      actualTo: row.actualTo ?? null,
      subject: row.subject,
      status: row.status,
      stale: isStaleSending(row, now),
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt ?? null,
      error: row.error ?? null,
      isTest: row.isTest === true,
    }));
  },
});

/** Sent history (newest first); survives company/draft cleanup. */
export const listSentEmails = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const rows = await ctx.db
      .query('sentEmails')
      .withIndex('by_sentAt')
      .order('desc')
      .take(300);
    return rows.map((row) => ({
      id: row._id,
      companyName: row.companyName,
      companyDomain: row.companyDomain,
      intendedTo: row.intendedTo,
      actualTo: row.actualTo,
      redirected: row.redirected,
      subject: row.subject,
      sentAt: row.sentAt,
      acceptance: row.acceptance,
      providerMessageId: row.providerMessageId ?? null,
      isTest: row.isTest,
      bouncedAt: row.bouncedAt ?? null,
      bounceDetail: row.bounceDetail ?? null,
      repliedAt: row.repliedAt ?? null,
    }));
  },
});

/** Full stored content of one sent email. */
export const getSentEmail = query({
  args: { id: v.id('sentEmails') },
  handler: async (ctx, { id }) => {
    await requireOperator(ctx);
    return ctx.db.get(id);
  },
});

/* ------------------------------------------------- status and ledgers */

/** Sent to a different address than intended (GMAIL_REDIRECT_TO rehearsal). */
function isRedirected(row: Doc<'sendQueue'>): boolean {
  return (
    row.actualTo !== undefined &&
    normalizeEmailAddress(row.actualTo) !== normalizeEmailAddress(row.to)
  );
}

/** Recompute a company's denormalized send status from its queue rows. */
export async function refreshCompanyStatus(
  ctx: MutationCtx,
  companyId: string,
) {
  const company = await companyByExternalId(ctx, companyId);
  if (company === null) return;
  const rows = (await queueRowsForCompany(ctx, companyId)).filter(
    (row) => row.isTest !== true,
  );
  const has = (status: QueueStatus) =>
    rows.some((row) => row.status === status);
  let emailStatus: NonNullable<Doc<'companies'>['emailStatus']>;
  if (has('uncertain') || rows.some((row) => isStaleSending(row, Date.now()))) {
    emailStatus = 'Needs Review';
  } else if (has('queued') || has('sending')) {
    emailStatus = 'Sending';
  } else if (has('failed') || has('legacy-blocked')) {
    emailStatus = has('sent') ? 'Sent' : 'Failed';
  } else if (has('sent')) {
    emailStatus = 'Sent';
  } else {
    emailStatus = 'Not Sent';
  }
  if (company.emailStatus !== emailStatus) {
    await ctx.db.patch(company._id, { emailStatus });
  }
}

async function recordContactedCompany(
  ctx: MutationCtx,
  companyId: string,
  companyName: string,
  domain: string,
  sentAt: string,
) {
  const normalizedDomain = normalizeCompanyDomain(domain || companyId);
  if (normalizedDomain.length === 0) return;
  const existing = await ctx.db
    .query('emailedCompanies')
    .withIndex('by_normalizedDomain', (q) =>
      q.eq('normalizedDomain', normalizedDomain),
    )
    .unique();
  if (existing === null) {
    await ctx.db.insert('emailedCompanies', {
      normalizedDomain,
      domain,
      name: companyName,
      firstSentAt: sentAt,
      lastSentAt: sentAt,
      sentCount: 1,
    });
  } else {
    await ctx.db.patch(existing._id, {
      lastSentAt: sentAt,
      sentCount: existing.sentCount + 1,
    });
  }
}

async function recordContactedRecipient(
  ctx: MutationCtx,
  item: Doc<'sendQueue'>,
  companyDomain: string,
  sentAt: string,
) {
  const normalizedEmail =
    item.normalizedEmail ?? normalizeEmailAddress(item.to);
  if (normalizedEmail === null) return;
  const existing = await ctx.db
    .query('emailedRecipients')
    .withIndex('by_normalizedEmail', (q) =>
      q.eq('normalizedEmail', normalizedEmail),
    )
    .unique();
  if (existing === null) {
    await ctx.db.insert('emailedRecipients', {
      normalizedEmail,
      email: item.to.trim(),
      companyDomain,
      companyName: item.company,
      firstContactedAt: sentAt,
      lastContactedAt: sentAt,
      contactCount: 1,
    });
  } else {
    await ctx.db.patch(existing._id, {
      lastContactedAt: sentAt,
      contactCount: existing.contactCount + 1,
    });
  }
}

/* ------------------------------------------------------------ cleanup */

/** Delete a company's legacy job-application artifacts and résumé PDFs. */
export async function deleteLegacyArtifacts(
  ctx: MutationCtx,
  companyId: string,
) {
  const artifacts = await ctx.db
    .query('artifacts')
    .withIndex('by_companyId', (q) => q.eq('companyId', companyId))
    .collect();
  for (const artifact of artifacts) {
    if (artifact.resumePdfId !== undefined) {
      await ctx.storage.delete(artifact.resumePdfId);
    }
    await ctx.db.delete(artifact._id);
  }
}

/**
 * Page-exit cleanup: remove "settled" companies — every non-test queue row is
 * sent or canceled and at least one was sent. Their sent content stays in
 * `sentEmails` and the contact ledgers.
 */
export const purgeSettledCompanies = mutation({
  args: { companyIds: v.array(v.string()) },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, { companyIds }) => {
    await requireOperator(ctx);
    let removed = 0;
    for (const companyId of new Set(companyIds)) {
      const rows = await queueRowsForCompany(ctx, companyId);
      // Rehearsals (tests, redirected sends) never settle a company.
      const real = rows.filter(
        (row) => row.isTest !== true && !isRedirected(row),
      );
      const settled =
        real.some((row) => row.status === 'sent') &&
        rows.every(
          (row) =>
            row.status === 'sent' ||
            row.status === 'canceled' ||
            (row.isTest === true && row.status === 'failed'),
        );
      if (!settled) continue;
      for (const row of rows) await ctx.db.delete(row._id);
      await deleteLegacyArtifacts(ctx, companyId);
      await deletePipelineState(ctx, companyId);
      const company = await companyByExternalId(ctx, companyId);
      if (company !== null) await ctx.db.delete(company._id);
      removed += 1;
    }
    return { removed };
  },
});

/** True when the company has sends that must finish or be resolved first. */
export async function hasActiveSends(ctx: QueryCtx, companyId: string) {
  return (await queueRowsForCompany(ctx, companyId)).some(isReservation);
}

/**
 * Operator cleanup for History: delete self-test records and finished
 * (canceled or failed) queue rows that were only ever tests. Never touches
 * real sent emails or the contact ledgers. Run from the CLI:
 * `bunx convex run send:purgeTestHistory`.
 */
export const purgeTestHistory = internalMutation({
  args: { canceledRecipients: v.optional(v.array(v.string())) },
  returns: v.object({ queueRows: v.number(), sentEmails: v.number() }),
  handler: async (ctx, { canceledRecipients = [] }) => {
    const extra = new Set(canceledRecipients.map((to) => to.toLowerCase()));
    let queueRows = 0;
    let sentEmails = 0;
    for (const row of await ctx.db.query('sentEmails').collect()) {
      if (!row.isTest) continue;
      await ctx.db.delete(row._id);
      sentEmails += 1;
    }
    for (const row of await ctx.db.query('sendQueue').collect()) {
      const finishedTest =
        row.isTest === true &&
        ['sent', 'failed', 'canceled'].includes(row.status);
      const canceledPlaceholder =
        row.status === 'canceled' && extra.has(row.to.toLowerCase());
      if (!finishedTest && !canceledPlaceholder) continue;
      await ctx.db.delete(row._id);
      queueRows += 1;
    }
    return { queueRows, sentEmails };
  },
});
