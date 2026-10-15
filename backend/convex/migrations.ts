import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { refreshCompanyStatus } from './send';

/**
 * Inventory of legacy job-application data, for inspection before rollout:
 * `bunx convex run migrations:legacyInventory`.
 */
export const legacyInventory = internalQuery({
  args: {},
  returns: v.object({
    artifacts: v.number(),
    activeArtifacts: v.number(),
    pendingLegacySends: v.number(),
  }),
  handler: async (ctx) => {
    const artifacts = await ctx.db.query('artifacts').collect();
    const queue = await ctx.db.query('sendQueue').collect();
    return {
      artifacts: artifacts.length,
      activeArtifacts: artifacts.filter((row) => row.obsoleteAt === undefined)
        .length,
      pendingLegacySends: queue.filter(
        (row) =>
          row.snapshot === undefined &&
          (row.status === 'queued' || row.status === 'drafted'),
      ).length,
    };
  },
});

/**
 * Retire job-application data without deleting history: mark legacy
 * artifacts obsolete and block any queued/drafted legacy sends (rows without
 * an approved snapshot) so they surface as needing regeneration. Idempotent.
 * `bunx convex run migrations:retireLegacyJobData`.
 */
export const retireLegacyJobData = internalMutation({
  args: {},
  returns: v.object({ artifactsRetired: v.number(), sendsBlocked: v.number() }),
  handler: async (ctx) => {
    const now = new Date().toISOString();
    let artifactsRetired = 0;
    for (const artifact of await ctx.db.query('artifacts').collect()) {
      if (artifact.obsoleteAt !== undefined) continue;
      await ctx.db.patch(artifact._id, { obsoleteAt: now });
      artifactsRetired += 1;
    }

    let sendsBlocked = 0;
    const companies = new Set<string>();
    for (const row of await ctx.db.query('sendQueue').collect()) {
      if (row.snapshot !== undefined) continue;
      if (row.status !== 'queued' && row.status !== 'drafted') continue;
      await ctx.db.patch(row._id, {
        status: 'legacy-blocked',
        error:
          'Legacy job-application draft blocked by migration. Regenerate and approve a new outreach draft.',
      });
      if (row.scheduledFunctionId !== undefined) {
        const scheduled = await ctx.db.system.get(row.scheduledFunctionId);
        if (scheduled?.state.kind === 'pending') {
          await ctx.scheduler.cancel(row.scheduledFunctionId);
        }
      }
      companies.add(row.companyId);
      sendsBlocked += 1;
    }
    for (const companyId of companies) {
      await refreshCompanyStatus(ctx, companyId);
    }
    return { artifactsRetired, sendsBlocked };
  },
});

/**
 * Older trackers drained a balance that started at an unknown (zero) value,
 * leaving negative "balances". Convert those into spend totals:
 * `bunx convex run migrations:convertUnseededBalances`.
 */
export const convertUnseededBalances = internalMutation({
  args: {},
  returns: v.object({ converted: v.number() }),
  handler: async (ctx) => {
    let converted = 0;
    for (const row of await ctx.db.query('providerBalances').collect()) {
      if (row.provider === 'deepseek') continue;
      if (row.balanceUsd === undefined || row.balanceUsd >= 0) continue;
      await ctx.db.patch(row._id, {
        balanceUsd: undefined,
        spentUsd: (row.spentUsd ?? 0) - row.balanceUsd,
      });
      converted += 1;
    }
    return { converted };
  },
});
