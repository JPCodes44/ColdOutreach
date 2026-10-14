'use node';

import { v } from 'convex/values';
import nodemailer from 'nodemailer';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { dispatchQueueItem, type MailMessage } from './outreach/dispatch';

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    // ECONFIG marks this as a definite failure: nothing was sent to Gmail.
    throw Object.assign(
      new Error(`${name} is not configured in the Convex environment.`),
      { code: 'ECONFIG' },
    );
  }
  return value;
}

function secrets(): (string | undefined)[] {
  return [
    process.env.GMAIL_APP_PASSWORD,
    process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_PAID,
  ];
}

async function sendGmailMail(message: MailMessage) {
  const user = env('GMAIL_USER');
  const pass = env('GMAIL_APP_PASSWORD').replace(/\s/g, '');
  const fromName = process.env.GMAIL_FROM?.trim();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
  const info = await transporter.sendMail({
    from: fromName ? { name: fromName, address: user } : user,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

/**
 * Scheduled dispatcher for one queue row. Convex owns the schedule; the row
 * is claimed atomically before Gmail is contacted, so it is sent at most once.
 */
export const processQueueItem = internalAction({
  args: { itemId: v.id('sendQueue') },
  handler: async (ctx, { itemId }) => {
    const outcome = await dispatchQueueItem({
      redirectTo: process.env.GMAIL_REDIRECT_TO,
      secrets: secrets(),
      claim: (actualTo) =>
        ctx.runMutation(internal.send.claimQueueItem, {
          itemId,
          ...(actualTo !== undefined ? { actualTo } : {}),
        }),
      sendMail: sendGmailMail,
      markSent: (providerMessageId) =>
        ctx.runMutation(internal.send.markQueueItemSent, {
          itemId,
          ...(providerMessageId !== undefined ? { providerMessageId } : {}),
        }),
      markFailed: (error) =>
        ctx.runMutation(internal.send.markQueueItemFailed, { itemId, error }),
      markUncertain: (error) =>
        ctx.runMutation(internal.send.markQueueItemUncertain, {
          itemId,
          error,
        }),
    });
    console.log(`Queue item ${itemId}: ${outcome}`);
  },
});

/**
 * Smoke test: queue the company's current draft, clearly labeled, to the
 * configured GMAIL_USER inbox only. Run from the CLI:
 * `bunx convex run sendActions:sendSelfTest '{"companyId":"..."}'`
 */
export const sendSelfTest = internalAction({
  args: { companyId: v.string() },
  handler: async (ctx, { companyId }): Promise<{ itemId: Id<'sendQueue'> }> => {
    const itemId = await ctx.runMutation(internal.send.enqueueSelfTest, {
      companyId,
      to: env('GMAIL_USER'),
    });
    return { itemId };
  },
});
