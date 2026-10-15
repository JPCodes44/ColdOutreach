import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Structured, editable outreach email content (mirrors `OutreachEmailContent`). */
export const outreachContentValidator = v.object({
  subject: v.string(),
  opening: v.string(),
  findings: v.array(v.object({ text: v.string(), sourceUrl: v.string() })),
  workflow: v.array(v.object({ name: v.string(), description: v.string() })),
  dashboard: v.object({
    title: v.string(),
    metrics: v.array(v.object({ label: v.string(), description: v.string() })),
    stages: v.array(v.string()),
  }),
  closing: v.string(),
  signature: v.string(),
});

export const settingsSnapshotValidator = v.object({
  version: v.number(),
  niche: v.string(),
  offer: v.string(),
  senderName: v.string(),
  signature: v.string(),
  customInstructions: v.string(),
});

export const evidenceValidator = v.object({
  sources: v.array(
    v.object({
      url: v.string(),
      title: v.string(),
      fetchedAt: v.string(),
      /** Rendered by the headless-browser fallback (JavaScript sites). */
      rendered: v.optional(v.boolean()),
    }),
  ),
  facts: v.array(
    v.object({
      id: v.string(),
      kind: v.string(),
      sourceUrl: v.string(),
      text: v.string(),
    }),
  ),
  skipped: v.array(v.object({ url: v.string(), reason: v.string() })),
  /** Visible page text used as untrusted context (absent on older runs). */
  excerpts: v.optional(
    v.array(v.object({ url: v.string(), text: v.string() })),
  ),
});

export const analysisValidator = v.object({
  businessSummary: v.string(),
  observations: v.array(
    v.object({ text: v.string(), evidenceIds: v.array(v.string()) }),
  ),
  opportunities: v.array(
    v.object({
      title: v.string(),
      observation: v.string(),
      evidenceIds: v.array(v.string()),
      hypothesis: v.string(),
      suggestedImprovement: v.string(),
    }),
  ),
  proposedWorkflow: v.array(
    v.object({ name: v.string(), description: v.string() }),
  ),
  dashboard: v.object({
    title: v.string(),
    metrics: v.array(v.object({ label: v.string(), description: v.string() })),
    stages: v.array(v.string()),
  }),
  droppedCount: v.number(),
});

export const runStageValidator = v.union(
  v.literal('queued'),
  v.literal('retrieving'),
  v.literal('analyzing'),
  v.literal('composing'),
  v.literal('rendering'),
  v.literal('done'),
);

export const queueStatusValidator = v.union(
  v.literal('queued'),
  /** Legacy app-draft rows from the job-application flow; never dispatched. */
  v.literal('drafted'),
  /** Claimed by a dispatcher; Gmail outcome not yet recorded. */
  v.literal('sending'),
  v.literal('sent'),
  v.literal('failed'),
  /** Gmail may or may not have accepted it; needs a human decision. */
  v.literal('uncertain'),
  v.literal('canceled'),
  /** Legacy row without an approved snapshot; must be regenerated. */
  v.literal('legacy-blocked'),
);

