// Headless-browser rendering through Firecrawl's scrape API, used only as a
// fallback for JavaScript-rendered sites. The API key is sent in a header,
// never in the URL, and never appears in errors.

import { RetrievalError, type RenderPage } from './websiteEvidence';

export const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';

type PostJson = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<Response>;

interface ScrapeResponse {
  success?: boolean;
  data?: {
    rawHtml?: unknown;
    metadata?: { url?: unknown; sourceURL?: unknown; statusCode?: unknown };
  };
}

/** A {@link RenderPage} backed by Firecrawl, or undefined when not configured. */
export function firecrawlRenderer(
  apiKey: string | undefined,
  post: PostJson,
  timeoutMs = 45_000,
): RenderPage | undefined {
  const key = apiKey?.trim();
  if (key === undefined || key.length === 0) return undefined;
  return async (url) => {
    const host = new URL(url).host;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await post(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: [{ type: 'rawHtml' }],
          waitFor: 1500,
          timeout: timeoutMs - 5_000,
          blockAds: true,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new RetrievalError(`Rendering service unreachable for ${host}.`);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401 || response.status === 403) {
      throw new RetrievalError(
        'The rendering service rejected the configured FIRECRAWL_API_KEY.',
      );
    }
    if (response.status === 402 || response.status === 429) {
      throw new RetrievalError(
        'The rendering service quota or rate limit was reached.',
      );
    }
    let body: ScrapeResponse;
    try {
      body = (await response.json()) as ScrapeResponse;
    } catch {
      throw new RetrievalError(`Rendering ${host} returned malformed output.`);
    }
    const html = body.data?.rawHtml;
    if (!response.ok || body.success !== true || typeof html !== 'string') {
      throw new RetrievalError(`Rendering ${host} failed.`);
    }
    const status = body.data?.metadata?.statusCode;
    if (typeof status === 'number' && status >= 400) {
      throw new RetrievalError(`${host} responded with HTTP ${status}.`);
    }
    const finalUrl = body.data?.metadata?.url;
    return { finalUrl: typeof finalUrl === 'string' ? finalUrl : url, html };
  };
}
