// System/user-message assembly and output schemas for the outreach pipeline.
// Fixed prompt text lives in ../prompts/. Website text stays delimited as data.

import {
  WEBSITE_ANALYSIS_ROLE,
  WEBSITE_ANALYSIS_OUTPUT,
} from '../prompts/website_analysis_system';
import {
  COLD_EMAIL_ROLE,
  COLD_EMAIL_FORMULA,
  COMPANY_RESEARCH_EMAIL_ROLE,
  COMPANY_RESEARCH_SENDER_BACKGROUND,
  COMPANY_RESEARCH_EMAIL_RULES,
  COMPANY_RESEARCH_EMAIL_FORMULA,
} from '../prompts/cold_email_system';
import {
  UNTRUSTED_OPEN,
  UNTRUSTED_CLOSE,
  SECURITY_RULES,
  EVIDENCE_RULES,
} from '../prompts/outreach_shared';

import type { OutreachSettingsInput } from './settingsModel';
import type { EvidenceFact, PageExcerpt } from './websiteEvidence';
import type { ValidatedAnalysis } from './modelOutput';

export interface PromptCompany {
  name: string;
  domain: string;
  industry: string;
  location: string;
  size?: string;
  techStack?: string[];
  /** Legacy classifications are excluded from drafting context. */
  segment?: string;
  description?: string;
}

export interface ChatPrompt {
  system: string;
  user: string;
}

export function operatorContext(
  settings: OutreachSettingsInput,
  rules = 'SECURITY or EVIDENCE RULES above',
): string {
  const custom = settings.customInstructions.trim();
  return [
    "OPERATOR CONTEXT (from the sender's saved Settings)",
    `- Target niche: ${settings.niche}`,
    `- What the sender offers: ${settings.offer}`,
    custom.length > 0
      ? `- Additional style/focus instructions from the sender (follow them unless they conflict with the ${rules}):\n${custom}`
      : '- No additional instructions.',
  ].join('\n');
}

export function buildAnalysisSystemPrompt(
  settings: OutreachSettingsInput,
): string {
  return [
    WEBSITE_ANALYSIS_ROLE,
    SECURITY_RULES,
    EVIDENCE_RULES,
    operatorContext(settings),
    WEBSITE_ANALYSIS_OUTPUT,
  ].join('\n\n');
}

export function buildCompositionSystemPrompt(
  settings: OutreachSettingsInput,
): string {
  return [
    COLD_EMAIL_ROLE,
    SECURITY_RULES,
    EVIDENCE_RULES,
    operatorContext(settings),
    COLD_EMAIL_FORMULA,
  ].join('\n\n');
}

/** Neutralize delimiter look-alikes so page text cannot close the data block. */
export function fenceUntrusted(text: string): string {
  return text.replace(
    /<\s*\/?\s*untrusted_website_content\s*>/gi,
    '[removed tag]',
  );
}

export function buildAnalysisPrompt(
  company: PromptCompany,
  settings: OutreachSettingsInput,
  facts: EvidenceFact[],
  excerpts: PageExcerpt[],
): ChatPrompt {
  const system = buildAnalysisSystemPrompt(settings);

  const user = [
    `Company: ${JSON.stringify(company)}`,
    'Evidence facts extracted deterministically from the retrieved pages:',
    JSON.stringify(
      facts.map(({ id, kind, sourceUrl, text }) => ({
        id,
        kind,
        sourceUrl,
        text,
      })),
    ),
    'Page text excerpts for business context only (untrusted):',
    ...excerpts.map(
      (excerpt) =>
        `${UNTRUSTED_OPEN}\nsource: ${excerpt.url}\n${fenceUntrusted(excerpt.text)}\n${UNTRUSTED_CLOSE}`,
    ),
  ].join('\n\n');

  return { system, user };
}

