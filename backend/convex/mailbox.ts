'use node';

import { ImapFlow } from 'imapflow';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  imapSinceDate,
  isBounceNotice,
  matchDeliverySignals,
  type InboxMessage,
} from './outreach/mailboxSignals';
import { redactSecrets } from './outreach/smtpOutcome';

/** Newest inbox messages inspected per check. */
const MAX_MESSAGES = 300;
const MAX_BOUNCE_BYTES = 200_000;

/**
 * Read recent Gmail inbox headers over IMAP (with the same app password used
 * for sending) and record bounces and replies to sent outreach. Message
 * contents are never stored; only a status and a short bounce reason.
 */
export const checkMailbox = internalAction({
  args: {},
  handler: async (ctx): Promise<{ bounced: number; replied: number }> => {
    const user = process.env.GMAIL_USER?.trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.trim();
    if (!user || !pass) return { bounced: 0, replied: 0 };
    const sent = await ctx.runQuery(internal.delivery.watchedSentEmails, {});
    if (sent.length === 0) return { bounced: 0, replied: 0 };
    const since = imapSinceDate(sent.map((row) => row.sentAt));

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });
    const messages: InboxMessage[] = [];
    const uidOf = new Map<InboxMessage, number>();
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const found = await client.search({ since }, { uid: true });
        const uids = (found || []).slice(-MAX_MESSAGES);
        if (uids.length > 0) {
          for await (const message of client.fetch(
            uids,
            {
              envelope: true,
              internalDate: true,
              headers: [
                'message-id',
                'in-reply-to',
                'references',
                'x-failed-recipients',
              ],
            },
            { uid: true },
          )) {
            const from = (message.envelope?.from ?? [])
              .map((entry) => `${entry.name ?? ''} <${entry.address ?? ''}>`)
              .join(', ');
            const date = message.internalDate ?? message.envelope?.date;
            const inbox: InboxMessage = {
              from,
              date: new Date(date ?? Date.now()).toISOString(),
              headers: message.headers?.toString('utf8') ?? '',
            };
            messages.push(inbox);
            uidOf.set(inbox, message.uid);
          }
          for (const message of messages) {
            if (!isBounceNotice(message)) continue;
            const full = await client.fetchOne(
              String(uidOf.get(message)),
              { source: { start: 0, maxLength: MAX_BOUNCE_BYTES } },
              { uid: true },
            );
            message.source = full ? (full.source?.toString('utf8') ?? '') : '';
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (error) {
      client.close();
      const reason = redactSecrets(
        error instanceof Error ? error.message : 'IMAP error',
        [pass, user],
      );
      throw new Error(`Could not check the Gmail inbox: ${reason}`);
    }

    const signals = matchDeliverySignals(messages, sent);
    return ctx.runMutation(internal.delivery.recordDeliverySignals, {
      signals: signals.map((signal) => ({
        ...signal,
        sentId: signal.sentId as Id<'sentEmails'>,
      })),
    });
  },
});
