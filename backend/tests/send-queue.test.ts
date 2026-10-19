import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import type { OutreachEmailContent } from '@emailstrat/common';

import { signedInOperator } from './operatorHarness';

const CONTENT: OutreachEmailContent = {
  subject: 'An idea for Acme inquiries',
  opening:
    'Hi Acme team,\n\nI noticed your contact page lists only a phone number.',
  findings: [
    {
      text: 'Phone number is the main contact path.',
      sourceUrl: 'https://acme.test/',
    },
  ],
  workflow: [{ name: 'Capture', description: 'Short form on key pages.' }],
  dashboard: {
    title: 'Lead overview',
    metrics: [{ label: 'New inquiries', description: 'Captured leads.' }],
    stages: ['New', 'Contacted'],
  },
  closing: 'Would a quick sketch be useful?',
  signature: 'Sam',
};

const EVIDENCE = {
  sources: [
    {
      url: 'https://acme.test/',
      title: 'Acme',
      fetchedAt: '2026-10-14T00:00:00.000Z',
    },
  ],
  facts: [
    {
      id: 'E1',
      kind: 'contact',
      sourceUrl: 'https://acme.test/',
      text: 'Phone listed.',
    },
  ],
  skipped: [],
};

const ANALYSIS = {
  businessSummary: 'Acme.',
  observations: [{ text: 'Phone listed.', evidenceIds: ['E1'] }],
  opportunities: [
    {
      title: 'Form',
      observation: 'Phone only.',
      evidenceIds: ['E1'],
      hypothesis: 'Maybe.',
      suggestedImprovement: 'Add form.',
    },
  ],
  proposedWorkflow: CONTENT.workflow,
  dashboard: CONTENT.dashboard,
  droppedCount: 0,
};

type T = Awaited<ReturnType<typeof setup>>;

function setup() {
  return signedInOperator();
}

async function addCompany(
  t: T,
  id: string,
  emails: string[] = [`owner@${id}`],
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('companies', {
      externalId: id,
      name: id.split('.')[0]!.toUpperCase(),
      domain: id,
      initial: id[0]!.toUpperCase(),
      industry: 'Services',
      location: 'Springfield',
      size: '10',
      techStack: [],
      confidence: 90,
      confidenceTone: 'positive',
      email1: emails[0],
      email2: emails[1],
      email3: emails[2],
      createdAt: '2026-10-14T00:00:00.000Z',
    });
  });
}

/** Start a run through the public API and complete it with fixed outputs. */
async function generate(
  t: T,
  companyId: string,
  content: OutreachEmailContent = CONTENT,
) {
  const result = await t.mutation(api.outreachRuns.requestRuns, {
    companyIds: [companyId],
    websiteReviewEnabled: true,
    regenerate: true,
  });
  expect(result.started).toEqual([companyId]);
  const run = await t.run((ctx) =>
    ctx.db
      .query('pipelineRuns')
      .withIndex('by_company', (q) => q.eq('companyId', companyId))
      .order('desc')
      .first(),
  );
  await t.mutation(internal.outreachRuns.completeRun, {
    runId: run!._id,
    evidence: EVIDENCE,
    analysis: ANALYSIS,
    content,
    model: 'test-model',
  });
  return run!._id;
}

async function approved(t: T, companyId: string) {
  await addCompany(t, companyId);
  await generate(t, companyId);
  await t.mutation(api.outreachRuns.approveDraft, { companyId });
}

async function queueRows(t: T) {
  return t.run((ctx) => ctx.db.query('sendQueue').collect());
}

async function enqueue(t: T, companyIds: string[]) {
  return t.mutation(api.send.enqueueSend, {
    companyIds,
    scheduledAtMs: Date.now() + 60_000,
    method: 'immediate',
  });
}

