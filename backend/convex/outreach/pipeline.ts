// The outreach pipeline: website evidence -> analysis -> composition ->
// structured email content. All I/O is injected so it can be tested without
// network or provider calls, and so the Convex action stays a thin wrapper.

import {
  validateOutreachContent,
  type OutreachEmailContent,
} from '@emailstrat/common';
import {
  PipelineError,
  evidenceCorpus,
  parseModelJson,
  validateAnalysis,
  validateComposition,
  validateConcepts,
  type ValidatedAnalysis,
} from './modelOutput';
import {
  ANALYSIS_SCHEMA,
  COMPOSITION_SCHEMA,
  RESEARCH_COMPOSITION_SCHEMA,
  buildResearchCompositionPrompt,
  buildAnalysisPrompt,
  buildCompositionPrompt,
  type ChatPrompt,
  type PromptCompany,
} from './prompts';
import { signatureBlock, type OutreachSettingsInput } from './settingsModel';
import type { WebsiteEvidence } from './websiteEvidence';
import {
  COMPANY_RESEARCH_SENDER_BACKGROUND,
  COMPANY_RESEARCH_DEFAULT_SIGNATURE,
} from '../prompts/cold_email_system';

export type PipelineStage =
  | 'retrieving'
  | 'analyzing'
  | 'composing'
  | 'rendering';

export interface JsonCompletion {
  text: string | null;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface PipelineDeps {
  collectEvidence: (domain: string) => Promise<WebsiteEvidence>;
  completeJson: (
    prompt: ChatPrompt,
    schemaName: string,
    schema: Record<string, unknown>,
  ) => Promise<JsonCompletion>;
  onStage?: (stage: PipelineStage) => Promise<unknown>;
  onUsage?: (usage: JsonCompletion) => Promise<void>;
}

export interface PipelineResult {
  evidence: WebsiteEvidence;
  analysis: ValidatedAnalysis;
  content: OutreachEmailContent;
}

const MAX_COMPOSE_ATTEMPTS = 2;

function firstSource(evidence: WebsiteEvidence, ids: string[]): string {
  const fact = evidence.facts.find((candidate) => candidate.id === ids[0]);
  return fact?.sourceUrl ?? evidence.sources[0]?.url ?? '';
}

export async function runOutreachPipeline(
  company: PromptCompany,
  settings: OutreachSettingsInput,
  deps: PipelineDeps,
  options: { websiteReviewEnabled?: boolean } = {},
): Promise<PipelineResult> {
  const stage = async (next: PipelineStage) => deps.onStage?.(next);
  const complete = async (
    prompt: ChatPrompt,
    name: string,
    schema: Record<string, unknown>,
  ) => {
    const result = await deps.completeJson(prompt, name, schema);
    await deps.onUsage?.(result);
    return result;
  };

  const websiteReviewEnabled = options.websiteReviewEnabled !== false;
  let evidence: WebsiteEvidence = {
    sources: [],
    facts: [],
    excerpts: [],
    skipped: [],
  };
  if (!websiteReviewEnabled) {
    evidence.researchContext = JSON.stringify({
      company,
      senderBackground: COMPANY_RESEARCH_SENDER_BACKGROUND,
    });
  }
  let corpus = evidenceCorpus(
    evidence.facts,
    evidence.excerpts,
    evidence.researchContext,
  );
  let analysis: ValidatedAnalysis = {
    businessSummary: '',
    observations: [],
    opportunities: [],
    proposedWorkflow: [],
    dashboard: { title: '', metrics: [], stages: [] },
    droppedCount: 0,
  };
  if (websiteReviewEnabled) {
    await stage('retrieving');
    evidence = await deps.collectEvidence(company.domain);
    if (evidence.facts.length === 0) {
      throw new PipelineError(
        'No usable lead-capture evidence was found on the retrieved pages.',
      );
    }
    corpus = evidenceCorpus(evidence.facts, evidence.excerpts);

    await stage('analyzing');
    const analysisCompletion = await complete(
      buildAnalysisPrompt(company, settings, evidence.facts, evidence.excerpts),
      'lead_capture_analysis',
      ANALYSIS_SCHEMA,
    );
    analysis = validateAnalysis(
      parseModelJson(analysisCompletion.text, 'analysis'),
      evidence.facts,
      corpus,
    );
  }

  await stage('composing');
  let feedback: string[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const completion = await complete(
      websiteReviewEnabled
        ? buildCompositionPrompt(company, settings, analysis, feedback)
        : buildResearchCompositionPrompt(company, settings, feedback),
      'outreach_email',
      websiteReviewEnabled ? COMPOSITION_SCHEMA : RESEARCH_COMPOSITION_SCHEMA,
    );
    const raw = parseModelJson(completion.text, 'composition');
    const { composition, unsupportedClaims } = validateComposition(
      raw,
      corpus,
      { includeDashboardIntro: websiteReviewEnabled },
    );
    if (unsupportedClaims.length > 0) {
      if (attempt >= MAX_COMPOSE_ATTEMPTS) {
        throw new PipelineError(
          `The composed email kept making claims ${websiteReviewEnabled ? 'the website' : 'the company research'} does not support (${unsupportedClaims
            .slice(0, 3)
            .join(', ')}). No email was saved; try regenerating.`,
        );
      }
      feedback = unsupportedClaims;
      continue;
    }

    if (!websiteReviewEnabled) {
      analysis = { ...analysis, ...validateConcepts(raw, corpus) };
    }

    await stage('rendering');
    const content: OutreachEmailContent = {
      subject: composition.subject,
      opening: [
        composition.greeting,
        composition.observationParagraph,
        composition.opportunityParagraph,
        composition.solutionParagraph,
        composition.dashboardIntro,
      ]
        .filter(Boolean)
        .join('\n\n'),
      findings: analysis.observations.slice(0, 3).map((observation) => ({
        text: observation.text,
        sourceUrl: firstSource(evidence, observation.evidenceIds),
      })),
      workflow: analysis.proposedWorkflow,
      dashboard: analysis.dashboard,
      closing: composition.question,
      signature:
        signatureBlock(settings) ||
        (websiteReviewEnabled ? '' : COMPANY_RESEARCH_DEFAULT_SIGNATURE),
    };
    const issues = validateOutreachContent(content);
    if (issues.length > 0) {
      throw new PipelineError(
        `The generated email was incomplete: ${issues.join(' ')}`,
      );
    }
    return { evidence, analysis, content };
  }
}
