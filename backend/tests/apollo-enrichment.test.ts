import { describe, expect, it, vi } from 'vitest';
import { enrichRecipients } from '../convex/outreach/apolloEnrichment';

const person = (id: string, extra = {}) => ({
  id,
  name: id,
  title: 'Director',
  seniority: 'director',
  email: `${id}@acme.test`,
  email_status: 'verified',
  organization: { primary_domain: 'acme.test' },
  ...extra,
});
function provider(matches: unknown[]) {
  const responses = [
    {
      people: [
        { id: 'boss1', has_email: true },
        { id: 'boss2', has_email: true },
      ],
    },
    { people: [{ id: 'worker', has_email: true }] },
    { matches, credits_consumed: 3 },
  ];
  return vi.fn(
    async () =>
      new Response(JSON.stringify(responses.shift()), { status: 200 }),
  );
}
describe('Apollo recipient enrichment', () => {
  it('searches separate senior and specialist pools then reveals only three work emails', async () => {
    const fetcher = provider([
      person('boss2'),
      person('worker', { seniority: 'senior', title: 'Process engineer' }),
      person('boss1'),
    ]);
    const result = await enrichRecipients({
      apiKey: 'secret',
      domain: 'https://www.acme.test/about',
      targetTitles: ['process engineer'],
      slots: ['email1', 'email2', 'email3'],
      existingEmails: [],
      fetcher,
    });
    expect(result.contacts.map((c) => [c.slot, c.email])).toEqual([
      ['email1', 'boss1@acme.test'],
      ['email2', 'boss2@acme.test'],
      ['email3', 'worker@acme.test'],
    ]);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[1]![1].body as string)).toMatchObject({
      person_titles: ['process engineer'],
      person_seniorities: ['senior', 'entry'],
    });
    expect(calls[2]![0]).toContain('reveal_personal_emails=false');
    expect(calls[2]![0]).toContain('run_waterfall_email=false');
    expect(JSON.parse(calls[2]![1].body as string)).toEqual({
      details: [{ id: 'boss1' }, { id: 'boss2' }, { id: 'worker' }],
    });
    expect(result.creditsConsumed).toBe(3);
  });
  it('rejects previous employers, unverified emails and personal addresses', async () => {
    const fetcher = provider([
      person('boss1', { organization: { primary_domain: 'other.test' } }),
      person('boss2', { email_status: 'guessed' }),
      person('worker', { email: 'someone@gmail.com', seniority: 'entry' }),
    ]);
    const result = await enrichRecipients({
      apiKey: 'secret',
      domain: 'acme.test',
      targetTitles: ['engineer'],
      slots: ['email1', 'email2', 'email3'],
      existingEmails: [],
      fetcher,
    });
    expect(result.contacts).toEqual([]);
  });
  it('only pays for missing slots and never reuses an existing email', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ people: [{ id: 'worker', has_email: true }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            matches: [
              person('worker', {
                seniority: 'senior',
                email: 'existing@acme.test',
              }),
            ],
          }),
        ),
      );
    const result = await enrichRecipients({
      apiKey: 'secret',
      domain: 'acme.test',
      targetTitles: ['engineer'],
      slots: ['email3'],
      existingEmails: ['EXISTING@acme.test'],
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.contacts).toEqual([]);
  });
  it('skips saved Apollo IDs when retrying a partially filled management pool', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            people: [
              { id: 'boss1', has_email: true },
              { id: 'boss2', has_email: true },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ matches: [person('boss2')] })),
      );
    const result = await enrichRecipients({
      apiKey: 'secret',
      domain: 'acme.test',
      targetTitles: ['engineer'],
      slots: ['email2'],
      existingEmails: ['boss1@acme.test'],
      existingApolloIds: ['boss1'],
      fetcher,
    });
    expect(result.contacts).toMatchObject([
      { slot: 'email2', apolloId: 'boss2' },
    ]);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({
      details: [{ id: 'boss2' }],
    });
  });

  it('sanitizes provider errors without echoing credentials or response bodies', async () => {
    const fetcher = vi.fn(async () => new Response('secret', { status: 429 }));
    await expect(
      enrichRecipients({
        apiKey: 'secret',
        domain: 'acme.test',
        targetTitles: ['engineer'],
        slots: ['email1'],
        existingEmails: [],
        fetcher,
      }),
    ).rejects.toThrow('Apollo rate limit reached');
  });
});
