import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, internalQuery } from './_generated/server';
import { requireOperatorAction } from './operator';

/** How far back sent emails are watched for bounces and replies. */
export const WATCH_DAYS = 14;

/** Sent (non-test) emails recent enough to watch. */
export const watchedSentEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = new Date(
      Date.now() - WATCH_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const rows = await ctx.db
      .query('sentEmails')
      .withIndex('by_sentAt', (q) => q.gte('sentAt', since))
      .collect();
    return rows
      .filter((row) => !row.isTest)
      .map((row) => ({
        id: row._id,
        providerMessageId: row.providerMessageId,
        actualTo: row.actualTo,
        sentAt: row.sentAt,
      }));
  },
});

/** Store detected bounces/replies; the first detection of each kind wins. */
export const recordDeliverySignals = internalMutation({
  args: {
    signals: v.array(
      v.object({
        sentId: v.id('sentEmails'),
        kind: v.union(v.literal('bounced'), v.literal('replied')),
        at: v.string(),
        detail: v.string(),
      }),
    ),
  },
  returns: v.object({ bounced: v.number(), replied: v.number() }),
  handler: async (ctx, { signals }) => {
    let bounced = 0;
    let replied = 0;
    for (const signal of signals) {
      const row = await ctx.db.get(signal.sentId);
      if (row === null) continue;
      if (signal.kind === 'bounced' && row.bouncedAt === undefined) {
        await ctx.db.patch(row._id, {
          bouncedAt: signal.at,
          bounceDetail: signal.detail.slice(0, 200),
        });
        bounced += 1;
      }
      if (signal.kind === 'replied' && row.repliedAt === undefined) {
        await ctx.db.patch(row._id, { repliedAt: signal.at });
        replied += 1;
      }
    }
    return { bounced, replied };
  },
});

/** Check the Gmail inbox for bounces and replies now (History button). */
export const checkNow = action({
  args: {},
  handler: async (ctx): Promise<{ bounced: number; replied: number }> => {
    await requireOperatorAction(ctx);
    return ctx.runAction(internal.mailbox.checkMailbox, {});
  },
});
