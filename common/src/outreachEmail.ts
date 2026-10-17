/**
 * Business-outreach email content and its safe HTML / plain-text renderings.
 *
 * Every string in {@link OutreachEmailContent} is treated as untrusted text
 * (model output or user edits). Rendering escapes it; no caller-provided HTML,
 * links, scripts, or remote images are ever emitted.
 */
import { escapeHtml } from './utils';

/** One observed fact about the prospect's website, with where it was seen. */
export interface EmailFinding {
  text: string;
  sourceUrl: string;
}

/** One step of the proposed lead-response workflow. */
export interface WorkflowStep {
  name: string;
  description: string;
}

/** A metric the illustrative dashboard would report (label only, no values). */
export interface DashboardMetric {
  label: string;
  description: string;
}

/** The illustrative reporting mockup embedded in the email. */
export interface DashboardConcept {
  title: string;
  metrics: DashboardMetric[];
  /** Example lead stages, in pipeline order. */
  stages: string[];
}

/** Structured, editable content for one outreach email. */
export interface OutreachEmailContent {
  subject: string;
  /** Greeting + observation, opportunity, and solution paragraphs. */
  opening: string;
  findings: EmailFinding[];
  workflow: WorkflowStep[];
  dashboard: DashboardConcept;
  /** The low-pressure conversation-starting question (+ optional sign-off). */
  closing: string;
  signature: string;
}

export interface RenderedOutreachEmail {
  subject: string;
  text: string;
  html: string;
}

export const DASHBOARD_LABEL = 'Illustrative dashboard concept';
export const DASHBOARD_DISCLAIMER =
  'Example layout only: not measured results, not your data, and not an installed system. Values are intentionally left blank.';

const LIMITS = {
  subject: 160,
  opening: 3000,
  closing: 1000,
  signature: 600,
  findings: 5,
  workflow: 6,
  metrics: 8,
  stages: 8,
} as const;

/** Collapse a header value to one line so it cannot inject extra headers. */
export function sanitizeSubject(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split free text into trimmed, non-empty paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Human-friendly host + path for a source URL (never a clickable link). */
export function displaySource(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url;
  }
}

/** Structural problems that make content unsendable; empty when valid. */
export function validateOutreachContent(
  content: OutreachEmailContent,
): string[] {
  const issues: string[] = [];
  const subject = sanitizeSubject(content.subject);
  if (subject.length === 0) issues.push('Subject is empty.');
  if (subject.length > LIMITS.subject) {
    issues.push(`Subject exceeds ${LIMITS.subject} characters.`);
  }
  if (splitParagraphs(content.opening).length === 0) {
    issues.push('Opening paragraphs are empty.');
  }
  if (content.opening.length > LIMITS.opening) {
    issues.push(`Opening exceeds ${LIMITS.opening} characters.`);
  }
  if (!content.closing.includes('?')) {
    issues.push('Closing must include a conversation-starting question.');
  }
  if (content.closing.length > LIMITS.closing) {
    issues.push(`Closing exceeds ${LIMITS.closing} characters.`);
  }
  if (content.signature.length > LIMITS.signature) {
    issues.push(`Signature exceeds ${LIMITS.signature} characters.`);
  }
  if (content.dashboard.metrics.length === 0) {
    issues.push('Dashboard concept has no metrics.');
  }
  if (
    content.findings.length > LIMITS.findings ||
    content.workflow.length > LIMITS.workflow ||
    content.dashboard.metrics.length > LIMITS.metrics ||
    content.dashboard.stages.length > LIMITS.stages
  ) {
    issues.push('Email contains too many findings, steps, metrics, or stages.');
  }
  return issues;
}

function textLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
}

