// One queued email's dispatch: claim -> Gmail SMTP -> record outcome.
// Persistence and transport are injected; see sendActions.ts for the wiring.

import { classifySmtpError, describeSmtpError } from './smtpOutcome';

export interface ClaimedSend {
  to: string;
  actualTo: string;
  snapshot: { subject: string; text: string; html: string };
  isTest: boolean;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  messageId?: string;
  accepted: unknown[];
  rejected: unknown[];
}

export interface DispatchDeps {
  /** Optional test inbox; when set, mail goes there instead of `to`. */
  redirectTo?: string;
  /** Configured credential values to redact from stored errors. */
  secrets: (string | undefined)[];
  claim: (actualTo: string | undefined) => Promise<ClaimedSend | null>;
  sendMail: (message: MailMessage) => Promise<MailResult>;
  markSent: (providerMessageId: string | undefined) => Promise<unknown>;
  markFailed: (error: string) => Promise<unknown>;
  markUncertain: (error: string) => Promise<unknown>;
}

export type DispatchOutcome = 'skipped' | 'sent' | 'failed' | 'uncertain';

/** Apply the test-recipient redirect, labeling the message with its intended recipient. */
export function redirectedMessage(claim: ClaimedSend): MailMessage {
  const { snapshot } = claim;
  if (claim.actualTo.trim().toLowerCase() === claim.to.trim().toLowerCase()) {
    return { to: claim.actualTo, ...snapshot };
  }
  const note = `Redirected test send. Intended recipient: ${claim.to}`;
  return {
    to: claim.actualTo,
    subject: `[Redirected for ${claim.to}] ${snapshot.subject}`,
    text: `${note}\n\n${snapshot.text}`,
    html: snapshot.html.replace(
      /<body([^>]*)>/,
      `<body$1><p style="font-family:Arial,sans-serif;font-size:13px;background:#fff4e5;color:#7a3e00;padding:10px 16px;margin:0;">${note
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`,
    ),
  };
}

/**
 * Dispatch one queue row exactly once. Only an SMTP acceptance marks it sent;
 * definite rejections release it as failed; anything ambiguous is held as
 * uncertain for review and never retried automatically.
 */
export async function dispatchQueueItem(
  deps: DispatchDeps,
): Promise<DispatchOutcome> {
  const redirect = deps.redirectTo?.trim();
  const claim = await deps.claim(
    redirect !== undefined && redirect.length > 0 ? redirect : undefined,
  );
  if (claim === null) return 'skipped';

  let result: MailResult;
  try {
    result = await deps.sendMail(redirectedMessage(claim));
  } catch (error) {
    const message = describeSmtpError(error, deps.secrets);
    if (classifySmtpError(error) === 'failed') {
      await deps.markFailed(message);
      return 'failed';
    }
    await deps.markUncertain(
      `Connection ended without a clear Gmail response (${message}). Check the Gmail Sent folder before resolving.`,
    );
    return 'uncertain';
  }

  if (result.accepted.length === 0) {
    await deps.markFailed(
      `Gmail did not accept the recipient (${result.rejected.length} rejected).`,
    );
    return 'failed';
  }
  await deps.markSent(result.messageId);
  return 'sent';
}
