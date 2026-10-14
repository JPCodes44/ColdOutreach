/**
 * Shared utilities for normalization, escaping, and time handling.
 */

/** Escape the five characters that are unsafe in HTML text/attribute context. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert a display name into a URL/file-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Strip a surrounding markdown code fence from model output, when present. */
export function stripMarkdownCodeFence(text: string, language = ''): string {
  const languagePattern = language.length > 0 ? language : '[a-z0-9_-]*';
  return text
    .replace(new RegExp(`^\\s*\`\`\`(?:${languagePattern})?\\s*\\n?`, 'i'), '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/** Canonicalize company domains for equality checks across discovery + sends. */
export function normalizeCompanyDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return '';

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const host = new URL(withProtocol).hostname;
    return host.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]!
      .split(':')[0]!
      .replace(/^www\./, '')
      .replace(/\.$/, '');
  }
}

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonicalize and validate a recipient email address for duplicate checks. */
export function normalizeEmailAddress(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return EMAIL_ADDRESS_PATTERN.test(normalized) ? normalized : null;
}

/** Trim a string list and keep only non-empty values. */
export function nonEmptyStrings(values: (string | undefined)[]): string[] {
  return values
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);
}

/** Offset (ms) to add to a UTC instant to get the wall-clock time in `tz`. */
export function timeZoneOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - date.getTime();
}

/** Convert a wall-clock date+time in `tz` to a UTC timestamp in milliseconds. */
export function zonedWallTimeToUtcMs(
  date: string,
  time: string,
  tz: string,
): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guessUtc = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
  );
  return guessUtc - timeZoneOffsetMs(new Date(guessUtc), tz);
}

/** Current time as an ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}