/** Plain-text alternative conveying the same findings and dashboard proposal. */
export function renderOutreachText(content: OutreachEmailContent): string {
  const out: string[] = [];
  out.push(splitParagraphs(content.opening).join('\n\n'));

  const dashboard = [
    `${DASHBOARD_LABEL.toUpperCase()}: ${content.dashboard.title}`,
    DASHBOARD_DISCLAIMER,
  ];
  if (content.dashboard.stages.length > 0) {
    dashboard.push(
      `Example lead stages: ${content.dashboard.stages.join(' -> ')}`,
    );
  }
  dashboard.push(
    ...content.dashboard.metrics.map(
      (metric) => `- ${metric.label}: [ - ]  (${metric.description})`,
    ),
  );
  out.push(dashboard.join('\n'));

  if (content.findings.length > 0) {
    out.push(
      [
        'WHAT I NOTICED ON YOUR SITE',
        ...content.findings.map(
          (finding) =>
            `- ${finding.text} (seen on ${displaySource(finding.sourceUrl)})`,
        ),
      ].join('\n'),
    );
  }

  if (content.workflow.length > 0) {
    out.push(
      [
        'PROPOSED LEAD-RESPONSE WORKFLOW',
        ...content.workflow.map(
          (step, index) => `${index + 1}. ${step.name}: ${step.description}`,
        ),
      ].join('\n'),
    );
  }

  out.push(splitParagraphs(content.closing).join('\n\n'));
  const signature = textLines(content.signature.trim()).join('\n');
  if (signature.length > 0) out.push(signature);
  return `${out.join('\n\n')}\n`;
}

const FONT = 'font-family:Arial,Helvetica,sans-serif;';
const P_STYLE = `${FONT}font-size:15px;line-height:1.55;color:#1f2933;margin:0 0 14px 0;`;
const H_STYLE = `${FONT}font-size:13px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:#52606d;margin:0 0 8px 0;`;
const SMALL_STYLE = `${FONT}font-size:12px;line-height:1.45;color:#616e7c;`;

function paragraphsHtml(text: string): string {
  return splitParagraphs(text)
    .map(
      (paragraph) =>
        `<p style="${P_STYLE}">${textLines(paragraph)
          .map(escapeHtml)
          .join('<br>')}</p>`,
    )
    .join('\n');
}

function findingsHtml(findings: EmailFinding[]): string {
  if (findings.length === 0) return '';
  const items = findings
    .map(
      (finding) =>
        `<li style="${P_STYLE}margin-bottom:6px;">${escapeHtml(finding.text)} <span style="${SMALL_STYLE}">(seen on ${escapeHtml(displaySource(finding.sourceUrl))})</span></li>`,
    )
    .join('\n');
  return `<p style="${H_STYLE}">What I noticed on your site</p>\n<ul style="margin:0 0 16px 18px;padding:0;">\n${items}\n</ul>`;
}

function workflowHtml(workflow: WorkflowStep[]): string {
  if (workflow.length === 0) return '';
  const items = workflow
    .map(
      (step) =>
        `<li style="${P_STYLE}margin-bottom:6px;"><strong>${escapeHtml(step.name)}</strong>: ${escapeHtml(step.description)}</li>`,
    )
    .join('\n');
  return `<p style="${H_STYLE}">Proposed lead-response workflow</p>\n<ol style="margin:0 0 16px 18px;padding:0;">\n${items}\n</ol>`;
}

function dashboardHtml(dashboard: DashboardConcept): string {
  const stageCells = dashboard.stages
    .map(
      (stage) =>
        `<td style="${FONT}font-size:12px;color:#334e68;background:#e6f0fa;border:1px solid #bcccdc;padding:6px 8px;text-align:center;">${escapeHtml(stage)}</td>`,
    )
    .join('');
  const stages =
    dashboard.stages.length > 0
      ? `<p style="${SMALL_STYLE}margin:0 0 6px 0;">Example lead stages</p>\n<table role="presentation" cellpadding="0" cellspacing="4" style="border-collapse:separate;margin:0 0 12px 0;"><tr>${stageCells}</tr></table>`
      : '';
  const metricRows = dashboard.metrics
    .map(
      (metric) =>
        `<tr><td style="${FONT}font-size:14px;color:#1f2933;padding:6px 8px;border-top:1px solid #d9e2ec;"><strong>${escapeHtml(metric.label)}</strong><br><span style="${SMALL_STYLE}">${escapeHtml(metric.description)}</span></td><td style="${FONT}font-size:14px;color:#9aa5b1;padding:6px 8px;border-top:1px solid #d9e2ec;text-align:right;white-space:nowrap;">&mdash;</td></tr>`,
    )
    .join('\n');
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #9fb3c8;border-radius:6px;margin:4px 0 18px 0;background:#f8fafc;">`,
    `<tr><td style="padding:14px 16px;">`,
    `<p style="${H_STYLE}color:#b44d12;">${escapeHtml(DASHBOARD_LABEL)} &middot; example only</p>`,
    `<p style="${FONT}font-size:16px;font-weight:bold;color:#102a43;margin:0 0 4px 0;">${escapeHtml(dashboard.title)}</p>`,
    `<p style="${SMALL_STYLE}margin:0 0 12px 0;">${escapeHtml(DASHBOARD_DISCLAIMER)}</p>`,
    stages,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">\n${metricRows}\n</table>`,
    `</td></tr></table>`,
  ].join('\n');
}