export default defineSchema({
  ...authTables,
  /**
   * Legacy job-application artifacts (cold email + résumé). Retained only so
   * existing documents stay valid; nothing reads, displays, or sends them.
   */
  artifacts: defineTable({
    companyId: v.string(),
    emailTemplate: v.optional(v.string()),
    emailSubject: v.optional(v.string()),
    resumeLatex: v.optional(v.string()),
    resumePdfId: v.optional(v.id('_storage')),
    status: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    obsoleteAt: v.optional(v.string()),
  }).index('by_companyId', ['companyId']),
  companies: defineTable({
    /** The research-supplied id (domain). */
    externalId: v.string(),
    name: v.string(),
    domain: v.string(),
    initial: v.string(),
    industry: v.string(),
    location: v.string(),
    size: v.string(),
    techStack: v.array(v.string()),
    confidence: v.number(),
    confidenceTone: v.union(v.literal('positive'), v.literal('neutral')),
    /** Industry-preset label, e.g. "Exclusively vegan" / "Mixed manufacturer". */
    segment: v.optional(v.string()),
    /** Up to three manually-entered recipient emails for the outreach. */
    email1: v.optional(v.string()),
    email2: v.optional(v.string()),
    email3: v.optional(v.string()),
    /** Denormalized send roll-up for list views. */
    emailStatus: v.optional(
      v.union(
        v.literal('Not Sent'),
        v.literal('Drafted'),
        v.literal('Sending'),
        v.literal('Sent'),
        v.literal('Failed'),
        v.literal('Needs Review'),
      ),
    ),
    createdAt: v.string(),
  }).index('by_externalId', ['externalId']),
  /**
   * Versioned outreach Settings. Every save inserts a new immutable version;
   * runs record the version they used, so edits only affect future runs.
   */
  outreachSettings: defineTable({
    version: v.number(),
    niche: v.string(),
    offer: v.string(),
    senderName: v.string(),
    signature: v.string(),
    customInstructions: v.string(),
    createdAt: v.string(),
  }).index('by_version', ['version']),
  /** One pipeline execution for one company, with its outputs or failure. */
  pipelineRuns: defineTable({
    companyId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    stage: runStageValidator,
    settings: settingsSnapshotValidator,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    evidence: v.optional(evidenceValidator),
    analysis: v.optional(analysisValidator),
    content: v.optional(outreachContentValidator),
    model: v.optional(v.string()),
    /** False when a newer run had already produced the company's draft. */
    appliedToDraft: v.optional(v.boolean()),
  }).index('by_company', ['companyId', 'startedAt']),
  /**
   * The company's current reviewable outreach draft. Replaced only by a newer
   * successful run; a failed run never touches it.
   */
  outreachDrafts: defineTable({
    companyId: v.string(),
    runId: v.id('pipelineRuns'),
    runStartedAt: v.number(),
    settingsVersion: v.number(),
    content: outreachContentValidator,
    status: v.union(v.literal('ready'), v.literal('approved')),
    approvedAt: v.optional(v.string()),
    /** Flagged claims the reviewer explicitly accepted when approving. */
    acknowledgedClaims: v.optional(v.array(v.string())),
    editedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_company', ['companyId']),
  /**
   * Persistent history of companies with at least one successfully sent email.
   * Survives active-pipeline cleanup.
   */
  emailedCompanies: defineTable({
    normalizedDomain: v.string(),
    domain: v.string(),
    name: v.string(),
    firstSentAt: v.string(),
    lastSentAt: v.string(),
    sentCount: v.number(),
  }).index('by_normalizedDomain', ['normalizedDomain']),
  /** Persistent history of recipients Gmail accepted a message for. */
  emailedRecipients: defineTable({
    normalizedEmail: v.string(),
    email: v.string(),
    companyDomain: v.string(),
    companyName: v.string(),
    firstContactedAt: v.string(),
    lastContactedAt: v.string(),
    contactCount: v.number(),
  }).index('by_normalizedEmail', ['normalizedEmail']),
  /** Per-provider API credit tracker surfaced in the navbar. */
  providerBalances: defineTable({
    provider: v.union(
      v.literal('openai'),
      v.literal('deepseek'),
      v.literal('gemini'),
    ),
    /** Remaining dollars; unset until a starting balance is known. */
    balanceUsd: v.optional(v.number()),
    /** Estimated dollars spent since tracking began. */
    spentUsd: v.optional(v.number()),
    freeRequestsRemaining: v.optional(v.number()),
    freeResetAt: v.optional(v.string()),
    updatedAt: v.string(),
  }).index('by_provider', ['provider']),
  /**
   * The send queue: one row per recipient. Active rows (queued, sending,
   * uncertain) double as the recipient reservation. `snapshot` is the
   * immutable approved content; later edits never change it.
   */
  sendQueue: defineTable({
    batchId: v.string(),
    companyId: v.string(),
    /** Denormalized company name for display. */
    company: v.string(),
    /** The intended recipient. */
    to: v.string(),
    subject: v.string(),
    status: queueStatusValidator,
    scheduledAt: v.string(),
    createdAt: v.string(),
    normalizedEmail: v.optional(v.string()),
    companyDomain: v.optional(v.string()),
    draftId: v.optional(v.id('outreachDrafts')),
    runId: v.optional(v.id('pipelineRuns')),
    snapshot: v.optional(
      v.object({ subject: v.string(), text: v.string(), html: v.string() }),
    ),
    scheduledFunctionId: v.optional(v.id('_scheduled_functions')),
    claimedAt: v.optional(v.string()),
    /** Address actually used (differs from `to` under GMAIL_REDIRECT_TO). */
    actualTo: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    sentAt: v.optional(v.string()),
    error: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
    /** Self-addressed smoke test: excluded from ledgers and roll-ups. */
    isTest: v.optional(v.boolean()),
    // Legacy Outlook-draft fields.
    outlookDraftId: v.optional(v.string()),
    draftedAt: v.optional(v.string()),
  })
    .index('by_company', ['companyId'])
    .index('by_batch', ['batchId'])
    .index('by_status', ['status'])
    .index('by_normalizedEmail', ['normalizedEmail']),
  /**
   * Immutable record of every message Gmail accepted (or that a human
   * confirmed after an uncertain outcome). Never deleted by cleanup.
   */
  sentEmails: defineTable({
    queueItemId: v.id('sendQueue'),
    companyId: v.string(),
    companyName: v.string(),
    companyDomain: v.string(),
    intendedTo: v.string(),
    actualTo: v.string(),
    redirected: v.boolean(),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
    sentAt: v.string(),
    providerMessageId: v.optional(v.string()),
    acceptance: v.union(
      v.literal('smtp-accepted'),
      v.literal('manually-confirmed'),
    ),
    runId: v.optional(v.id('pipelineRuns')),
    isTest: v.boolean(),
    /** A bounce notice for this message arrived in the Gmail inbox. */
    bouncedAt: v.optional(v.string()),
    bounceDetail: v.optional(v.string()),
    /** A reply referencing this message arrived in the Gmail inbox. */
    repliedAt: v.optional(v.string()),
  })
    .index('by_sentAt', ['sentAt'])
    .index('by_company', ['companyId']),
});
