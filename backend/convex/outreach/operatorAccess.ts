// Single-operator access control: only addresses listed in ALLOWED_EMAILS may
// sign up, sign in, or call any public function. An unset or empty list denies
// everyone (fail closed).

/** Normalize an email for comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse a comma/whitespace-separated allowlist. */
export function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (raw === undefined) return new Set();
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map(normalizeEmail)
      .filter((email) => email.length > 0),
  );
}

export function isAllowedEmail(
  email: string | undefined,
  raw: string | undefined,
): boolean {
  if (email === undefined || email.trim().length === 0) return false;
  return parseAllowedEmails(raw).has(normalizeEmail(email));
}

export const SIGN_IN_REQUIRED = 'Sign in required.';
export const NOT_AUTHORIZED =
  'This account is not authorized to use ColdOutreach.';