/**
 * Email-safe HTML: table layout, inline styles, all content escaped, no links,
 * images, scripts, or tracking pixels.
 */
export function renderOutreachHtml(content: OutreachEmailContent): string {
  const signature = textLines(content.signature.trim())
    .filter((line) => line.length > 0)
    .map(escapeHtml)
    .join('<br>');
  const body = [
    paragraphsHtml(content.opening),
    // The opening ends by introducing the mockup, so it follows directly.
    dashboardHtml(content.dashboard),
    findingsHtml(content.findings),
    workflowHtml(content.workflow),
    paragraphsHtml(content.closing),
    signature.length > 0 ? `<p style="${P_STYLE}">${signature}</p>` : '',
  ]
    .filter((part) => part.length > 0)
    .join('\n');
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#ffffff;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;"><tr><td>',
    body,
    '</td></tr></table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

/** Render subject, text, and HTML together. */
export function renderOutreachEmail(
  content: OutreachEmailContent,
): RenderedOutreachEmail {
  return {
    subject: sanitizeSubject(content.subject),
    text: renderOutreachText(content),
    html: renderOutreachHtml(content),
  };
}

const CLAIM_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s?%/g,
  /\b\d+(?:\.\d+)?\s?percent\b/gi,
  /[$€£]\s?\d[\d,.]*\s?(?:k|m|million|thousand)?/gi,
  /\b\d+(?:\.\d+)?[\s-]?(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)\b/gi,
  /\b\d+(?:\.\d+)?\s?(?:x|×)\s/gi,
  /\b(?:you(?:'re| are)|they(?:'re| are))\s+(?:losing|missing out on|leaving)\b[^.?!]*/gi,
  /\blos(?:e|ing|t)\s+(?:\w+\s+){0,2}(?:revenue|leads|customers|sales|deals)\b/gi,
];

/**
 * Assertions about back-office behavior a public web page cannot reveal
 * (acknowledgements, follow-up, CRM, response speed). These may only appear
 * as explicit questions or hypotheses, never as statements of fact.
 */
const UNOBSERVABLE_PROCESS_PATTERNS: RegExp[] = [
  /\b(?:there is no|there's no|no|lacks?|lacking|without|missing|doesn't have|does not have|absence of)\b[^.?!]{0,40}?\b(?:acknowledge?ments?|auto-?responders?|auto-?replies|automated (?:responses?|replies)|follow[- ]?ups?|crm|confirmation (?:emails?|messages?)|response (?:system|process))\b/gi,
  /\b(?:slow|delayed|late|missed|unanswered)\s+(?:responses?|replies|follow[- ]?ups?|inquiries|leads|calls)\b/gi,
  /\bleads?\s+(?:are|get|go)\s+(?:lost|missed|ignored|forgotten)\b/gi,
];

/**
 * Promised business outcomes ("this will boost bookings", "enhance customer
 * satisfaction", "guaranteed"). Nothing on a prospect's site can support a
 * promise about their results, so these may only appear as genuine questions
 * ("would it help bookings if ...?") — a modal like "could" is not enough.
 */
const OUTCOME_PROMISE_PATTERNS: RegExp[] = [
  /\b(?:increase|increasing|boost|boosting|improve|improving|enhance|enhancing|grow|growing|double|doubling|triple|maximi[sz]e|maximi[sz]ing|drive|driving|skyrocket|lift|lifting|raise|raising)\s+(?:\w+\s+){0,3}?(?:revenue|sales|leads|conversions?|conversion rates?|bookings|appointments|satisfaction|retention|roi|profits?|profitability|growth|customers|clients|engagement|efficiency|loyalty|reviews|close rates?|win rates?)\b/gi,
  /\bguarantee(?:d|s)?\b/gi,
  /\b(?:more|higher|better)\s+(?:revenue|sales|conversions?|conversion rates?|bookings|satisfaction|retention|roi|profits?)\b/gi,
];

