import { v } from 'convex/values';
import {
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server';
import { requireOperator } from './operator';
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  normalizeSettingsInput,
  type OutreachSettings,
} from './outreach/settingsModel';

/** The newest saved Settings version, or the built-in defaults (version 0). */
export async function loadCurrentSettings(
  ctx: QueryCtx,
): Promise<OutreachSettings> {
  const latest = await ctx.db
    .query('outreachSettings')
    .withIndex('by_version')
    .order('desc')
    .first();
  if (latest === null) return DEFAULT_SETTINGS;
  return {
    version: latest.version,
    niche: latest.niche,
    offer: latest.offer,
    senderName: latest.senderName,
    signature: latest.signature,
    customInstructions: latest.customInstructions,
  };
}

const settingsResult = v.object({
  version: v.number(),
  niche: v.string(),
  offer: v.string(),
  senderName: v.string(),
  signature: v.string(),
  customInstructions: v.string(),
  updatedAt: v.union(v.string(), v.null()),
  limits: v.object({
    niche: v.number(),
    offer: v.number(),
    senderName: v.number(),
    signature: v.number(),
    customInstructions: v.number(),
  }),
});

/** Current outreach Settings for the Settings screen (never includes secrets). */
export const get = query({
  args: {},
  returns: settingsResult,
  handler: async (ctx) => {
    await requireOperator(ctx);
    const current = await loadCurrentSettings(ctx);
    const row = await ctx.db
      .query('outreachSettings')
      .withIndex('by_version', (q) => q.eq('version', current.version))
      .unique();
    return {
      ...current,
      updatedAt: row?.createdAt ?? null,
      limits: SETTINGS_LIMITS,
    };
  },
});

/** Save a new Settings version. Affects future pipeline runs only. */
export const save = mutation({
  args: {
    niche: v.string(),
    offer: v.string(),
    senderName: v.string(),
    signature: v.string(),
    customInstructions: v.string(),
  },
  returns: v.object({ version: v.number() }),
  handler: async (ctx, args) => {
    await requireOperator(ctx);
    const normalized = normalizeSettingsInput(args);
    const current = await loadCurrentSettings(ctx);
    const version = current.version + 1;
    await ctx.db.insert('outreachSettings', {
      ...normalized,
      version,
      createdAt: new Date().toISOString(),
    });
    return { version };
  },
});

/** Settings snapshot for server-side use (company research). */
export const current = internalQuery({
  args: {},
  handler: async (ctx) => loadCurrentSettings(ctx),
});
