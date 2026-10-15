// Detect bounces and replies for sent outreach by matching inbox messages to
// sent Message-IDs. Pure and runtime-agnostic: the Node action supplies the
// raw headers/bodies read over IMAP. Only a status and a short reason are kept.

export interface InboxMessage {
  from: string;
  date: string;
  /** Raw RFC 5322 header block. */
  headers: string;
  /** Raw message source; fetched only for bounce notices. */
  source?: string;
}

export interface SentRef {
  id: string;
  providerMessageId?: string;
  actualTo: string;
  sentAt: string;
}

export interface DeliverySignal {
  sentId: string;
  kind: 'bounced' | 'replied';
  at: string;
  detail: string;
}

const BOUNCE_SENDER =
  /mailer-daemon|postmaster|mail delivery (?:subsystem|system)/i;
const MESSAGE_ID = /<[^<>\s@]+@[^<>\s]+>/g;
/** How long after a send a recipient-only bounce match is trusted. */
const BOUNCE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Parse a raw header block into lower-cased names (folded lines joined). */
export function parseHeaders(raw: string): Map<string, string[]> {
  const headers = new Map<string, string[]>();
  const unfolded = raw.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ');
  for (const line of unfolded.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers.set(name, [...(headers.get(name) ?? []), value]);
  }
  return headers;
}

export function normalizeMessageId(id: string): string {
  const trimmed = id.trim().toLowerCase();
  return trimmed.startsWith('<') ? trimmed : `<${trimmed}>`;
}

function messageIds(text: string): string[] {
  return [...text.matchAll(MESSAGE_ID)].map((match) =>
    normalizeMessageId(match[0]),
  );
}

export function isBounceNotice(message: InboxMessage): boolean {
  return BOUNCE_SENDER.test(message.from);
}

export interface ParsedBounce {
  /** Message-IDs quoted in the bounce (the original message's among them). */
  messageIds: string[];
  failedRecipients: string[];
  diagnostic: string;
}

/** Extract what a bounce notice says about the original message. */
export function parseBounce(message: InboxMessage): ParsedBounce {
  const headers = parseHeaders(message.headers);
  const ownId = (headers.get('message-id') ?? []).flatMap(messageIds);
  const source = (message.source ?? '').replace(/\r\n/g, '\n');
  const failed = new Set<string>();
  for (const value of headers.get('x-failed-recipients') ?? []) {
    for (const address of value.split(',')) {
      if (address.trim()) failed.add(address.trim().toLowerCase());
    }
  }
  for (const match of source.matchAll(
    /^(?:Final|Original)-Recipient:\s*rfc822;\s*(\S+)/gim,
  )) {
    failed.add(match[1]!.toLowerCase());
  }
  const diagnosticMatch =
    /^Diagnostic-Code:\s*(?:smtp;\s*)?(.+(?:\n[ \t].+)*)/im.exec(source) ??
    /The response (?:from the remote server )?was:\s*\n+\s*(.+)/i.exec(source);
  const diagnostic = (diagnosticMatch?.[1] ?? 'Delivery failed.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return {
    messageIds: messageIds(source).filter((id) => !ownId.includes(id)),
    failedRecipients: [...failed],
    diagnostic,
  };
}

/**
 * Match inbox messages to sent emails. A bounce matches by the quoted
 * Message-ID, or failing that by recipient within a few days after the send
 * (the most recent matching send). A reply matches by In-Reply-To/References.
 */
export function matchDeliverySignals(
  messages: InboxMessage[],
  sent: SentRef[],
): DeliverySignal[] {
  const byMessageId = new Map<string, SentRef>();
  for (const ref of sent) {
    if (ref.providerMessageId) {
      byMessageId.set(normalizeMessageId(ref.providerMessageId), ref);
    }
  }
  const signals = new Map<string, DeliverySignal>();
  const record = (signal: DeliverySignal) => {
    const key = `${signal.sentId}:${signal.kind}`;
    if (!signals.has(key)) signals.set(key, signal);
  };

  for (const message of messages) {
    const at = new Date(message.date).toISOString();
    if (isBounceNotice(message)) {
      const bounce = parseBounce(message);
      let target = bounce.messageIds
        .map((id) => byMessageId.get(id))
        .find((ref) => ref !== undefined);
      if (target === undefined) {
        const bouncedAt = Date.parse(at);
        target = sent
          .filter(
            (ref) =>
              bounce.failedRecipients.includes(ref.actualTo.toLowerCase()) &&
              Date.parse(ref.sentAt) <= bouncedAt &&
              bouncedAt - Date.parse(ref.sentAt) <= BOUNCE_WINDOW_MS,
          )
          .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
      }
      if (target !== undefined) {
        record({
          sentId: target.id,
          kind: 'bounced',
          at,
          detail: bounce.diagnostic,
        });
      }
      continue;
    }
    const headers = parseHeaders(message.headers);
    const referenced = [
      ...(headers.get('in-reply-to') ?? []),
      ...(headers.get('references') ?? []),
    ].flatMap(messageIds);
    for (const id of referenced) {
      const target = byMessageId.get(id);
      if (target !== undefined) {
        record({ sentId: target.id, kind: 'replied', at, detail: '' });
        break;
      }
    }
  }
  return [...signals.values()];
}
