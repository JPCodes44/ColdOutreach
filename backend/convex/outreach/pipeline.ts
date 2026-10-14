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
  type ValidatedAnalysis,
} from './modelOutput';
import {
  ANALYSIS_SCHEMA,
  COMPOSITION_SCHEMA,
  buildAnalysisPrompt,
  buildCompositionPrompt,
  type ChatPrompt,
  type PromptCompany,
} from './prompts';
import { signatureBlock, type OutreachSettingsInput } from './settingsModel';
import type { WebsiteEvidence } from './websiteEvidence';

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

  await stage('retrieving');
  const evidence = await deps.collectEvidence(company.domain);
  if (evidence.facts.length === 0) {
    throw new PipelineError(
      'No usable lead-capture evidence was found on the retrieved pages.',
    );
  }
  const corpus = evidenceCorpus(evidence.facts, evidence.excerpts);

  await stage('analyzing');
  const analysisCompletion = await complete(
    buildAnalysisPrompt(company, settings, evidence.facts, evidence.excerpts),
    'lead_capture_analysis',
    ANALYSIS_SCHEMA,
  );
  const analysis = validateAnalysis(
    parseModelJson(analysisCompletion.text, 'analysis'),
    evidence.facts,
    corpus,
  );

  await stage('composing');
  let feedback: string[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const completion = await complete(
      buildCompositionPrompt(company, settings, analysis, feedback),
      'outreach_email',
      COMPOSITION_SCHEMA,
    );
    const { composition, unsupportedClaims } = validateComposition(
      parseModelJson(completion.text, 'composition'),
      corpus,
    );
    if (unsupportedClaims.length > 0) {
      if (attempt >= MAX_COMPOSE_ATTEMPTS) {
        throw new PipelineError(
          `The composed email kept making claims the website does not support (${unsupportedClaims
            .slice(0, 3)
            .join(', ')}). No email was saved; try regenerating.`,
        );
      }
      feedback = unsupportedClaims;
      continue;
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
      ].join('\n\n'),
      findings: analysis.observations.slice(0, 3).map((observation) => ({
        text: observation.text,
        sourceUrl: firstSource(evidence, observation.evidenceIds),
      })),
      workflow: analysis.proposedWorkflow,
      dashboard: analysis.dashboard,
      closing: composition.question,
      signature: signatureBlock(settings),
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
