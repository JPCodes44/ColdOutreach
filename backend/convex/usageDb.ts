import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { requireOperator } from './operator';
import { GEMINI_FREE_DAILY_LIMIT, nextPacificMidnightIso } from './pricing';

const providerValidator = v.union(
  v.literal('openai'),
  v.literal('deepseek'),
  v.literal('gemini'),
);

/** Read a numeric Convex env var (e.g. an initial top-up amount). */
function getEnvNumber(name: string): number | undefined {
  const env =
    (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {};
  const raw = env[name];
  if (raw === undefined || raw.length === 0) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Whether a stored free-counter reset boundary has elapsed (or is unset). */
function freeCounterExpired(freeResetAt: string | undefined): boolean {
  return freeResetAt === undefined || Date.now() >= Date.parse(freeResetAt);
}

interface BalancePatch {
  updatedAt: string;
  balanceUsd?: number;
  spentUsd?: number;
  freeRequestsRemaining?: number;
  freeResetAt?: string;
}

/**
 * Record the outcome of one model call against a provider's balance row.
 * Called by the generation/research actions after each API call finishes, which
 * makes the navbar's live `getBalances` query update reactively.
 *
 * - `deepseek`: overwrite `balanceUsd` with the polled real balance.
 * - `openai` / gemini paid: subtract the estimated `costUsd` (+ grounding).
 * - gemini free (`usedFreeGemini`): decrement the daily request counter.
 */
export const recordUsage = internalMutation({
  args: {
    provider: providerValidator,
    costUsd: v.optional(v.number()),
    groundingCostUsd: v.optional(v.number()),
    realBalanceUsd: v.optional(v.number()),
    usedFreeGemini: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('providerBalances')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .unique();

    const patch: BalancePatch = { updatedAt: new Date().toISOString() };

    if (args.provider === 'deepseek') {
      if (args.realBalanceUsd !== undefined) {
        patch.balanceUsd = args.realBalanceUsd;
      }
    } else if (args.provider === 'gemini' && args.usedFreeGemini === true) {
      const expired = freeCounterExpired(existing?.freeResetAt);
      const current = expired
        ? GEMINI_FREE_DAILY_LIMIT
        : (existing?.freeRequestsRemaining ?? GEMINI_FREE_DAILY_LIMIT);
      patch.freeRequestsRemaining = Math.max(0, current - 1);
      patch.freeResetAt = expired
        ? nextPacificMidnightIso()
        : existing?.freeResetAt;
    } else {
      // openai or gemini paid tier: always total the estimated spend, and
      // drain a remaining balance only once a starting balance is known (set
      // via setBalance or the *_BALANCE_USD env var), so it never goes
      // negative from an unknown start.
      const seedEnv =
        args.provider === 'openai'
          ? 'OPENAI_BALANCE_USD'
          : 'GEMINI_PAID_BALANCE_USD';
      const spend = (args.costUsd ?? 0) + (args.groundingCostUsd ?? 0);
      patch.spentUsd = (existing?.spentUsd ?? 0) + spend;
      const start = existing?.balanceUsd ?? getEnvNumber(seedEnv);
      if (start !== undefined) patch.balanceUsd = start - spend;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert('providerBalances', {
        provider: args.provider,
        ...patch,
      });
    }
  },
});

/**
 * The three balance indicators read by the navbar. DeepSeek/OpenAI report a
 * remaining-dollar figure; Gemini reports both its paid remaining dollars and
 * the free-key request counter (derived to full when the daily reset elapsed).
 */
export const getBalances = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const rows = await ctx.db.query('providerBalances').collect();
    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    const gemini = byProvider.get('gemini');
    const freeRemaining = freeCounterExpired(gemini?.freeResetAt)
      ? GEMINI_FREE_DAILY_LIMIT
      : (gemini?.freeRequestsRemaining ?? GEMINI_FREE_DAILY_LIMIT);

    return {
      openai: {
        balanceUsd: byProvider.get('openai')?.balanceUsd ?? null,
        spentUsd: byProvider.get('openai')?.spentUsd ?? 0,
      },
      deepseek: { balanceUsd: byProvider.get('deepseek')?.balanceUsd ?? null },
      gemini: {
        paidBalanceUsd: gemini?.balanceUsd ?? null,
        paidSpentUsd: gemini?.spentUsd ?? 0,
        freeRequestsRemaining: freeRemaining,
        freeLimit: GEMINI_FREE_DAILY_LIMIT,
      },
    };
  },
});

/**
 * Manually set a provider's remaining dollars — run after topping up credit to
 * re-anchor the estimate to reality, e.g.
 * `bunx convex run usageDb:setBalance '{"provider":"openai","balanceUsd":10}'`.
 */
export const setBalance = mutation({
  args: { provider: providerValidator, balanceUsd: v.number() },
  handler: async (ctx, { provider, balanceUsd }) => {
    await requireOperator(ctx);
    const existing = await ctx.db
      .query('providerBalances')
      .withIndex('by_provider', (q) => q.eq('provider', provider))
      .unique();
    const updatedAt = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { balanceUsd, updatedAt });
    } else {
      await ctx.db.insert('providerBalances', {
        provider,
        balanceUsd,
        updatedAt,
      });
    }
  },
});
