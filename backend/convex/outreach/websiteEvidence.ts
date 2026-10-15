// Public-website retrieval and deterministic evidence extraction.
//
// Runtime-agnostic: network access (`fetch`) and DNS resolution (`resolveHost`)
// are injected so the Node action supplies real implementations and tests
// supply fakes. Extracted text is untrusted third-party content.

export type FetchLike = (
  url: string,
  init: {
    redirect: 'manual';
    signal: AbortSignal;
    headers: Record<string, string>;
  },
) => Promise<Response>;

/** Resolve a hostname to its IP addresses (v4 or v6). */
export type ResolveHost = (hostname: string) => Promise<string[]>;

/**
 * Optional headless-browser rendering for pages whose static HTML is an empty
 * JavaScript shell. Returns the rendered HTML and the final URL loaded.
 */
export type RenderPage = (
  url: string,
) => Promise<{ finalUrl: string; html: string }>;

export interface RetrievalDeps {
  fetch: FetchLike;
  resolveHost: ResolveHost;
  renderPage?: RenderPage;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  maxExtraPages?: number;
}

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  fetchedAt: string;
  html: string;
}

export interface FormSummary {
  fields: string[];
  submitLabel: string;
}

export interface ExtractedPage {
  url: string;
  fetchedAt: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  forms: FormSummary[];
  ctas: string[];
  phones: string[];
  emails: string[];
  chatWidgets: string[];
  bookingTools: string[];
  links: string[];
  /** True when the HTML came from the headless-browser fallback. */
  rendered?: boolean;
}

export type EvidenceKind =
  | 'business'
  | 'contact'
  | 'form'
  | 'cta'
  | 'chat'
  | 'booking'
  | 'absence';

export interface EvidenceFact {
  id: string;
  kind: EvidenceKind;
  sourceUrl: string;
  text: string;
}

export interface EvidenceSource {
  url: string;
  title: string;
  fetchedAt: string;
  rendered?: boolean;
}

export interface PageExcerpt {
  url: string;
  text: string;
}

export interface WebsiteEvidence {
  sources: EvidenceSource[];
  facts: EvidenceFact[];
  excerpts: PageExcerpt[];
  /** Follow-up pages that could not be retrieved (homepage failures throw). */
  skipped: { url: string; reason: string }[];
}

/** A retrieval failure safe to show to the user (no secrets, no stack). */
export class RetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetrievalError';
  }
}

const USER_AGENT =
  'ColdOutreachWebsiteReview/1.0 (+single-page review for a personalized email)';
const EXCERPT_CHARS = 3500;

/* ------------------------------------------------------------ URL safety */

/** Build the https homepage URL for a stored company domain. */
export function websiteUrlFromDomain(domain: string): URL {
  const trimmed = domain.trim();
  if (trimmed.length === 0)
    throw new RetrievalError('Company has no website domain.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new RetrievalError(`"${trimmed}" is not a valid website domain.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RetrievalError('Only http(s) websites can be reviewed.');
  }
  if (!url.hostname.includes('.')) {
    throw new RetrievalError(`"${trimmed}" is not a public website domain.`);
  }
  return new URL(`${url.protocol}//${url.host}/`);
}

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : NaN,
  );
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ? nums
    : null;
}

/** True for loopback, private, link-local, CGNAT, multicast, and reserved IPs. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4 !== null) {
    const [a, b] = v4 as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (!v6.includes(':')) return true; // unparseable: treat as unsafe
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!);
  return (
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.lan',
  '.home.arpa',
];

/** Reject non-public hostnames before any DNS lookup. */
export function assertPublicHostname(hostname: string): void {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    ipv4Parts(host) !== null ||
    host.startsWith('[')
  ) {
    throw new RetrievalError(
      `Refusing to fetch non-public host "${hostname}".`,
    );
  }
}

async function assertSafeUrl(
  url: URL,
  resolveHost: ResolveHost,
): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RetrievalError(`Refusing to follow ${url.protocol} URL.`);
  }
  if (url.username || url.password) {
    throw new RetrievalError(
      'Refusing to fetch a URL with embedded credentials.',
    );
  }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    throw new RetrievalError(
      `Refusing to fetch non-standard port ${url.port}.`,
    );
  }
  assertPublicHostname(url.hostname);
  let addresses: string[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new RetrievalError(`Could not resolve ${url.hostname}.`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new RetrievalError(
      `${url.hostname} does not resolve to a public address.`,
    );
  }
}

