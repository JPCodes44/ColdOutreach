import type { PipelineCompanyRow } from './types';

/** Shared fixture rows for pipeline component tests. */
export function pipelineRow(
  overrides: Partial<PipelineCompanyRow> = {},
): PipelineCompanyRow {
  return {
    id: 'acme.test',
    name: 'Acme Plumbing',
    domain: 'acme.test',
    industry: 'Home services',
    segment: null,
    confidence: 85,
    draftState: 'none',
    stage: null,
    lastError: null,
    subject: '',
    recipientCount: 1,
    sendStatus: 'Not Sent',
    ...overrides,
  };
}