beforeEach(() => {
  // Scheduled functions must never fire on their own in tests (no real
  // pipeline runs or SMTP connections); tests invoke steps explicitly.
  vi.useFakeTimers();
  vi.stubEnv('GMAIL_USER', '');
  vi.stubEnv('GMAIL_APP_PASSWORD', '');
  vi.stubEnv('GMAIL_REDIRECT_TO', '');
  vi.stubEnv('OPENAI_API_KEY', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('settings', () => {
  it('starts from defaults and saves immutable versions', async () => {
    const t = await setup();
    expect((await t.query(api.settings.get, {})).version).toBe(0);
    const input = {
      niche: 'Dental clinics',
      offer: 'Lead automation',
      senderName: 'Sam',
      signature: 'Rivera',
      customInstructions: 'Be brief.',
    };
    expect(await t.mutation(api.settings.save, input)).toEqual({ version: 1 });
    expect(
      await t.mutation(api.settings.save, { ...input, niche: 'Vets' }),
    ).toEqual({ version: 2 });
    const current = await t.query(api.settings.get, {});
    expect(current).toMatchObject({
      version: 2,
      niche: 'Vets',
      customInstructions: 'Be brief.',
    });
    await expect(
      t.mutation(api.settings.save, {
        ...input,
        offer: 'sk-abcdefghijklmnopqrstuvwx',
      }),
    ).rejects.toThrow(/credential/);
    const versions = await t.run((ctx) =>
      ctx.db.query('outreachSettings').collect(),
    );
    expect(versions.map((row) => row.niche)).toEqual([
      'Dental clinics',
      'Vets',
    ]);
  });
});

describe('pipeline runs and drafts', () => {
  it('carries researched descriptions into drafting and refreshes them on reimport', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    const row = await t.run((ctx) => ctx.db.query('companies').first());
    const input = {
      externalId: row!.externalId,
      name: row!.name,
      domain: row!.domain,
      initial: row!.initial,
      industry: row!.industry,
      location: row!.location,
      size: row!.size,
      techStack: row!.techStack,
      confidence: row!.confidence,
      confidenceTone: row!.confidenceTone,
      description: 'Processes oats and pulses into ingredients.',
    };
    await t.run((ctx) =>
      ctx.db.patch(row!._id, { segment: 'Exclusively vegan' }),
    );
    await t.mutation(api.companies.importCompanies, { companies: [input] });
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
    });
    const run = await t.run((ctx) => ctx.db.query('pipelineRuns').first());
    const loaded = await t.query(internal.outreachRuns.loadRunInput, {
      runId: run!._id,
    });
    expect(loaded!.company.description).toBe(input.description);
    expect(loaded!.company).not.toHaveProperty('segment');
    const rows = await t.query(api.outreachRuns.listPipelineCompanies, {});
    expect(rows[0]!.description).toBe(input.description);
    expect(rows[0]!.segment).toBeNull();
  });

  it('snapshots website-review mode and loads saved company research for the action', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
    });
    const runs = await t.run((ctx) => ctx.db.query('pipelineRuns').collect());
    expect(runs[0]!.websiteReviewEnabled).toBe(false);
    const input = await t.query(internal.outreachRuns.loadRunInput, {
      runId: runs[0]!._id,
    });
    expect(input).toMatchObject({
      websiteReviewEnabled: false,
      company: { size: '10', techStack: [] },
    });
    await addCompany(t, 'default.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['default.test'],
    });
    const defaultRun = await t.run((ctx) =>
      ctx.db
        .query('pipelineRuns')
        .withIndex('by_company', (q) => q.eq('companyId', 'default.test'))
        .first(),
    );
    expect(defaultRun!.websiteReviewEnabled).toBe(false);
  });

  it('checks research-only approval against the stored research context', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
    });
    const run = await t.run((ctx) => ctx.db.query('pipelineRuns').first());
    const content = {
      ...CONTENT,
      opening: 'Hello 24 Hours Dental team,',
      findings: [],
    };
    await t.mutation(internal.outreachRuns.completeRun, {
      runId: run!._id,
      evidence: {
        sources: [],
        facts: [],
        skipped: [],
        excerpts: [],
        researchContext: JSON.stringify({ name: '24 Hours Dental' }),
      },
      analysis: { ...ANALYSIS, observations: [], opportunities: [] },
      content,
      model: 'test-model',
    });
    await t.mutation(api.outreachRuns.approveDraft, { companyId: 'acme.test' });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft?.status).toBe('approved');
    expect(review?.draft?.websiteReviewEnabled).toBe(false);
    expect(review?.evidence?.researchContext).toContain('24 Hours Dental');
  });

  it('labels table rows with the mode of the displayed run or retained draft', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    const rows = () => t.query(api.outreachRuns.listPipelineCompanies, {});
    expect((await rows())[0]!.websiteReviewEnabled).toBeNull();
    await generate(t, 'acme.test');
    expect((await rows())[0]).toMatchObject({
      draftState: 'ready',
      websiteReviewEnabled: true,
    });
    // Older runs without the mode field are website reviews too.
    const oldRun = await t.run((ctx) => ctx.db.query('pipelineRuns').first());
    await t.run((ctx) =>
      ctx.db.patch(oldRun!._id, { websiteReviewEnabled: undefined }),
    );
    expect((await rows())[0]!.websiteReviewEnabled).toBe(true);
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
      regenerate: true,
    });
    expect((await rows())[0]).toMatchObject({
      draftState: 'running',
      websiteReviewEnabled: false,
    });
    const latest = await t.run((ctx) =>
      ctx.db.query('pipelineRuns').order('desc').first(),
    );
    await t.mutation(internal.outreachRuns.failRun, {
      runId: latest!._id,
      error: 'Generation failed.',
    });
    expect((await rows())[0]).toMatchObject({
      draftState: 'ready',
      websiteReviewEnabled: true,
    });
    await addCompany(t, 'failed.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['failed.test'],
      websiteReviewEnabled: false,
    });
    const failed = await t.run((ctx) =>
      ctx.db
        .query('pipelineRuns')
        .withIndex('by_company', (q) => q.eq('companyId', 'failed.test'))
        .first(),
    );
    await t.mutation(internal.outreachRuns.failRun, {
      runId: failed!._id,
      error: 'Generation failed.',
    });
    expect(
      (await rows()).find((row) => row.id === 'failed.test'),
    ).toMatchObject({ draftState: 'failed', websiteReviewEnabled: false });
  });

  it.each(['ready', 'approved'] as const)(
    'skips a company with a %s draft while starting missing drafts',
    async (status) => {
      const t = await setup();
      await addCompany(t, 'done.test');
      await generate(t, 'done.test');
      if (status === 'approved') {
        await t.mutation(api.outreachRuns.approveDraft, {
          companyId: 'done.test',
        });
      }
      await addCompany(t, 'new.test');
      const before = await t.query(api.outreachRuns.getReview, {
        companyId: 'done.test',
      });
      const result = await t.mutation(api.outreachRuns.requestRuns, {
        companyIds: ['done.test', 'new.test'],
      });
      expect(result).toEqual({
        started: ['new.test'],
        skipped: [
          {
            companyId: 'done.test',
            reason:
              'A draft already exists. Use Regenerate in Review to replace it.',
          },
        ],
      });
      expect(
        await t.query(api.outreachRuns.getReview, { companyId: 'done.test' }),
      ).toEqual(before);
      expect(
        await t.run((ctx) => ctx.db.query('pipelineRuns').collect()),
      ).toHaveLength(2);
      expect(
        await t.run((ctx) =>
          ctx.db.system.query('_scheduled_functions').collect(),
        ),
      ).toHaveLength(2);
    },
  );

  it('regenerates only on explicit request and still refuses active duplicates', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test');
    const request = { companyIds: ['acme.test'], regenerate: true };
    expect(await t.mutation(api.outreachRuns.requestRuns, request)).toEqual({
      started: ['acme.test'],
      skipped: [],
    });
    expect(await t.mutation(api.outreachRuns.requestRuns, request)).toEqual({
      started: [],
      skipped: [
        { companyId: 'acme.test', reason: 'A run is already in progress.' },
      ],
    });
    expect(
      await t.run((ctx) => ctx.db.query('pipelineRuns').collect()),
    ).toHaveLength(2);
  });

  it('skips an existing draft even when the latest regeneration failed', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test');
    await t.run(async (ctx) => {
      const completed = await ctx.db.query('pipelineRuns').first();
      await ctx.db.insert('pipelineRuns', {
        companyId: 'acme.test',
        status: 'failed',
        stage: 'composing',
        settings: completed!.settings,
        startedAt: Date.now() + 1,
        finishedAt: Date.now() + 2,
        error: 'Provider error',
      });
    });
    const result = await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
    });
    expect(result.started).toEqual([]);
    expect(result.skipped).toEqual([
      {
        companyId: 'acme.test',
        reason:
          'A draft already exists. Use Regenerate in Review to replace it.',
      },
    ]);
    expect(
      await t.run((ctx) => ctx.db.query('pipelineRuns').collect()),
    ).toHaveLength(2);
  });

  it('queues more than ten companies with one independent job per eligible company', async () => {
    const t = await setup();
    const companyIds = Array.from({ length: 25 }, (_, i) => `batch${i}.test`);
    for (const id of companyIds) await addCompany(t, id);
    await addCompany(t, 'busy.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['busy.test'],
    });

    const result = await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: [...companyIds, companyIds[0]!, 'busy.test', 'missing.test'],
      websiteReviewEnabled: true,
    });
    expect(result).toEqual({
      started: companyIds,
      skipped: [
        { companyId: 'busy.test', reason: 'A run is already in progress.' },
        { companyId: 'missing.test', reason: 'Company not found.' },
      ],
    });
    const runs = await t.run((ctx) => ctx.db.query('pipelineRuns').collect());
    expect(runs).toHaveLength(26);
    for (const companyId of companyIds) {
      expect(runs.filter((run) => run.companyId === companyId)).toEqual([
        expect.objectContaining({
          status: 'running',
          stage: 'queued',
          websiteReviewEnabled: true,
        }),
      ]);
    }
    const jobs = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    );
    expect(jobs).toHaveLength(26);
    expect(new Set(jobs.map((job) => job.args[0].runId))).toEqual(
      new Set(runs.map((run) => run._id)),
    );
    expect(await queueRows(t)).toHaveLength(0);
  });

  it('snapshots the settings version and refuses a concurrent run', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await t.mutation(api.settings.save, {
      niche: 'N1',
      offer: 'O1',
      senderName: '',
      signature: '',
      customInstructions: '',
    });
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
    });
    const again = await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
    });
    expect(again).toEqual({
      started: [],
      skipped: [
        { companyId: 'acme.test', reason: 'A run is already in progress.' },
      ],
    });
    const runs = await t.run((ctx) => ctx.db.query('pipelineRuns').collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]!.settings).toMatchObject({ version: 1, niche: 'N1' });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draftState).toBe('running');
  });

  it('never lets an older run overwrite a newer draft', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    const settings = {
      version: 0,
      niche: 'n',
      offer: 'o',
      senderName: '',
      signature: '',
      customInstructions: '',
    };
    const [older, newer] = await t.run(async (ctx) => [
      await ctx.db.insert('pipelineRuns', {
        companyId: 'acme.test',
        status: 'running',
        stage: 'composing',
        settings,
        startedAt: Date.now() - 60_000,
      }),
      await ctx.db.insert('pipelineRuns', {
        companyId: 'acme.test',
        status: 'running',
        stage: 'composing',
        settings,
        startedAt: Date.now(),
      }),
    ]);
    const complete = (runId: Id<'pipelineRuns'>, subject: string) =>
      t.mutation(internal.outreachRuns.completeRun, {
        runId,
        evidence: EVIDENCE,
        analysis: ANALYSIS,
        content: { ...CONTENT, subject },
        model: 'm',
      });
    expect(await complete(newer, 'Newer')).toEqual({ appliedToDraft: true });
    expect(await complete(older, 'Older')).toEqual({ appliedToDraft: false });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft?.content.subject).toBe('Newer');
  });

  it('abandons a stale run, ignores its late result, and keeps the last draft on failure', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test', { ...CONTENT, subject: 'Good draft' });
    vi.setSystemTime(Date.now() + 1000);
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      regenerate: true,
    });
    const stuck = await t.run((ctx) =>
      ctx.db
        .query('pipelineRuns')
        .withIndex('by_company', (q) => q.eq('companyId', 'acme.test'))
        .order('desc')
        .first(),
    );
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      regenerate: true,
    });
    expect((await t.run((ctx) => ctx.db.get(stuck!._id)))?.status).toBe(
      'failed',
    );
    const late = await t.mutation(internal.outreachRuns.completeRun, {
      runId: stuck!._id,
      evidence: EVIDENCE,
      analysis: ANALYSIS,
      content: { ...CONTENT, subject: 'Late' },
      model: 'm',
    });
    expect(late).toEqual({ appliedToDraft: false });

    const latest = await t.run((ctx) =>
      ctx.db
        .query('pipelineRuns')
        .withIndex('by_company', (q) => q.eq('companyId', 'acme.test'))
        .order('desc')
        .first(),
    );
    await t.mutation(internal.outreachRuns.failRun, {
      runId: latest!._id,
      error: 'site down',
    });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft?.content.subject).toBe('Good draft');
    expect(review?.latestRun).toMatchObject({
      status: 'failed',
      error: 'site down',
    });
    expect(review?.draftState).toBe('ready');
  });

  it('withdraws approval when the draft is edited and validates edits', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await t.mutation(api.outreachRuns.saveDraftEdits, {
      companyId: 'acme.test',
      subject: 'Edited',
      opening: CONTENT.opening,
      closing: CONTENT.closing,
      signature: 'Sam',
    });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft).toMatchObject({ status: 'ready', approvedAt: null });
    await expect(
      t.mutation(api.outreachRuns.saveDraftEdits, {
        companyId: 'acme.test',
        subject: 'x',
        opening: 'y',
        closing: 'No question here.',
        signature: '',
      }),
    ).rejects.toThrow('question');
  });
});

