import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../convex/_generated/api';
import { signedInOperator } from './operatorHarness';

afterEach(() => vi.unstubAllEnvs());

describe('provider balance tracking', () => {
  it('totals spend without inventing a negative balance when no start is known', async () => {
    vi.stubEnv('OPENAI_BALANCE_USD', '');
    const t = await signedInOperator();
    await t.mutation(internal.usageDb.recordUsage, {
      provider: 'openai',
      costUsd: 0.25,
    });
    await t.mutation(internal.usageDb.recordUsage, {
      provider: 'openai',
      costUsd: 0.5,
    });
    const balances = await t.query(api.usageDb.getBalances, {});
    expect(balances.openai).toEqual({ balanceUsd: null, spentUsd: 0.75 });
  });

  it('drains a seeded or manually set balance', async () => {
    vi.stubEnv('OPENAI_BALANCE_USD', '10');
    const t = await signedInOperator();
    await t.mutation(internal.usageDb.recordUsage, {
      provider: 'openai',
      costUsd: 1,
    });
    expect((await t.query(api.usageDb.getBalances, {})).openai.balanceUsd).toBe(
      9,
    );
    await t.mutation(api.usageDb.setBalance, {
      provider: 'openai',
      balanceUsd: 20,
    });
    await t.mutation(internal.usageDb.recordUsage, {
      provider: 'openai',
      costUsd: 2,
    });
    expect((await t.query(api.usageDb.getBalances, {})).openai).toEqual({
      balanceUsd: 18,
      spentUsd: 3,
    });
  });

  it('migrates old negative balances into spend totals', async () => {
    const t = await signedInOperator();
    await t.run((ctx) =>
      ctx.db.insert('providerBalances', {
        provider: 'openai',
        balanceUsd: -0.04,
        updatedAt: '2026-10-14T00:00:00.000Z',
      }),
    );
    await expect(
      t.mutation(internal.migrations.convertUnseededBalances, {}),
    ).resolves.toEqual({ converted: 1 });
    expect((await t.query(api.usageDb.getBalances, {})).openai).toEqual({
      balanceUsd: null,
      spentUsd: 0.04,
    });
  });
});

describe('removeRehearsalLedgerEntries', () => {
  it('drops ledger rows created only by a redirected send, once', async () => {
    const t = await signedInOperator();
    const sentAt = '2026-10-15T03:37:59.533Z';
    await t.run(async (ctx) => {
      const queueItemId = await ctx.db.insert('sendQueue', {
        batchId: 'b',
        companyId: 'pete.test',
        company: 'Pete',
        to: 'verification@example.com',
        subject: 's',
        status: 'sent',
        scheduledAt: sentAt,
        createdAt: sentAt,
      });
      await ctx.db.insert('sentEmails', {
        queueItemId,
        companyId: 'pete.test',
        companyName: 'Pete',
        companyDomain: 'pete.test',
        intendedTo: 'verification@example.com',
        actualTo: 'me@inbox.test',
        redirected: true,
        subject: 's',
        text: 't',
        html: 'h',
        sentAt,
        acceptance: 'smtp-accepted',
        isTest: false,
      });
      await ctx.db.insert('emailedCompanies', {
        normalizedDomain: 'pete.test',
        domain: 'pete.test',
        name: 'Pete',
        firstSentAt: sentAt,
        lastSentAt: sentAt,
        sentCount: 1,
      });
      await ctx.db.insert('emailedRecipients', {
        normalizedEmail: 'verification@example.com',
        email: 'verification@example.com',
        companyDomain: 'pete.test',
        companyName: 'Pete',
        firstContactedAt: sentAt,
        lastContactedAt: sentAt,
        contactCount: 1,
      });
      // A real contact elsewhere stays untouched.
      await ctx.db.insert('emailedCompanies', {
        normalizedDomain: 'real.test',
        domain: 'real.test',
        name: 'Real',
        firstSentAt: sentAt,
        lastSentAt: sentAt,
        sentCount: 1,
      });
    });
    await expect(
      t.mutation(internal.migrations.removeRehearsalLedgerEntries, {}),
    ).resolves.toEqual({ companies: 1, recipients: 1 });
    await expect(
      t.mutation(internal.migrations.removeRehearsalLedgerEntries, {}),
    ).resolves.toEqual({ companies: 0, recipients: 0 });
    const left = await t.run((ctx) =>
      ctx.db.query('emailedCompanies').collect(),
    );
    expect(left.map((row) => row.normalizedDomain)).toEqual(['real.test']);
  });
});