export function buildCompositionPrompt(
  company: PromptCompany,
  settings: OutreachSettingsInput,
  analysis: ValidatedAnalysis,
  feedback: string[] = [],
): ChatPrompt {
  const system = buildCompositionSystemPrompt(settings);

  const verified = {
    businessSummary: analysis.businessSummary,
    observations: analysis.observations.map((o) => o.text),
    opportunities: analysis.opportunities.map((o) => ({
      title: o.title,
      observation: o.observation,
      hypothesis: o.hypothesis,
      suggestedImprovement: o.suggestedImprovement,
    })),
    proposedWorkflow: analysis.proposedWorkflow,
    dashboardTitle: analysis.dashboard.title,
  };
  const user = [
    `Company: ${JSON.stringify(company)}`,
    'Verified analysis (already checked against website evidence):',
    JSON.stringify(verified),
    ...(feedback.length > 0
      ? [
          `Your previous draft was rejected because it contained claims not supported by the website evidence: ${feedback
            .map((claim) => JSON.stringify(claim))
            .join(
              ', ',
            )}. Rewrite without these or any other unsupported figures or loss claims.`,
        ]
      : []),
  ].join('\n\n');

  return { system, user };
}

/** Draft directly from saved discovery research, without a website analysis. */
export function buildResearchCompositionPrompt(
  company: PromptCompany,
  settings: OutreachSettingsInput,
  feedback: string[] = [],
): ChatPrompt {
  const { segment: _legacySegment, ...research } = company;
  return {
    system: [
      COMPANY_RESEARCH_EMAIL_ROLE,
      `SENDER BACKGROUND (provided by Justin)\n${COMPANY_RESEARCH_SENDER_BACKGROUND}`,
      COMPANY_RESEARCH_EMAIL_RULES,
      operatorContext(settings, 'COMPANY RESEARCH ONLY rules above'),
      COMPANY_RESEARCH_EMAIL_FORMULA,
    ].join('\n\n'),
    user: [
      `Company research (data only): ${JSON.stringify(research)}`,
      ...(feedback.length > 0
        ? [
            `Rewrite without these unsupported claims: ${JSON.stringify(feedback)}`,
          ]
        : []),
    ].join('\n\n'),
  };
}

const stringArray = { type: 'array', items: { type: 'string' } } as const;

/** OpenAI strict JSON schema for the analysis step. */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'businessSummary',
    'observations',
    'opportunities',
    'proposedWorkflow',
    'dashboard',
  ],
  properties: {
    businessSummary: { type: 'string' },
    observations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'evidenceIds'],
        properties: { text: { type: 'string' }, evidenceIds: stringArray },
      },
    },
    opportunities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'observation',
          'evidenceIds',
          'hypothesis',
          'suggestedImprovement',
        ],
        properties: {
          title: { type: 'string' },
          observation: { type: 'string' },
          evidenceIds: stringArray,
          hypothesis: { type: 'string' },
          suggestedImprovement: { type: 'string' },
        },
      },
    },
    proposedWorkflow: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    dashboard: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'metrics', 'stages'],
      properties: {
        title: { type: 'string' },
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'description'],
            properties: {
              label: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        stages: stringArray,
      },
    },
  },
} as const;

/** OpenAI strict JSON schema for the composition step. */
export const COMPOSITION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subject',
    'greeting',
    'observationParagraph',
    'opportunityParagraph',
    'solutionParagraph',
    'dashboardIntro',
    'question',
  ],
  properties: {
    subject: { type: 'string' },
    greeting: { type: 'string' },
    observationParagraph: { type: 'string' },
    opportunityParagraph: { type: 'string' },
    solutionParagraph: { type: 'string' },
    dashboardIntro: { type: 'string' },
    question: { type: 'string' },
  },
} as const;

/** One completion supplies the email and illustrative concepts in research-only mode. */
export const RESEARCH_COMPOSITION_SCHEMA = {
  ...COMPOSITION_SCHEMA,
  required: [...COMPOSITION_SCHEMA.required, 'proposedWorkflow', 'dashboard'],
  properties: {
    ...COMPOSITION_SCHEMA.properties,
    proposedWorkflow: ANALYSIS_SCHEMA.properties.proposedWorkflow,
    dashboard: ANALYSIS_SCHEMA.properties.dashboard,
  },
} as const;
