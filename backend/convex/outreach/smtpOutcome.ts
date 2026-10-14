// Classify SMTP errors so a message is retried only when we know Gmail did not
// accept it. Anything ambiguous needs a human decision, never a blind resend.

export type SmtpFailureKind = 'failed' | 'uncertain';

interface SmtpErrorShape {
  code?: unknown;
  command?: unknown;
  responseCode?: unknown;
  message?: unknown;
}

/** Commands that complete before any message content is transmitted. */
const PRE_DATA_COMMAND =
  /^(CONN|EHLO|HELO|LHLO|STARTTLS|AUTH\b.*|MAIL FROM|RCPT TO)$/i;

/** Error codes nodemailer raises before message transmission begins. */
const PRE_DATA_CODES = new Set([
  'EAUTH',
  'ENOAUTH',
  'ECONFIG',
  'EENVELOPE',
  'EDNS',
  'ETLS',
  'EMESSAGE',
]);

/**
 * `failed`: Gmail definitely did not accept the message (rejected it, or the
 * session failed before message data was sent), so the recipient reservation
 * can be released. `uncertain`: the connection broke while or after sending
 * message data, so Gmail may have accepted it.
 */
export function classifySmtpError(error: unknown): SmtpFailureKind {
  if (typeof error !== 'object' || error === null) return 'uncertain';
  const shape = error as SmtpErrorShape;
  const responseCode =
    typeof shape.responseCode === 'number' ? shape.responseCode : undefined;
  const command = typeof shape.command === 'string' ? shape.command.trim() : '';
  const code = typeof shape.code === 'string' ? shape.code : '';

  // An explicit 4xx/5xx reply means the server refused this message.
  if (responseCode !== undefined && responseCode >= 400 && responseCode < 600)
    return 'failed';
  if (PRE_DATA_CODES.has(code)) return 'failed';
  if (command.length > 0 && PRE_DATA_COMMAND.test(command)) return 'failed';
  return 'uncertain';
}

/** Remove configured credential values from an error message before storing it. */
export function redactSecrets(
  message: string,
  secrets: (string | undefined)[],
): string {
  let redacted = message;
  for (const secret of secrets) {
    const value = secret?.trim();
    if (value === undefined || value.length < 4) continue;
    redacted = redacted.split(value).join('[redacted]');
    const compact = value.replace(/\s/g, '');
    if (compact !== value && compact.length >= 4) {
      redacted = redacted.split(compact).join('[redacted]');
    }
  }
  return redacted.length > 500 ? `${redacted.slice(0, 497)}...` : redacted;
}

/** A short, storable description of an SMTP error. */
export function describeSmtpError(
  error: unknown,
  secrets: (string | undefined)[],
): string {
  const shape = (
    typeof error === 'object' && error !== null ? error : {}
  ) as SmtpErrorShape;
  const parts = [
    typeof shape.code === 'string' ? shape.code : '',
    typeof shape.responseCode === 'number' ? String(shape.responseCode) : '',
    typeof shape.message === 'string'
      ? shape.message
      : error instanceof Error
        ? error.message
        : 'Unknown Gmail error',
  ].filter((part) => part.length > 0);
  return redactSecrets(parts.join(' '), secrets);
}