describe('delete drafts', () => {
  it('deletes only selected drafts, preserving companies, recipients, research, and run history', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await approved(t, 'other.test');
    const company = await t.run((ctx) =>
      ctx.db
        .query('companies')
        .withIndex('by_externalId', (q) => q.eq('externalId', 'acme.test'))
        .unique(),
    );
    await t.run((ctx) =>
      ctx.db.patch(company!._id, {
        description: 'Manufactures food ingredients.',
      }),
    );
    const before = await t.run((ctx) => ctx.db.query('pipelineRuns').collect());
    expect(
      await t.mutation(api.outreachRuns.deleteDrafts, {
        companyIds: ['acme.test', 'acme.test', 'missing.test'],
      }),
    ).toEqual({ deleted: 1 });
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'acme.test' }))
        ?.draft,
    ).toBeNull();
    expect(
      (await t.query(api.outreachRuns.listPipelineCompanies, {})).find(
        (row) => row.id === 'acme.test',
      )?.draftState,
    ).toBe('none');
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'other.test' }))
        ?.draft,
    ).not.toBeNull();
    const kept = await t.run((ctx) => ctx.db.get(company!._id));
    expect(kept).toMatchObject({
      email1: 'owner@acme.test',
      description: 'Manufactures food ingredients.',
    });
    expect(
      await t.run((ctx) => ctx.db.query('pipelineRuns').collect()),
    ).toEqual(before);
    expect(
      await t.mutation(api.outreachRuns.deleteDrafts, {
        companyIds: ['acme.test'],
      }),
    ).toEqual({ deleted: 0 });
  });

  it('refuses the whole selection if a company has an active send', async () => {
    const t = await setup();
    await approved(t, 'free.test');
    await approved(t, 'queued.test');
    await enqueue(t, ['queued.test']);
    await expect(
      t.mutation(api.outreachRuns.deleteDrafts, {
        companyIds: ['free.test', 'queued.test'],
      }),
    ).rejects.toThrow(/sends queued/);
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'free.test' }))
        ?.draft,
    ).not.toBeNull();
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'queued.test' }))
        ?.draft,
    ).not.toBeNull();
  });

  it('refuses deletion during active generation', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      regenerate: true,
    });
    await expect(
      t.mutation(api.outreachRuns.deleteDrafts, { companyIds: ['acme.test'] }),
    ).rejects.toThrow(/generation is in progress/);
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'acme.test' }))
        ?.draft,
    ).not.toBeNull();
  });

  it('prevents an abandoned run from restoring a deleted draft', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    const completed = await t.run((ctx) =>
      ctx.db.query('pipelineRuns').first(),
    );
    const staleId = await t.run((ctx) =>
      ctx.db.insert('pipelineRuns', {
        companyId: 'acme.test',
        status: 'running',
        stage: 'composing',
        startedAt: Date.now() - 11 * 60 * 1000,
        settings: completed!.settings,
      }),
    );
    await t.mutation(api.outreachRuns.deleteDrafts, {
      companyIds: ['acme.test'],
    });
    expect(
      await t.mutation(internal.outreachRuns.completeRun, {
        runId: staleId,
        evidence: EVIDENCE,
        analysis: ANALYSIS,
        content: CONTENT,
        model: 'test-model',
      }),
    ).toEqual({ appliedToDraft: false });
    expect(
      (await t.query(api.outreachRuns.getReview, { companyId: 'acme.test' }))
        ?.draft,
    ).toBeNull();
  });
});

