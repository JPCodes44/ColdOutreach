import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import {
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
  type QueryCtx,
} from './_generated/server';
import {
  NOT_AUTHORIZED,
  SIGN_IN_REQUIRED,
  isAllowedEmail,
  normalizeEmail,
} from './outreach/operatorAccess';

/**
 * Every public query and mutation calls this first. Throws unless the caller
 * is signed in with an address on the ALLOWED_EMAILS allowlist.
 */
export async function requireOperator(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  const user = await ctx.db.get(userId);
  if (
    user === null ||
    !isAllowedEmail(user.email, process.env.ALLOWED_EMAILS)
  ) {
    throw new Error(NOT_AUTHORIZED);
  }
  return user;
}

/**
 * Same check for public actions. The identity is read in the action itself
 * and the allowlist is checked against that user's stored email.
 */
export async function requireOperatorAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  const allowed = await ctx.runQuery(internal.operator.isOperator, { userId });
  if (!allowed) throw new Error(NOT_AUTHORIZED);
}

export const isOperator = internalQuery({
  args: { userId: v.id('users') },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return (
      user !== null && isAllowedEmail(user.email, process.env.ALLOWED_EMAILS)
    );
  },
});

/** Who is signed in and whether they may use the app (never throws). */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ email: v.string(), authorized: v.boolean() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    const email = user.email ?? '';
    return {
      email,
      authorized: isAllowedEmail(email, process.env.ALLOWED_EMAILS),
    };
  },
});

/**
 * Revoke an account: delete the user, its password login, sessions, and
 * refresh tokens. Run from the CLI, e.g.
 * `bunx convex run operator:removeAccount '{"email":"old@example.com"}'`.
 * Removing the address from ALLOWED_EMAILS also blocks it immediately.
 */
export const removeAccount = internalMutation({
  args: { email: v.string() },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', normalizeEmail(email)))
      .unique();
    if (user === null) return { removed: false };
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', user._id))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    await ctx.db.delete(user._id);
    return { removed: true };
  },
});
