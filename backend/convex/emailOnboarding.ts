import { normalizeEmailAddress } from '@emailstrat/common';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireOperator } from './operator';

/** The signed-in account's onboarding address; does not verify mailbox access. */
export const get = query({
  args: {},
  returns: v.union(v.null(), v.object({ email: v.string() })),
  handler: async (ctx) => {
    const user = await requireOperator(ctx);
    const saved = await ctx.db
      .query('emailOnboarding')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    return saved ? { email: saved.email } : null;
  },
});

/** Save an onboarding address without collecting credentials or connecting mail. */
export const save = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireOperator(ctx);
    const email = normalizeEmailAddress(args.email);
    if (email === null || email.length > 254) {
      throw new Error('Enter a valid email address (up to 254 characters).');
    }
    const saved = await ctx.db
      .query('emailOnboarding')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    const values = { email, updatedAt: new Date().toISOString() };
    if (saved) {
      await ctx.db.patch(saved._id, values);
    } else {
      await ctx.db.insert('emailOnboarding', { userId: user._id, ...values });
    }
    return null;
  },
});