describe('research-only email format', () => {
  it('removes supplemental sections from existing drafts in review and future send snapshots', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await t.mutation(api.outreachRuns.requestRuns, {
      companyIds: ['acme.test'],
      websiteReviewEnabled: false,
    });
    const run = await t.run((ctx) => ctx.db.query('pipelineRuns').first());
    await t.mutation(internal.outreachRuns.completeRun, {
      runId: run!._id,
      evidence: EVIDENCE,
      analysis: ANALYSIS,
      content: CONTENT,
      model: 'test-model',
    });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft?.content).toMatchObject({
      format: 'letter',
      findings: [],
      workflow: [],
      dashboard: { metrics: [] },
      closing: CONTENT.closing,
      signature: CONTENT.signature,
    });
    await t.mutation(api.outreachRuns.approveDraft, { companyId: 'acme.test' });
    await enqueue(t, ['acme.test']);
    const rows = await queueRows(t);
    for (const body of [rows[0]!.snapshot!.text, rows[0]!.snapshot!.html]) {
      expect(body).not.toMatch(
        /ILLUSTRATIVE DASHBOARD|Illustrative dashboard|Proposed lead-response|PROPOSED LEAD-RESPONSE/,
      );
      expect(body).not.toContain(CONTENT.dashboard.title);
      expect(body).toContain(CONTENT.closing);
    }
  });
});