/* -------------------------------------------------------------- fetching */

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      chunks.push(
        value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))),
      );
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

/** Fetch one HTML page, validating every redirect hop and capping size/time. */
export async function fetchPage(
  url: URL,
  deps: RetrievalDeps,
): Promise<FetchedPage> {
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const maxBytes = deps.maxBytes ?? 1_500_000;
  const maxRedirects = deps.maxRedirects ?? 4;
  const now = deps.now ?? (() => new Date());
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertSafeUrl(current, deps.resolveHost);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await deps.fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new RetrievalError(
        aborted
          ? `Timed out after ${Math.round(timeoutMs / 1000)}s fetching ${current.host}.`
          : `Could not connect to ${current.host}.`,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timer);
      const location = response.headers.get('location');
      if (location === null) {
        throw new RetrievalError(
          `Redirect from ${current.host} had no location.`,
        );
      }
      current = new URL(location, current);
      continue;
    }

    try {
      if (!response.ok) {
        throw new RetrievalError(
          `${current.host} responded with HTTP ${response.status}.`,
        );
      }
      const type = response.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
        throw new RetrievalError(`${current.toString()} is not an HTML page.`);
      }
      const html = await readCapped(response, maxBytes);
      return {
        requestedUrl: url.toString(),
        finalUrl: current.toString(),
        fetchedAt: now().toISOString(),
        html,
      };
    } catch (error) {
      if (error instanceof RetrievalError) throw error;
      throw new RetrievalError(`Failed reading ${current.host}.`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new RetrievalError(`Too many redirects starting from ${url.host}.`);
}

/* ------------------------------------------------------------- extraction */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: '...',
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : ' ';
      }
      return ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

function clean(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string): string {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return decodeEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim();
}

function unique(values: string[], max: number): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].slice(0, max);
}

/** De-duplicate phone numbers that differ only in formatting or country code. */
function uniquePhones(values: string[], max: number): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length >= 7 && !seen.has(digits)) seen.set(digits, value);
  }
  return [...seen.values()].slice(0, max);
}

const CTA_WORDS =
  /\b(contact|call|book|schedule|appointment|quote|estimate|consult|get started|request|enquir|inquir|free|demo|talk|chat|message|reserve|apply|sign up|join)\b/i;

const CHAT_VENDORS: [RegExp, string][] = [
  [/intercom/i, 'Intercom'],
  [/drift\.com|js\.driftt/i, 'Drift'],
  [/tawk\.to/i, 'Tawk.to'],
  [/livechatinc|livechat\.com/i, 'LiveChat'],
  [/hs-scripts|hubspot.*conversations|js\.usemessages/i, 'HubSpot chat'],
  [/zopim|zdassets|zendesk/i, 'Zendesk chat'],
  [/crisp\.chat/i, 'Crisp'],
  [/tidio/i, 'Tidio'],
  [/podium/i, 'Podium'],
  [/birdeye/i, 'Birdeye'],
  [/olark/i, 'Olark'],
  [/freshchat|wchat\.freshchat/i, 'Freshchat'],
];

const BOOKING_VENDORS: [RegExp, string][] = [
  [/calendly\.com/i, 'Calendly'],
  [/acuityscheduling/i, 'Acuity Scheduling'],
  [/janeapp/i, 'Jane'],
  [/squareup\.com\/appointments|square\.site\/book/i, 'Square Appointments'],
  [/setmore/i, 'Setmore'],
  [/simplybook/i, 'SimplyBook'],
  [/housecallpro/i, 'Housecall Pro'],
  [/servicetitan/i, 'ServiceTitan'],
  [/jobber/i, 'Jobber'],
  [/booksy/i, 'Booksy'],
  [/vagaro/i, 'Vagaro'],
  [/mindbodyonline|mindbody/i, 'Mindbody'],
  [/opentable/i, 'OpenTable'],
  [/zocdoc/i, 'Zocdoc'],
];