function sentenceAt(text: string, index: number): string {
  const start = Math.max(
    text.lastIndexOf('.', index),
    text.lastIndexOf('!', index),
    text.lastIndexOf('?', index - 1),
    text.lastIndexOf('\n', index),
  );
  const endMatch = /[.!?\n]/.exec(text.slice(index));
  const end = endMatch === null ? text.length : index + endMatch.index;
  return text.slice(start + 1, end + 1);
}

/** True when the sentence containing `index` is framed as a question or hypothesis. */
function isHedged(text: string, index: number): boolean {
  const sentence = sentenceAt(text, index);
  return (
    sentence.trim().endsWith('?') ||
    /\b(?:whether|if|might|may|could|worth checking|curious|wonder)\b/i.test(
      sentence,
    )
  );
}

/** True when the sentence is an actual question or explicit inquiry. */
function isGenuineQuestion(text: string, index: number): boolean {
  const sentence = sentenceAt(text, index);
  return (
    sentence.trim().endsWith('?') ||
    /\b(?:whether|curious|wonder)\b/i.test(sentence)
  );
}

/**
 * Specific quantitative, loss, outcome-promise, or back-office claims in `text` that the
 * retrieved website evidence does not support. Static pages cannot establish
 * response times, conversion rates, revenue loss, or internal processes, so
 * figures must appear verbatim on the site, and process claims must be hedged.
 */
export function findUnsupportedClaims(
  text: string,
  evidenceCorpus: string,
  options: { outcomePromises?: boolean } = {},
): string[] {
  const corpus = evidenceCorpus.toLowerCase();
  const found = new Set<string>();
  for (const pattern of UNOBSERVABLE_PROCESS_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!isHedged(text, match.index ?? 0)) found.add(match[0].trim());
    }
  }
  const outcomePatterns =
    options.outcomePromises === false ? [] : OUTCOME_PROMISE_PATTERNS;
  for (const pattern of outcomePatterns) {
    for (const match of text.matchAll(pattern)) {
      if (!isGenuineQuestion(text, match.index ?? 0)) {
        found.add(match[0].trim());
      }
    }
  }
  for (const pattern of CLAIM_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const claim = match[0].trim();
      if (!corpus.includes(claim.toLowerCase())) found.add(claim);
    }
  }
  return [...found];
}

/** Claim-checking corpus from website evidence and optional saved company research. */
export function evidenceCorpus(
  facts: { text: string }[],
  excerpts: { text: string }[] = [],
  researchContext?: string,
): string {
  return [
    ...facts.map((fact) => fact.text),
    ...excerpts.map((excerpt) => excerpt.text),
    ...(researchContext === undefined ? [] : [researchContext]),
  ].join('\n');
}

/**
 * Unsupported claims anywhere a reader will see them. Each field is checked
 * on its own so a hedge in one cannot excuse a claim in another.
 */
export function findDraftClaims(
  content: OutreachEmailContent,
  corpus: string,
): string[] {
  const texts = [
    content.subject,
    content.opening,
    content.closing,
    ...content.findings.map((finding) => finding.text),
    ...content.workflow.flatMap((step) => [step.name, step.description]),
    content.dashboard.title,
    ...content.dashboard.metrics.flatMap((metric) => [
      metric.label,
      metric.description,
    ]),
    ...content.dashboard.stages,
  ];
  const found = new Set<string>();
  for (const text of texts) {
    for (const claim of findUnsupportedClaims(text, corpus)) found.add(claim);
  }
  return [...found];
}

/** Reasons a draft cannot be approved as-is. */
export interface ApprovalCheck {
  /** Unsupported claims; approval needs an explicit acknowledgement. */
  claims: string[];
  /** Hard blockers that must be fixed before approval. */
  blockers: string[];
}

export function checkDraftForApproval(
  content: OutreachEmailContent,
  corpus: string,
): ApprovalCheck {
  const blockers = validateOutreachContent(content);
  if (content.signature.trim().length === 0) {
    blockers.push(
      'Add a signature before approving (edit it here, or set sender name and signature in Settings for future runs).',
    );
  }
  return { claims: findDraftClaims(content, corpus), blockers };
}

/** True when every flagged claim is in the reviewer's acknowledged list. */
export function claimsAcknowledged(
  claims: string[],
  acknowledged: string[],
): boolean {
  const ok = new Set(acknowledged);
  return claims.every((claim) => ok.has(claim));
}