describe('approval checks', () => {
  it('refuses a draft without a signature', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test', { ...CONTENT, signature: '  ' });
    await expect(
      t.mutation(api.outreachRuns.approveDraft, { companyId: 'acme.test' }),
    ).rejects.toThrow('Add a signature before approving');
  });

  it('requires each flagged claim to be acknowledged, and records it', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test', {
      ...CONTENT,
      opening: 'Hi Acme,\n\nThis will boost your bookings by 30%.',
    });
    await expect(
      t.mutation(api.outreachRuns.approveDraft, { companyId: 'acme.test' }),
    ).rejects.toThrow('Confirm these claims are accurate');
    await expect(
      t.mutation(api.outreachRuns.approveDraft, {
        companyId: 'acme.test',
        acknowledgedClaims: ['30%'],
      }),
    ).rejects.toThrow('boost your bookings');
    await t.mutation(api.outreachRuns.approveDraft, {
      companyId: 'acme.test',
      acknowledgedClaims: ['boost your bookings', '30%'],
    });
    const review = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(review?.draft?.status).toBe('approved');
    expect(review?.draft?.acknowledgedClaims).toEqual([
      'boost your bookings',
      '30%',
    ]);

    await t.mutation(api.outreachRuns.unapproveDraft, {
      companyId: 'acme.test',
    });
    const after = await t.query(api.outreachRuns.getReview, {
      companyId: 'acme.test',
    });
    expect(after?.draft?.acknowledgedClaims).toEqual([]);
  });
});