function extractForms(html: string): FormSummary[] {
  const forms: FormSummary[] = [];
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
    const inner = match[1] ?? '';
    const fields: string[] = [];
    for (const field of inner.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
      const tag = field[0];
      const type = attr(tag, 'type').toLowerCase();
      if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type))
        continue;
      const name = attr(tag, 'name');
      const meaningfulName = /^[a-z][a-z _-]{1,30}$/i.test(name) ? name : '';
      const label =
        attr(tag, 'aria-label') ||
        meaningfulName ||
        attr(tag, 'placeholder') ||
        name ||
        type;
      if (label) fields.push(label.slice(0, 40));
    }
    const submitTag =
      inner.match(/<button\b[^>]*>([\s\S]*?)<\/button>/i)?.[1] ??
      attr(
        inner.match(/<input\b[^>]*type\s*=\s*["']?submit[^>]*>/i)?.[0] ?? '',
        'value',
      );
    forms.push({
      fields: unique(fields, 12),
      submitLabel: clean(submitTag ?? '').slice(0, 40),
    });
    if (forms.length >= 5) break;
  }
  return forms;
}

/** Deterministically summarize one page's visible lead-capture surface. */
export function extractPage(
  html: string,
  pageUrl: string,
  fetchedAt: string,
): ExtractedPage {
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? '';
  const scriptSrcs = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) =>
    attr(m[0], 'src'),
  );
  const scriptBodies = [
    ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((m) => (m[1] ?? '').slice(0, 2000))
    .join(' ');
  const iframeSrcs = [...html.matchAll(/<iframe\b[^>]*>/gi)].map((m) =>
    attr(m[0], 'src'),
  );
  const vendorHaystack = `${scriptSrcs.join(' ')} ${iframeSrcs.join(' ')} ${scriptBodies}`;

  const body = html
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(
    (m) => ({
      href: attr(`<a ${m[1] ?? ''}>`, 'href'),
      text: clean(m[2] ?? ''),
    }),
  );
  const buttons = [
    ...body.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi),
  ].map((m) => clean(m[1] ?? ''));

  const text = clean(
    body.replace(/<\/(p|div|li|h[1-6]|br|section|tr)>/gi, '. '),
  );
  const phoneText = [
    ...text.matchAll(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g),
  ].map((m) => m[0].trim());
  const telLinks = anchors
    .filter((a) => /^tel:/i.test(a.href))
    .map((a) => a.href.replace(/^tel:/i, '').trim());
  const mailLinks = anchors
    .filter((a) => /^mailto:/i.test(a.href))
    .map((a) =>
      a.href
        .replace(/^mailto:/i, '')
        .split('?')[0]!
        .trim(),
    );

  const base = new URL(pageUrl);
  const links = anchors
    .map((a) => {
      try {
        const resolved = new URL(a.href, base);
        resolved.hash = '';
        return resolved.toString();
      } catch {
        return '';
      }
    })
    .filter((href) => href.startsWith('http'));

  return {
    url: pageUrl,
    fetchedAt,
    title: clean(
      head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '',
    ).slice(0, 160),
    description: attr(
      head.match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i)?.[0] ??
        '',
      'content',
    ).slice(0, 300),
    headings: unique(
      [...body.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) =>
        clean(m[1] ?? '').slice(0, 120),
      ),
      12,
    ),
    text: text.slice(0, 20_000),
    forms: extractForms(body),
    ctas: unique(
      [...anchors.map((a) => a.text), ...buttons].filter(
        (label) => label.length <= 60 && CTA_WORDS.test(label),
      ),
      12,
    ),
    phones: uniquePhones([...telLinks, ...phoneText], 4),
    emails: unique(mailLinks, 4),
    chatWidgets: unique(
      CHAT_VENDORS.filter(([pattern]) => pattern.test(vendorHaystack)).map(
        ([, name]) => name,
      ),
      4,
    ),
    bookingTools: unique(
      BOOKING_VENDORS.filter(
        ([pattern]) =>
          pattern.test(vendorHaystack) || links.some((l) => pattern.test(l)),
      ).map(([, name]) => name),
      4,
    ),
    links: unique(links, 300),
  };
}

const BOOKING_CTA =
  /\b(book|schedule|reserve)\b.*\b(online|now|appointment|service|visit)\b|\bbook online\b|\brequest (an )?appointment\b/i;

