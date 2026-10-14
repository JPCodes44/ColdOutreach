import type { ReviewData } from './types';

/** Fixture shaped like `outreachRuns:getReview`. */
export function reviewFixture(overrides: Partial<ReviewData> = {}): ReviewData {
  return {
    company: {
      id: 'acme.test',
      name: 'Acme Plumbing',
      domain: 'acme.test',
      industry: 'Home services',
      recipients: ['owner@acme.test'],
    },
    draftState: 'ready',
    latestRun: {
      id: 'run1',
      status: 'completed',
      stage: 'done',
      error: null,
      startedAt: 1,
      finishedAt: 2,
      settingsVersion: 3,
    },
    draft: {
      id: 'draft1',
      status: 'ready',
      content: {
        subject: 'A thought on the Acme contact page',
        opening:
          'Hi Acme team,\n\nI noticed your site lists only a phone number.',
        findings: [
          {
            text: 'Phone number listed on the homepage.',
            sourceUrl: 'https://acme.test/',
          },
        ],
        workflow: [{ name: 'Capture', description: 'A short inquiry form.' }],
        dashboard: {
          title: 'Lead response overview',
          metrics: [{ label: 'New inquiries', description: 'Leads captured.' }],
          stages: ['New', 'Contacted'],
        },
        closing: 'Would a quick sketch be useful?',
        signature: 'Sam Rivera',
      },
      approvedAt: null,
      editedAt: null,
      updatedAt: '2026-10-14T12:00:00.000Z',
      settingsVersion: 3,
    },
    evidence: {
      sources: [
        {
          url: 'https://acme.test/',
          title: 'Acme Plumbing',
          fetchedAt: '2026-10-14T11:59:00.000Z',
        },
      ],
      facts: [
        {
          id: 'E1',
          kind: 'contact',
          sourceUrl: 'https://acme.test/',
          text: 'Phone number(s) listed: 555-123-4567. Open 24 hours.',
        },
        {
          id: 'E2',
          kind: 'absence',
          sourceUrl: 'https://acme.test/',
          text: 'No HTML form was found in the static HTML.',
        },
      ],
      skipped: [
        {
          url: 'https://acme.test/contact',
          reason: 'acme.test responded with HTTP 404.',
        },
      ],
    },
    analysis: {
      businessSummary: 'A local plumbing company.',
      observations: [
        { text: 'The homepage lists a phone number.', evidenceIds: ['E1'] },
      ],
      opportunities: [
        {
          title: 'Capture after-hours inquiries',
          observation: 'No web form was found.',
          evidenceIds: ['E2'],
          hypothesis: 'Evening visitors may have no easy way to reach out.',
          suggestedImprovement:
            'Add a short form with instant acknowledgement.',
        },
      ],
      proposedWorkflow: [
        { name: 'Capture', description: 'A short inquiry form.' },
      ],
      dashboard: {
        title: 'Lead response overview',
        metrics: [{ label: 'New inquiries', description: 'Leads captured.' }],
        stages: ['New', 'Contacted'],
      },
      droppedCount: 0,
    },
    generatedAt: 2,
    ...overrides,
  };
}