describe('queueing saved drafts', () => {
  it('can schedule a generated draft after edits with no approval step', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test');
    await t.mutation(api.outreachRuns.saveDraftEdits, {
      companyId: 'acme.test',
      subject: 'My saved edits',
      opening: CONTENT.opening,
      closing: CONTENT.closing,
      signature: CONTENT.signature,
    });
    const summary = await t.query(api.send.getScheduleSummary, {
      companyIds: ['acme.test'],
    });
    expect(summary).toMatchObject({ readyDrafts: 1, totalEmailsQueued: 1 });
    expect(summary.entities[0]).toMatchObject({
      ready: true,
      draftState: 'ready',
    });
    await enqueue(t, ['acme.test']);
    expect((await queueRows(t))[0]!.snapshot!.subject).toBe('My saved edits');
  });

  it('blocks missing signatures and incomplete drafts without an approval gate', async () => {
    const t = await setup();
    await addCompany(t, 'no-signature.test');
    await generate(t, 'no-signature.test', { ...CONTENT, signature: '' });
    expect(
      (
        await t.query(api.send.getScheduleSummary, {
          companyIds: ['no-signature.test'],
        })
      ).entities[0],
    ).toMatchObject({ ready: false, notReadyReason: 'Missing signature' });
    await expect(enqueue(t, ['no-signature.test'])).rejects.toThrow(
      /signature before sending/,
    );
    await addCompany(t, 'incomplete.test');
    await generate(t, 'incomplete.test', { ...CONTENT, subject: '' });
    await expect(enqueue(t, ['incomplete.test'])).rejects.toThrow(
      /Subject is empty/,
    );
    expect(await queueRows(t)).toHaveLength(0);
  });

  it('requires a generated draft and valid recipients, without approval', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await expect(enqueue(t, ['acme.test'])).rejects.toThrow(
      'generate an outreach draft',
    );
    await generate(t, 'acme.test');
    await expect(enqueue(t, ['acme.test'])).resolves.toMatchObject({
      queued: 1,
    });
    await addCompany(t, 'bad.test', ['not-an-email']);
    await generate(t, 'bad.test');
    await t.mutation(api.outreachRuns.approveDraft, { companyId: 'bad.test' });
    await expect(enqueue(t, ['bad.test'])).rejects.toThrow('Invalid recipient');
    await addCompany(t, 'none.test', []);
    await expect(enqueue(t, ['none.test'])).rejects.toThrow('no recipient');
    expect(await queueRows(t)).toHaveLength(1);
  });

  it('keeps the queued content immutable after edits, regeneration, and Settings changes', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await enqueue(t, ['acme.test']);
    const [before] = await queueRows(t);
    expect(before!.snapshot!.subject).toBe('An idea for Acme inquiries');
    expect(before!.snapshot!.html).toContain('Illustrative dashboard concept');
    expect(before!.snapshot!.text).toContain('Would a quick sketch be useful?');

    await t.mutation(api.outreachRuns.saveDraftEdits, {
      companyId: 'acme.test',
      subject: 'Changed later',
      opening: 'Changed',
      closing: 'Changed?',
      signature: '',
    });
    await t.mutation(api.settings.save, {
      niche: 'Other',
      offer: 'Other',
      senderName: 'X',
      signature: '',
      customInstructions: '',
    });
    vi.setSystemTime(Date.now() + 1000);
    await generate(t, 'acme.test', { ...CONTENT, subject: 'Regenerated' });

    const [after] = await queueRows(t);
    expect(after!.snapshot).toEqual(before!.snapshot);
    expect(after!.subject).toBe('An idea for Acme inquiries');
  });

  it.each(['queued', 'sending', 'uncertain'] as const)(
    'excludes %s sends from readiness while allowing the other companies to queue',
    async (status) => {
      const t = await setup();
      await approved(t, 'acme.test');
      await enqueue(t, ['acme.test']);
      const original = (await queueRows(t))[0]!;
      if (status !== 'queued') {
        await t.mutation(internal.send.claimQueueItem, {
          itemId: original._id,
        });
      }
      if (status === 'uncertain') {
        await t.mutation(internal.send.markQueueItemUncertain, {
          itemId: original._id,
          error: 'Connection lost after submission',
        });
      }
      await approved(t, 'fresh.test');
      const summary = await t.query(api.send.getScheduleSummary, {
        companyIds: ['acme.test', 'fresh.test', 'fresh.test'],
      });
      expect(summary).toMatchObject({
        totalCompanies: 2,
        readyDrafts: 1,
        totalEmailsQueued: 1,
      });
      expect(summary.entities[0]).toMatchObject({
        ready: false,
        notReadyReason:
          'ACME already has outreach queued, sending, or awaiting review.',
      });
      expect(summary.entities[1]).toMatchObject({
        id: 'fresh.test',
        ready: true,
      });
      await enqueue(
        t,
        summary.entities
          .filter((entity) => entity.ready)
          .map((entity) => entity.id),
      );
      const after = await queueRows(t);
      expect(after).toHaveLength(2);
      expect(after.find((item) => item._id === original._id)?.status).toBe(
        status,
      );
    },
  );

  it('excludes previously contacted companies and recipients from the schedule preview', async () => {
    const t = await setup();
    await approved(t, 'sent.test');
    await enqueue(t, ['sent.test']);
    const item = (await queueRows(t))[0]!;
    await t.mutation(internal.send.claimQueueItem, { itemId: item._id });
    await t.mutation(internal.send.markQueueItemSent, { itemId: item._id });
    await addCompany(t, 'other.test', ['owner@sent.test']);
    await generate(t, 'other.test');
    const summary = await t.query(api.send.getScheduleSummary, {
      companyIds: ['sent.test', 'other.test'],
    });
    expect(summary).toMatchObject({ readyDrafts: 0, totalEmailsQueued: 0 });
    expect(summary.entities[0]).toMatchObject({
      ready: false,
      notReadyReason: 'Company already contacted: SENT',
    });
    expect(summary.entities[1]).toMatchObject({
      ready: false,
      notReadyReason: 'Recipient already contacted: owner@sent.test',
    });
  });

  it('excludes recipients reserved by another company and makes canceled sends eligible again', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await enqueue(t, ['acme.test']);
    await addCompany(t, 'other.test', ['owner@acme.test']);
    await generate(t, 'other.test');
    const summary = await t.query(api.send.getScheduleSummary, {
      companyIds: ['other.test'],
    });
    expect(summary.entities[0]).toMatchObject({
      ready: false,
      notReadyReason: 'Recipient already has a pending send: owner@acme.test',
    });
    await t.mutation(api.send.cancelScheduledSends, {
      companyIds: ['acme.test'],
    });
    const after = await t.query(api.send.getScheduleSummary, {
      companyIds: ['other.test'],
    });
    expect(after).toMatchObject({ readyDrafts: 1, totalEmailsQueued: 1 });
  });

  it('detects duplicate domains and addresses within the selected batch before enabling scheduling', async () => {
    const t = await setup();
    await approved(t, 'first.test');
    await addCompany(t, 'duplicate-domain.test');
    await generate(t, 'duplicate-domain.test');
    await t.run(async (ctx) => {
      const company = await ctx.db
        .query('companies')
        .withIndex('by_externalId', (q) =>
          q.eq('externalId', 'duplicate-domain.test'),
        )
        .unique();
      await ctx.db.patch(company!._id, { domain: 'first.test' });
    });
    await addCompany(t, 'duplicate-email.test', ['owner@first.test']);
    await generate(t, 'duplicate-email.test');
    const summary = await t.query(api.send.getScheduleSummary, {
      companyIds: [
        'first.test',
        'duplicate-domain.test',
        'duplicate-email.test',
      ],
    });
    expect(summary).toMatchObject({ readyDrafts: 1, totalEmailsQueued: 1 });
    expect(summary.entities[1]).toMatchObject({
      ready: false,
      notReadyReason: 'Company appears more than once: first.test',
    });
    expect(summary.entities[2]).toMatchObject({
      ready: false,
      notReadyReason: 'Duplicate recipient in batch: owner@first.test',
    });
    await expect(
      enqueue(
        t,
        summary.entities
          .filter((entity) => entity.ready)
          .map((entity) => entity.id),
      ),
    ).resolves.toMatchObject({ queued: 1 });
  });

  it('prevents duplicate queueing of a company or recipient', async () => {
    const t = await setup();
    await approved(t, 'acme.test');
    await enqueue(t, ['acme.test']);
    await expect(enqueue(t, ['acme.test'])).rejects.toThrow(
      'already has outreach queued',
    );

    await addCompany(t, 'beta.test', ['owner@acme.test']);
    await generate(t, 'beta.test');
    await t.mutation(api.outreachRuns.approveDraft, { companyId: 'beta.test' });
    await expect(enqueue(t, ['beta.test'])).rejects.toThrow(
      'already has a pending send',
    );
    expect(await queueRows(t)).toHaveLength(1);
  });
});

