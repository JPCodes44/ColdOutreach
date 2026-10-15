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
