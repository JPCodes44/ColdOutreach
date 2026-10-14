import type { QueueRow, SentEmailRow } from './types';

/** Test fixture builders for history components. */
export function queueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: 'q1',
    companyId: 'acme.test',
    company: 'Acme',
    to: 'owner@acme.test',
    actualTo: null,
    subject: 'A thought on your contact page',
    status: 'queued',
    stale: false,
    scheduledAt: '2026-10-14T12:00:00.000Z',
    sentAt: null,
    error: null,
    isTest: false,
    ...overrides,
  };
}

export function sentRow(overrides: Partial<SentEmailRow> = {}): SentEmailRow {
  return {
    id: 's1',
    companyName: 'Acme',
    companyDomain: 'acme.test',
    intendedTo: 'owner@acme.test',
    actualTo: 'owner@acme.test',
    redirected: false,
    subject: 'A thought on your contact page',
    sentAt: '2026-10-14T12:00:00.000Z',
    acceptance: 'smtp-accepted',
    providerMessageId: '<m1>',
    isTest: false,
    ...overrides,
  };
}