describe('dispatch outcomes', () => {
  async function queuedItem(t: T): Promise<Id<'sendQueue'>> {
    await approved(t, 'acme.test');
    await enqueue(t, ['acme.test']);
    return (await queueRows(t))[0]!._id;
  }

  it('keeps redirected rehearsal sends out of the contact ledgers', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    await t.mutation(internal.send.claimQueueItem, {
      itemId,
      actualTo: 'me@inbox.test',
    });
    await t.mutation(internal.send.markQueueItemSent, {
      itemId,
      providerMessageId: '<r1@gmail>',
    });
    const [sent] = await t.query(api.send.listSentEmails, {});
    expect(sent).toMatchObject({
      intendedTo: 'owner@acme.test',
      actualTo: 'me@inbox.test',
      redirected: true,
      isTest: false,
    });
    const ledgers = await t.run(async (ctx) => ({
      companies: await ctx.db.query('emailedCompanies').collect(),
      recipients: await ctx.db.query('emailedRecipients').collect(),
    }));
    expect(ledgers).toEqual({ companies: [], recipients: [] });
    await expect(
      t.mutation(api.send.purgeSettledCompanies, { companyIds: ['acme.test'] }),
    ).resolves.toEqual({ removed: 0 });
  });

  it('claims each row once so it can never be dispatched twice', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    const first = await t.mutation(internal.send.claimQueueItem, { itemId });
    const second = await t.mutation(internal.send.claimQueueItem, { itemId });
    expect(first?.snapshot.subject).toBe('An idea for Acme inquiries');
    expect(second).toBeNull();
  });

  it('records sent only after acceptance and preserves history through cleanup', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    // Not claimed yet: an acceptance report for an unclaimed row is ignored.
    await t.mutation(internal.send.markQueueItemSent, {
      itemId,
      providerMessageId: '<early>',
    });
    expect((await queueRows(t))[0]!.status).toBe('queued');

    await t.mutation(internal.send.claimQueueItem, { itemId });
    expect(await t.query(api.send.listSentEmails, {})).toEqual([]);
    await t.mutation(internal.send.markQueueItemSent, {
      itemId,
      providerMessageId: '<m1@gmail>',
    });

    const sent = await t.query(api.send.listSentEmails, {});
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      companyName: 'ACME',
      intendedTo: 'owner@acme.test',
      actualTo: 'owner@acme.test',
      redirected: false,
      acceptance: 'smtp-accepted',
      providerMessageId: '<m1@gmail>',
      isTest: false,
    });
    const company = await t.run((ctx) =>
      ctx.db
        .query('companies')
        .withIndex('by_externalId', (q) => q.eq('externalId', 'acme.test'))
        .unique(),
    );
    expect(company?.emailStatus).toBe('Sent');

    await t.mutation(api.send.purgeSettledCompanies, {
      companyIds: ['acme.test'],
    });
    expect(await queueRows(t)).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query('companies').collect()),
    ).toHaveLength(0);
    const kept = await t.query(api.send.getSentEmail, { id: sent[0]!.id });
    expect(kept?.text).toContain('Would a quick sketch be useful?');
    expect(kept?.html).toContain('Illustrative dashboard concept');

    // The ledgers keep the recipient and company from being contacted again.
    await approved(t, 'acme.test');
    await expect(enqueue(t, ['acme.test'])).rejects.toThrow(
      'Company already contacted',
    );
  });

  it('releases the reservation on a definite failure without recording a send', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    await t.mutation(internal.send.claimQueueItem, { itemId });
    await t.mutation(internal.send.markQueueItemFailed, {
      itemId,
      error: 'EAUTH 535',
    });
    expect((await queueRows(t))[0]).toMatchObject({
      status: 'failed',
      error: 'EAUTH 535',
    });
    expect(await t.query(api.send.listSentEmails, {})).toEqual([]);
    await expect(enqueue(t, ['acme.test'])).resolves.toMatchObject({
      queued: 1,
    });
  });

  it('holds uncertain outcomes until a human resolves them', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    await t.mutation(internal.send.claimQueueItem, { itemId });
    await t.mutation(internal.send.markQueueItemUncertain, {
      itemId,
      error: 'timeout after DATA',
    });
    await expect(enqueue(t, ['acme.test'])).rejects.toThrow('awaiting review');
    expect(
      (await t.query(api.outreachRuns.listPipelineCompanies, {}))[0]!
        .sendStatus,
    ).toBe('Needs Review');

    await t.mutation(api.send.resolveUncertainSend, {
      itemId,
      outcome: 'sent',
    });
    const sent = await t.query(api.send.listSentEmails, {});
    expect(sent[0]).toMatchObject({
      acceptance: 'manually-confirmed',
      providerMessageId: null,
    });
    await expect(
      t.mutation(api.send.resolveUncertainSend, {
        itemId,
        outcome: 'not-sent',
      }),
    ).rejects.toThrow();
  });

  it('frees the recipient when an uncertain send is confirmed not sent', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    await t.mutation(internal.send.claimQueueItem, { itemId });
    await t.mutation(internal.send.markQueueItemUncertain, {
      itemId,
      error: 'socket closed',
    });
    await t.mutation(api.send.resolveUncertainSend, {
      itemId,
      outcome: 'not-sent',
    });
    expect((await queueRows(t))[0]!.status).toBe('failed');
    expect(await t.query(api.send.listSentEmails, {})).toEqual([]);
    await expect(enqueue(t, ['acme.test'])).resolves.toMatchObject({
      queued: 1,
    });
  });

  it('cancels queued sends so they cannot be claimed', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    expect(
      await t.mutation(api.send.cancelScheduledSends, {
        companyIds: ['acme.test'],
      }),
    ).toEqual({ canceled: 1 });
    expect(
      await t.mutation(internal.send.claimQueueItem, { itemId }),
    ).toBeNull();
    expect((await queueRows(t))[0]!.status).toBe('canceled');
    await expect(
      t.mutation(api.send.cancelQueueItem, { itemId }),
    ).rejects.toThrow();
  });

  it('treats missing Gmail configuration as a definite failure (real dispatcher, no network)', async () => {
    const t = await setup();
    const itemId = await queuedItem(t);
    await t.action(internal.sendActions.processQueueItem, { itemId });
    const [row] = await queueRows(t);
    expect(row).toMatchObject({ status: 'failed' });
    expect(row!.error).toContain('GMAIL_USER is not configured');
    expect(await t.query(api.send.listSentEmails, {})).toEqual([]);
  });

  it('refuses to delete a company with sends in flight', async () => {
    const t = await setup();
    await queuedItem(t);
    await expect(
      t.mutation(api.companies.deleteCompanies, { externalIds: ['acme.test'] }),
    ).rejects.toThrow('Cancel or resolve them first');
  });
});