const FOLLOW_UP_PATTERN =
  /contact|book|appointment|schedul|quote|estimate|consult|get-started|request|service|pricing|about/i;

/** Pick a small set of same-site pages most relevant to lead capture. */
export function selectFollowUpLinks(
  page: ExtractedPage,
  max: number,
): string[] {
  const origin = new URL(page.url);
  const host = origin.hostname.replace(/^www\./, '');
  const scored = page.links
    .map((link) => new URL(link))
    .filter(
      (url) =>
        url.hostname.replace(/^www\./, '') === host &&
        url.pathname !== '/' &&
        !/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i.test(
          url.pathname,
        ) &&
        FOLLOW_UP_PATTERN.test(url.pathname),
    )
    .map((url) => {
      url.search = '';
      const path = url.pathname.toLowerCase();
      const score =
        /contact|book|appointment|schedul|quote|estimate|consult/.test(path)
          ? 2
          : 1;
      return { href: url.toString(), score, depth: path.split('/').length };
    })
    .sort((a, b) => b.score - a.score || a.depth - b.depth);
  return unique(
    scored.map((entry) => entry.href).filter((href) => href !== page.url),
    max,
  );
}

function list(values: string[]): string {
  return values.map((value) => `"${value}"`).join(', ');
}

/** Convert extracted pages into numbered, source-attributed evidence facts. */
export function buildEvidence(
  pages: ExtractedPage[],
): Omit<WebsiteEvidence, 'skipped'> {
  const facts: EvidenceFact[] = [];
  const seen = new Set<string>();
  // Site-wide headers/footers repeat on every page; keep the first occurrence.
  const add = (kind: EvidenceKind, sourceUrl: string, text: string) => {
    if (seen.has(text)) return;
    seen.add(text);
    facts.push({ id: `E${facts.length + 1}`, kind, sourceUrl, text });
  };

  for (const page of pages) {
    if (page.title || page.description) {
      add(
        'business',
        page.url,
        `Page title ${page.title ? `"${page.title}"` : '(none)'}${
          page.description ? `; meta description "${page.description}"` : ''
        }.`,
      );
    }
    if (page.headings.length > 0) {
      add(
        'business',
        page.url,
        `Headings shown: ${list(page.headings.slice(0, 6))}.`,
      );
    }
    if (page.phones.length > 0) {
      add(
        'contact',
        page.url,
        `Phone number(s) listed: ${page.phones.join(', ')}.`,
      );
    }
    if (page.emails.length > 0) {
      add('contact', page.url, `Email link(s): ${page.emails.join(', ')}.`);
    }
    page.forms.forEach((form, index) => {
      add(
        'form',
        page.url,
        `Form ${index + 1} with ${form.fields.length} visible field(s)${
          form.fields.length > 0 ? ` (${list(form.fields)})` : ''
        }${form.submitLabel ? `; submit button "${form.submitLabel}"` : ''}.`,
      );
    });
    if (page.ctas.length > 0) {
      add(
        'cta',
        page.url,
        `Call-to-action links/buttons: ${list(page.ctas.slice(0, 8))}.`,
      );
    }
    if (page.chatWidgets.length > 0) {
      add(
        'chat',
        page.url,
        `Chat widget script detected: ${page.chatWidgets.join(', ')}.`,
      );
    }
    if (page.bookingTools.length > 0) {
      add(
        'booking',
        page.url,
        `Online booking tool referenced: ${page.bookingTools.join(', ')}.`,
      );
    }
  }

  const reviewed = pages.map((page) => page.url).join(', ');
  const firstUrl = pages[0]?.url ?? '';
  if (pages.length > 0 && pages.every((page) => page.forms.length === 0)) {
    add(
      'absence',
      firstUrl,
      pages.every((page) => page.rendered === true)
        ? `No HTML form was found on the ${pages.length} retrieved page(s) after rendering them in a browser (${reviewed}).`
        : `No HTML form was found in the static HTML of the ${pages.length} retrieved page(s) (${reviewed}). Forms injected later by JavaScript would not be visible to this review.`,
    );
  }
  if (
    pages.length > 0 &&
    pages.every((page) => page.chatWidgets.length === 0)
  ) {
    add(
      'absence',
      firstUrl,
      `No known live-chat widget script was detected on the ${pages.length} retrieved page(s).`,
    );
  }
  const bookingCta = pages.some((page) =>
    page.ctas.some((cta) => BOOKING_CTA.test(cta)),
  );
  // A "Book online" button may use an in-house or unrecognized system, so only
  // report a missing booking option when no booking-style CTA is visible either.
  if (
    pages.length > 0 &&
    !bookingCta &&
    pages.every((page) => page.bookingTools.length === 0)
  ) {
    add(
      'absence',
      firstUrl,
      `No online booking link or recognized booking tool was found on the ${pages.length} retrieved page(s).`,
    );
  }

  return {
    sources: pages.map((page) => ({
      url: page.url,
      title: page.title,
      fetchedAt: page.fetchedAt,
      ...(page.rendered === true ? { rendered: true } : {}),
    })),
    facts,
    excerpts: pages.map((page) => ({
      url: page.url,
      text: page.text.slice(0, EXCERPT_CHARS),
    })),
  };
}

