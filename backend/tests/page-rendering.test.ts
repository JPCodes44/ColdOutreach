import { describe, expect, it } from 'vitest';
import {
  FIRECRAWL_SCRAPE_URL,
  firecrawlRenderer,
} from '../convex/outreach/pageRenderer';
import {
  collectWebsiteEvidence,
  type FetchLike,
  type RenderPage,
  type RetrievalDeps,
} from '../convex/outreach/websiteEvidence';

const SHELL = `<html><head><title></title></head><body><div id="root"></div>
<script src="/app.js"></script></body></html>`;

const RENDERED = `<html><head><title>Northside Plumbing</title></head><body>
<h1>Emergency plumbing in Northside</h1>
<p>Call (555) 222-3333 any time. Request a free quote online.</p>
<form><input name="name" placeholder="Name"><input type="email" name="email">
<button type="submit">Get a quote</button></form></body></html>`;

function deps(
  renderPage: RenderPage | undefined,
  addresses: Record<string, string[]> = {},
): RetrievalDeps {
  const fetch: FetchLike = async () =>
    new Response(SHELL, { headers: { 'content-type': 'text/html' } });
  return {
    fetch,
    renderPage,
    resolveHost: async (host) => addresses[host] ?? ['93.184.216.34'],
    now: () => new Date('2026-10-14T12:00:00.000Z'),
    maxExtraPages: 0,
  };
}

describe('JavaScript-rendering fallback', () => {
  it('renders an empty shell and marks the evidence as rendered', async () => {
    const calls: string[] = [];
    const evidence = await collectWebsiteEvidence(
      'northside.test',
      deps(async (url) => {
        calls.push(url);
        return { finalUrl: 'https://www.northside.test/', html: RENDERED };
      }),
    );
    expect(calls).toEqual(['https://northside.test/']);
    expect(evidence.sources).toEqual([
      expect.objectContaining({ title: 'Northside Plumbing', rendered: true }),
    ]);
    expect(evidence.facts.map((fact) => fact.text).join('\n')).toContain(
      'Get a quote',
    );
  });

  it('explains how to enable rendering when no renderer is configured', async () => {
    await expect(
      collectWebsiteEvidence('northside.test', deps(undefined)),
    ).rejects.toThrow('set FIRECRAWL_API_KEY to enable rendering');
  });

  it('fails clearly when even the rendered page is empty', async () => {
    await expect(
      collectWebsiteEvidence(
        'northside.test',
        deps(async (url) => ({ finalUrl: url, html: SHELL })),
      ),
    ).rejects.toThrow('even after rendering');
  });

  it('refuses rendered results that land on another site or a private address', async () => {
    await expect(
      collectWebsiteEvidence(
        'northside.test',
        deps(async () => ({ finalUrl: 'https://evil.test/', html: RENDERED })),
      ),
    ).rejects.toThrow('ended on a different site');
    await expect(
      collectWebsiteEvidence(
        'northside.test',
        deps(
          async () => ({
            finalUrl: 'https://www.northside.test/',
            html: RENDERED,
          }),
          { 'www.northside.test': ['10.0.0.5'] },
        ),
      ),
    ).rejects.toThrow('does not resolve to a public address');
  });
});

describe('firecrawlRenderer', () => {
  it('is disabled without an API key', () => {
    expect(firecrawlRenderer(undefined, fetch)).toBeUndefined();
    expect(firecrawlRenderer('  ', fetch)).toBeUndefined();
  });

  it('posts the URL with a bearer header and returns rendered HTML', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const render = firecrawlRenderer('fc-test-key', async (url, init) => {
      seen.push({ url, init });
      return Response.json({
        success: true,
        data: {
          rawHtml: RENDERED,
          metadata: { url: 'https://northside.test/home', statusCode: 200 },
        },
      });
    })!;
    await expect(render('https://northside.test/')).resolves.toEqual({
      finalUrl: 'https://northside.test/home',
      html: RENDERED,
    });
    expect(seen[0]!.url).toBe(FIRECRAWL_SCRAPE_URL);
    expect(seen[0]!.url).not.toContain('fc-test-key');
    expect(
      (seen[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer fc-test-key');
    expect(JSON.parse(String(seen[0]!.init.body))).toMatchObject({
      url: 'https://northside.test/',
      formats: [{ type: 'rawHtml' }],
    });
  });

  it('maps provider failures to safe messages without the key', async () => {
    const reject = firecrawlRenderer(
      'fc-test-key',
      async () => new Response('nope', { status: 401 }),
    )!;
    const error = await reject('https://northside.test/').catch(
      (cause: Error) => cause,
    );
    expect(String(error)).toMatch(/rejected the configured FIRECRAWL_API_KEY/);
    expect(String(error)).not.toContain('fc-test-key');

    const quota = firecrawlRenderer(
      'k',
      async () => new Response('', { status: 402 }),
    )!;
    await expect(quota('https://n.test/')).rejects.toThrow('quota');

    const siteError = firecrawlRenderer('k', async () =>
      Response.json({
        success: true,
        data: { rawHtml: '', metadata: { statusCode: 404 } },
      }),
    )!;
    await expect(siteError('https://n.test/')).rejects.toThrow('HTTP 404');
  });
});