describe('self-test sends', () => {
  it('are labeled and excluded from ledgers and company status', async () => {
    const t = await setup();
    await addCompany(t, 'acme.test');
    await generate(t, 'acme.test');
    const itemId = await t.mutation(internal.send.enqueueSelfTest, {
      companyId: 'acme.test',
      to: 'me@sender.test',
    });
    const claim = await t.mutation(internal.send.claimQueueItem, { itemId });
    expect(claim?.snapshot.subject).toMatch(/^\[ColdOutreach self-test\] /);
    expect(claim?.snapshot.text).toMatch(
      /^SELF-TEST: sent only to the sender's own inbox/,
    );
    await t.mutation(internal.send.markQueueItemSent, { itemId });
    expect((await t.query(api.send.listSentEmails, {}))[0]).toMatchObject({
      isTest: true,
      actualTo: 'me@sender.test',
    });
    expect(
      await t.run((ctx) => ctx.db.query('emailedRecipients').collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query('emailedCompanies').collect()),
    ).toHaveLength(0);
    // A real outreach can still be queued for the prospect afterwards.
    await t.mutation(api.outreachRuns.approveDraft, { companyId: 'acme.test' });
    await expect(enqueue(t, ['acme.test'])).resolves.toMatchObject({
      queued: 1,
    });
  });
});

describe('legacy job-application data', () => {
  it('blocks legacy queued rows and marks old artifacts obsolete', async () => {
    const t = await setup();
    await addCompany(t, 'old.test');
    const legacyId = await t.run(async (ctx) => {
      await ctx.db.insert('artifacts', {
        companyId: 'old.test',
        emailTemplate: 'I would love to apply for engineering roles...',
        resumeLatex: '\\documentclass{article}',
        status: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await ctx.db.insert('sendQueue', {
        batchId: 'legacy',
        companyId: 'old.test',
        company: 'OLD',
        to: 'hr@old.test',
        subject: 'Engineering roles',
        status: 'drafted',
        scheduledAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      return ctx.db.insert('sendQueue', {
        batchId: 'legacy',
        companyId: 'old.test',
        company: 'OLD',
        to: 'jobs@old.test',
        subject: 'Engineering roles',
        status: 'queued',
        scheduledAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(
      (await t.query(api.outreachRuns.listPipelineCompanies, {}))[0]!
        .draftState,
    ).toBe('legacy');
    expect(await t.query(internal.migrations.legacyInventory, {})).toEqual({
      artifacts: 1,
      activeArtifacts: 1,
      pendingLegacySends: 2,
    });

    // Even before migration, the dispatcher refuses a row without a snapshot.
    expect(
      await t.mutation(internal.send.claimQueueItem, { itemId: legacyId }),
    ).toBeNull();
    expect(
      await t.mutation(internal.migrations.retireLegacyJobData, {}),
    ).toEqual({ artifactsRetired: 1, sendsBlocked: 1 });
    expect(
      await t.mutation(internal.migrations.retireLegacyJobData, {}),
    ).toEqual({ artifactsRetired: 0, sendsBlocked: 0 });
    const statuses = (await queueRows(t)).map((row) => row.status).sort();
    expect(statuses).toEqual(['legacy-blocked', 'legacy-blocked']);
    expect(await t.query(api.send.listSentEmails, {})).toEqual([]);
    // Legacy drafts are never offered for sending.
    await expect(enqueue(t, ['old.test'])).rejects.toThrow(
      'generate an outreach draft',
    );
  });
});

describe('purgeTestHistory', () => {
  it('removes self-tests and named canceled rows but keeps real history', async () => {
    const t = await setup();
    const base = {
      batchId: 'b',
      companyId: 'acme.test',
      company: 'ACME',
      subject: 's',
      scheduledAt: '2026-10-14T00:00:00.000Z',
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    await t.run(async (ctx) => {
      const testRow = await ctx.db.insert('sendQueue', {
        ...base,
        to: 'me@self.test',
        status: 'sent',
        isTest: true,
      });
      await ctx.db.insert('sendQueue', {
        ...base,
        to: 'verification@example.com',
        status: 'canceled',
      });
      const realRow = await ctx.db.insert('sendQueue', {
        ...base,
        to: 'owner@acme.test',
        status: 'sent',
      });
      const sent = {
        companyId: 'acme.test',
        companyName: 'ACME',
        companyDomain: 'acme.test',
        actualTo: 'x',
        intendedTo: 'x',
        redirected: false,
        subject: 's',
        text: 't',
        html: 'h',
        sentAt: '2026-10-14T00:00:00.000Z',
        acceptance: 'smtp-accepted' as const,
      };
      await ctx.db.insert('sentEmails', {
        ...sent,
        queueItemId: testRow,
        isTest: true,
      });
      await ctx.db.insert('sentEmails', {
        ...sent,
        queueItemId: realRow,
        isTest: false,
      });
    });
    await expect(
      t.mutation(internal.send.purgeTestHistory, {
        canceledRecipients: ['Verification@example.com'],
      }),
    ).resolves.toEqual({ queueRows: 2, sentEmails: 1 });
    const remaining = await t.run(async (ctx) => ({
      queue: (await ctx.db.query('sendQueue').collect()).map((r) => r.to),
      sent: (await ctx.db.query('sentEmails').collect()).map((r) => r.isTest),
    }));
    expect(remaining).toEqual({ queue: ['owner@acme.test'], sent: [false] });
  });
});