/**
 * Retrieve the homepage plus a few lead-capture-relevant pages and build the
 * evidence pack. Throws {@link RetrievalError} when the homepage is unusable;
 * follow-up page failures are recorded and skipped.
 */
export async function collectWebsiteEvidence(
  domain: string,
  deps: RetrievalDeps,
): Promise<WebsiteEvidence> {
  const homePage = await retrievePage(websiteUrlFromDomain(domain), deps);
  if (looksEmpty(homePage)) {
    const host = new URL(homePage.url).host;
    throw new RetrievalError(
      deps.renderPage === undefined
        ? `${host} returned almost no readable content (it may require JavaScript; set FIRECRAWL_API_KEY to enable rendering).`
        : `${host} returned almost no readable content, even after rendering.`,
    );
  }
  const pages = [homePage];
  const skipped: WebsiteEvidence['skipped'] = [];
  for (const link of selectFollowUpLinks(homePage, deps.maxExtraPages ?? 3)) {
    try {
      const page = await retrievePage(new URL(link), deps);
      if (pages.some((existing) => existing.url === page.url)) continue;
      pages.push(page);
    } catch (error) {
      skipped.push({
        url: link,
        reason:
          error instanceof RetrievalError
            ? error.message
            : 'Unknown retrieval error.',
      });
    }
  }
  return { ...buildEvidence(pages), skipped };
}

/** Too little content to review: likely a client-side-rendered shell. */
function looksEmpty(page: ExtractedPage): boolean {
  return page.text.length < 40 && page.forms.length === 0;
}

/**
 * Fetch a page's static HTML; if it is an empty JavaScript shell and a
 * renderer is configured, render it instead. The same public-address checks
 * apply to the URL handed to the renderer and to the URL it ended on.
 */
async function retrievePage(
  url: URL,
  deps: RetrievalDeps,
): Promise<ExtractedPage> {
  const fetched = await fetchPage(url, deps);
  const page = extractPage(fetched.html, fetched.finalUrl, fetched.fetchedAt);
  if (!looksEmpty(page) || deps.renderPage === undefined) return page;

  const target = new URL(fetched.finalUrl);
  await assertSafeUrl(target, deps.resolveHost);
  let rendered: { finalUrl: string; html: string };
  try {
    rendered = await deps.renderPage(target.toString());
  } catch (error) {
    if (error instanceof RetrievalError) throw error;
    throw new RetrievalError(`Rendering ${target.host} failed.`);
  }
  const finalUrl = new URL(rendered.finalUrl || target.toString());
  const site = (host: string) => host.replace(/^www\./, '');
  if (site(finalUrl.host) !== site(target.host)) {
    throw new RetrievalError(
      `Rendering ${target.host} ended on a different site (${finalUrl.host}).`,
    );
  }
  await assertSafeUrl(finalUrl, deps.resolveHost);
  const maxBytes = deps.maxBytes ?? 1_500_000;
  const html = rendered.html.slice(0, maxBytes);
  const now = deps.now ?? (() => new Date());
  return {
    ...extractPage(html, finalUrl.toString(), now().toISOString()),
    rendered: true,
  };
}
