// Validation of model output against retrieved evidence. Anything malformed
// or unsupported is dropped or rejected; nothing here invents content.

import { evidenceCorpus, findUnsupportedClaims } from '@emailstrat/common';
import type { EvidenceFact } from './websiteEvidence';

/** A pipeline failure whose message is safe to show the user. */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineError';
  }
}

export interface ValidatedObservation {
  text: string;
  evidenceIds: string[];
}

export interface ValidatedOpportunity {
  title: string;
  observation: string;
  evidenceIds: string[];
  hypothesis: string;
  suggestedImprovement: string;
}

export interface ValidatedAnalysis {
  businessSummary: string;
  observations: ValidatedObservation[];
  opportunities: ValidatedOpportunity[];
  proposedWorkflow: { name: string; description: string }[];
  dashboard: {
    title: string;
    metrics: { label: string; description: string }[];
    stages: string[];
  };
  /** Items removed because they cited no valid evidence or made unsupported claims. */
  droppedCount: number;
}

export interface ValidatedComposition {
  subject: string;
  greeting: string;
  observationParagraph: string;
  opportunityParagraph: string;
  solutionParagraph: string;
  dashboardIntro: string;
  question: string;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Internal evidence references like "(E3, E6)" or "[E2]" never belong in email text. */
export function stripEvidenceIds(text: string): string {
  return text
    .replace(/\s*[([]\s*E\d+(?:\s*(?:,|and|&)\s*E\d+)*\s*[)\]]/gi, '')
    .replace(/\s+([.,;:!?])/g, '$1');
}

function str(value: unknown, max: number): string {
  return typeof value === 'string'
    ? stripEvidenceIds(value).replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Parse a model's JSON text, failing safely on malformed output. */
export function parseModelJson(
  text: string | null | undefined,
  step: string,
): Json {
  if (text === null || text === undefined || text.trim() === '') {
    throw new PipelineError(`The ${step} step returned no output.`);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new PipelineError(`The ${step} step returned malformed output.`);
  }
}

/** Plain-text corpus of everything retrieved, for claim verification. */
export { evidenceCorpus };

function validIds(value: unknown, known: Set<string>): string[] {
  return [
    ...new Set(
      arr(value)
        .map((id) => str(id, 10).toUpperCase())
        .filter((id) => known.has(id)),
    ),
  ];
}

/**
 * Keep only observations/opportunities that cite real evidence ids and make
 * no unsupported quantitative claims. Throws when nothing usable remains.
 */
export function validateAnalysis(
  raw: Json,
  facts: EvidenceFact[],
  corpus: string,
): ValidatedAnalysis {
  const known = new Set(facts.map((fact) => fact.id));
  let dropped = 0;
  // Check each field on its own so a hedge in one cannot mask a claim in another.
  const supported = (...texts: string[]) =>
    // Hypotheses are labeled as such on the review screen and never sent
    // verbatim, so only the email itself is held to the outcome-promise rule.
    texts.every(
      (text) =>
        findUnsupportedClaims(text, corpus, { outcomePromises: false })
          .length === 0,
    );

  const observations: ValidatedObservation[] = [];
  for (const item of arr(raw.observations)) {
    if (!isObject(item)) continue;
    const text = str(item.text, 300);
    const evidenceIds = validIds(item.evidenceIds, known);
    if (text && evidenceIds.length > 0 && supported(text)) {
      observations.push({ text, evidenceIds });
    } else dropped += 1;
  }

  const opportunities: ValidatedOpportunity[] = [];
  for (const item of arr(raw.opportunities)) {
    if (!isObject(item)) continue;
    const opportunity = {
      title: str(item.title, 120),
      observation: str(item.observation, 400),
      evidenceIds: validIds(item.evidenceIds, known),
      hypothesis: str(item.hypothesis, 400),
      suggestedImprovement: str(item.suggestedImprovement, 400),
    };
    if (
      opportunity.title &&
      opportunity.observation &&
      opportunity.evidenceIds.length > 0 &&
      supported(
        opportunity.title,
        opportunity.observation,
        opportunity.hypothesis,
        opportunity.suggestedImprovement,
      )
    ) {
      opportunities.push(opportunity);
    } else dropped += 1;
  }

  if (opportunities.length === 0) {
    throw new PipelineError(
      'The analysis did not produce any opportunity backed by the retrieved website evidence. No email was generated.',
    );
  }

  const proposedWorkflow = arr(raw.proposedWorkflow)
    .filter(isObject)
    .map((step) => ({
      name: str(step.name, 60),
      description: str(step.description, 240),
    }))
    .filter(
      (step) =>
        step.name && step.description && supported(step.name, step.description),
    )
    .slice(0, 5);

  const dashboardRaw = isObject(raw.dashboard) ? raw.dashboard : {};
  const metrics = arr(dashboardRaw.metrics)
    .filter(isObject)
    .map((metric) => ({
      label: str(metric.label, 60),
      description: str(metric.description, 160),
    }))
    // Labels only: drop any metric that smuggles in a figure.
    .filter(
      (metric) =>
        metric.label &&
        !/\d/.test(metric.label) &&
        supported(metric.description),
    )
    .slice(0, 6);
  const stages = arr(dashboardRaw.stages)
    .map((stage) => str(stage, 30))
    .filter((stage) => stage && !/\d/.test(stage))
    .slice(0, 6);

  if (proposedWorkflow.length === 0 || metrics.length === 0) {
    throw new PipelineError(
      'The analysis returned an incomplete workflow or dashboard concept.',
    );
  }

  return {
    businessSummary: str(raw.businessSummary, 400),
    observations: observations.slice(0, 5),
    opportunities: opportunities.slice(0, 3),
    proposedWorkflow,
    dashboard: {
      title: str(dashboardRaw.title, 80) || 'Lead response overview',
      metrics,
      stages,
    },
    droppedCount: dropped,
  };
}

/** Check the composed email fields; returns unsupported claims to retry on. */
export function validateComposition(
  raw: Json,
  corpus: string,
): { composition: ValidatedComposition; unsupportedClaims: string[] } {
  const composition: ValidatedComposition = {
    subject: str(raw.subject, 120),
    greeting: str(raw.greeting, 120),
    observationParagraph: str(raw.observationParagraph, 800),
    opportunityParagraph: str(raw.opportunityParagraph, 800),
    solutionParagraph: str(raw.solutionParagraph, 800),
    dashboardIntro: str(raw.dashboardIntro, 300),
    question: str(raw.question, 300),
  };
  const missing = Object.entries(composition)
    .filter(([, value]) => value.length === 0)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new PipelineError(
      `The composed email was missing: ${missing.join(', ')}.`,
    );
  }
  if (!composition.question.includes('?')) {
    throw new PipelineError(
      'The composed email did not end with a conversation-starting question.',
    );
  }
  const unsupportedClaims = findUnsupportedClaims(
    Object.values(composition).join('\n'),
    corpus,
  );
  return { composition, unsupportedClaims };
}
