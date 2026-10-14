import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  nonEmptyStrings,
  normalizeCompanyDomain,
  normalizeEmailAddress,
  nowIso,
  slugify,
  stripMarkdownCodeFence,
  timeZoneOffsetMs,
  zonedWallTimeToUtcMs,
} from './utils';

describe('escapeHtml', () => {
  it('escapes unsafe characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world');
  });

  it('collapses runs of separators', () => {
    expect(slugify('A -- B__C')).toBe('a-b-c');
  });
});

describe('stripMarkdownCodeFence', () => {
  it('strips a surrounding fenced block', () => {
    expect(stripMarkdownCodeFence('```json\n{"ok":true}\n```')).toBe(
      '{"ok":true}',
    );
  });

  it('can restrict the accepted language label', () => {
    expect(stripMarkdownCodeFence('```latex\nx\n```', 'latex|tex')).toBe('x');
  });
});

describe('normalizeCompanyDomain', () => {
  it('normalizes protocol, casing, www prefix, and paths', () => {
    expect(normalizeCompanyDomain(' HTTPS://WWW.Acme.com/careers ')).toBe(
      'acme.com',
    );
  });

  it('removes ports and trailing dots', () => {
    expect(normalizeCompanyDomain('example.com.:443/jobs')).toBe('example.com');
  });

  it('returns an empty key for blank input', () => {
    expect(normalizeCompanyDomain('   ')).toBe('');
  });
});

describe('normalizeEmailAddress', () => {
  it('trims and lowercases valid recipient addresses', () => {
    expect(normalizeEmailAddress(' Hiring@Acme.COM ')).toBe('hiring@acme.com');
  });

  it('rejects blank and malformed recipient addresses', () => {
    expect(normalizeEmailAddress('   ')).toBeNull();
    expect(normalizeEmailAddress('missing-domain@')).toBeNull();
    expect(normalizeEmailAddress('@missing-local.test')).toBeNull();
    expect(normalizeEmailAddress('not an email')).toBeNull();
  });
});

describe('nonEmptyStrings', () => {
  it('trims and filters non-empty strings', () => {
    expect(nonEmptyStrings([' a ', undefined, '', 'b'])).toEqual(['a', 'b']);
  });
});

describe('timezone helpers', () => {
  it('converts UTC wall time without an offset', () => {
    expect(zonedWallTimeToUtcMs('2026-01-02', '03:04', 'UTC')).toBe(
      Date.UTC(2026, 0, 2, 3, 4),
    );
  });

  it('computes a stable UTC timezone offset', () => {
    expect(timeZoneOffsetMs(new Date('2026-01-01T00:00:00.000Z'), 'UTC')).toBe(
      0,
    );
  });
});

describe('nowIso', () => {
  it('returns a valid ISO timestamp', () => {
    expect(() => new Date(nowIso()).toISOString()).not.toThrow();
  });
});
