import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../convex/_generated/api';
import { signedInOperator } from './operatorHarness';

const company = {
  externalId: 'acme.test',
  name: 'Acme',
  domain: 'acme.test',
  initial: 'A',
  industry: 'Food',
  location: 'Canada',
  size: '50',
  techStack: [],
  confidence: 90,
  confidenceTone: 'positive' as const,
  createdAt: '2026-10-17T00:00:00Z',
};
const contact = {
  slot: 'email1' as const,
  apolloId: 'boss',
  name: 'Boss',
  title: 'CEO',
  email: 'boss@acme.test',
  role: 'management' as const,
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('recipient persistence', () => {
  it('locks concurrent requests and preserves emails edited during an enrichment', async () => {
    const t = await signedInOperator();
    await t.run((ctx) => ctx.db.insert('companies', company));
    await t.mutation(internal.recipientEnrichment.begin, {
      companyId: company.externalId,
      token: 'one',
    });
    await expect(
      t.mutation(internal.recipientEnrichment.begin, {
        companyId: company.externalId,
        token: 'two',
      }),
    ).rejects.toThrow('already running');
    await t.mutation(api.emails.setEmailRow, {
      companyId: company.externalId,
      email1: 'manual@acme.test',
    });
    const result = await t.mutation(internal.recipientEnrichment.finish, {
      companyId: company.externalId,
      token: 'one',
      contacts: [
        contact,
        {
          ...contact,
          slot: 'email2',
          apolloId: 'second',
          email: 'other@acme.test',
        },
      ],
      creditsConsumed: 2,
    });
    expect(result.filled).toBe(1);
    const saved = await t.run((ctx) => ctx.db.query('companies').first());
    expect(saved).toMatchObject({
      email1: 'manual@acme.test',
      email2: 'other@acme.test',
      recipientEnrichment: { status: 'done', creditsConsumed: 2 },
    });
    expect(saved?.apolloContacts).toHaveLength(1);
  });
  it('rejects stale completions and duplicate emails', async () => {
    const t = await signedInOperator();
    await t.run((ctx) =>
      ctx.db.insert('companies', { ...company, email2: 'boss@acme.test' }),
    );
    await t.mutation(internal.recipientEnrichment.begin, {
      companyId: company.externalId,
      token: 'current',
    });
    expect(
      (
        await t.mutation(internal.recipientEnrichment.finish, {
          companyId: company.externalId,
          token: 'stale',
          contacts: [contact],
        })
      ).filled,
    ).toBe(0);
    expect(
      (
        await t.mutation(internal.recipientEnrichment.finish, {
          companyId: company.externalId,
          token: 'current',
          contacts: [contact],
        })
      ).filled,
    ).toBe(0);
  });
  it('requires server credentials without making a provider request', async () => {
    const t = await signedInOperator();
    vi.stubEnv('APOLLO_API_KEY', '');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      t.action(api.recipientEnrichment.fillEmails, {
        companyId: company.externalId,
        targetTitles: ['process engineer'],
      }),
    ).rejects.toThrow('Set APOLLO_API_KEY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('persists authenticated provider results and ignores partial matches', async () => {
    const t = await signedInOperator();
    await t.run((ctx) =>
      ctx.db.insert('companies', {
        ...company,
        email2: 'existing@acme.test',
        email3: 'employee@acme.test',
      }),
    );
    vi.stubEnv('APOLLO_API_KEY', 'fake-key');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ people: [{ id: 'boss', has_email: true }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            matches: [
              {
                id: 'boss',
                name: 'Boss',
                title: 'CEO',
                seniority: 'c_suite',
                email: 'boss@acme.test',
                email_status: 'verified',
                organization: { primary_domain: 'acme.test' },
              },
            ],
            credits_consumed: 1,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(
      (
        await t.action(api.recipientEnrichment.fillEmails, {
          companyId: company.externalId,
          targetTitles: ['process engineer'],
        })
      ).filled,
    ).toBe(1);
    expect(
      (await t.query(api.emails.listEmailTableRows, {}))[0]?.contacts,
    ).toMatchObject([{ email: 'boss@acme.test', title: 'CEO' }]);
  });
});
