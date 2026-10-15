import { describe, expect, it } from 'vitest';
import { api, internal } from '../convex/_generated/api';
import {
  imapSinceDate,
  matchDeliverySignals,
  parseBounce,
  parseHeaders,
  type InboxMessage,
  type SentRef,
} from '../convex/outreach/mailboxSignals';
import { signedInOperator } from './operatorHarness';

const SENT: SentRef[] = [
  {
    id: 's1',
    providerMessageId: '<abc123@coldoutreach.test>',
    actualTo: 'owner@acme.test',
    sentAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: 's2',
    providerMessageId: '<def456@coldoutreach.test>',
    actualTo: 'info@beta.test',
    sentAt: '2026-10-11T10:00:00.000Z',
  },
];

const GMAIL_BOUNCE: InboxMessage = {
  from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
  date: '2026-10-10T10:01:00.000Z',
  headers:
    'Message-ID: <bounce999@mx.google.com>\r\nX-Failed-Recipients: owner@acme.test\r\nSubject: Delivery Status Notification (Failure)\r\n',
  source: [
    'Message-ID: <bounce999@mx.google.com>',
    '',
    "Address not found. Your message wasn't delivered to owner@acme.test.",
    'The response from the remote server was:',
    '550 5.1.1 The email account that you tried to reach does not exist.',
    '',
    'Final-Recipient: rfc822; owner@acme.test',
    'Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to',
    '    reach does not exist.',
    '',
    'Message-ID: <abc123@coldoutreach.test>',
    'Subject: A thought on your contact page',
  ].join('\r\n'),
};

describe('imapSinceDate', () => {
  it('starts two days before the earliest send (SINCE is date-only)', () => {
    expect(
      imapSinceDate([
        '2026-10-15T03:37:59.000Z',
        '2026-10-16T10:00:00.000Z',
      ]).toISOString(),
    ).toBe('2026-10-13T03:37:59.000Z');
  });
});

describe('parseHeaders', () => {
  it('joins folded lines and lower-cases names', () => {
    const headers = parseHeaders(
      'References: <a@x>\r\n <b@x>\r\nIn-Reply-To: <b@x>\r\n',
    );
    expect(headers.get('references')).toEqual(['<a@x> <b@x>']);
    expect(headers.get('in-reply-to')).toEqual(['<b@x>']);
  });
});

describe('parseBounce', () => {
  it('extracts the original Message-ID, recipient, and diagnostic', () => {
    expect(parseBounce(GMAIL_BOUNCE)).toEqual({
      messageIds: ['<abc123@coldoutreach.test>'],
      failedRecipients: ['owner@acme.test'],
      diagnostic:
        '550-5.1.1 The email account that you tried to reach does not exist.',
    });
  });
});

describe('matchDeliverySignals', () => {
  it('matches bounces by quoted Message-ID and replies by References', () => {
    const reply: InboxMessage = {
      from: 'Info <info@beta.test>',
      date: '2026-10-12T09:00:00.000Z',
      headers:
        'In-Reply-To: <DEF456@coldoutreach.test>\r\nReferences: <def456@coldoutreach.test>\r\n',
    };
    expect(matchDeliverySignals([GMAIL_BOUNCE, reply], SENT)).toEqual([
      {
        sentId: 's1',
        kind: 'bounced',
        at: '2026-10-10T10:01:00.000Z',
        detail:
          '550-5.1.1 The email account that you tried to reach does not exist.',
      },
      {
        sentId: 's2',
        kind: 'replied',
        at: '2026-10-12T09:00:00.000Z',
        detail: '',
      },
    ]);
  });

  it('falls back to the recipient only within a few days after the send', () => {
    const noQuote: InboxMessage = {
      ...GMAIL_BOUNCE,
      source: 'Final-Recipient: rfc822; info@beta.test\r\n',
      headers: 'Message-ID: <b2@mx>\r\n',
      date: '2026-10-11T12:00:00.000Z',
    };
    expect(matchDeliverySignals([noQuote], SENT)).toEqual([
      expect.objectContaining({ sentId: 's2', kind: 'bounced' }),
    ]);
    expect(
      matchDeliverySignals(
        [{ ...noQuote, date: '2026-10-20T12:00:00.000Z' }],
        SENT,
      ),
    ).toEqual([]);
    expect(
      matchDeliverySignals(
        [{ ...noQuote, date: '2026-10-11T09:00:00.000Z' }],
        SENT,
      ),
    ).toEqual([]);
  });

  it('ignores unrelated mail', () => {
    const unrelated: InboxMessage = {
      from: 'News <news@vendor.test>',
      date: '2026-10-12T09:00:00.000Z',
      headers: 'References: <other@vendor.test>\r\n',
    };
    expect(matchDeliverySignals([unrelated], SENT)).toEqual([]);
  });
});

describe('recordDeliverySignals', () => {
  it('stores the first bounce/reply and shows them in history', async () => {
    const t = await signedInOperator();
    const sentId = await t.run(async (ctx) => {
      const queueItemId = await ctx.db.insert('sendQueue', {
        batchId: 'b',
        companyId: 'acme.test',
        company: 'ACME',
        to: 'owner@acme.test',
        subject: 's',
        status: 'sent',
        scheduledAt: '2026-10-10T10:00:00.000Z',
        createdAt: '2026-10-10T10:00:00.000Z',
      });
      return ctx.db.insert('sentEmails', {
        queueItemId,
        companyId: 'acme.test',
        companyName: 'ACME',
        companyDomain: 'acme.test',
        intendedTo: 'owner@acme.test',
        actualTo: 'owner@acme.test',
        redirected: false,
        subject: 's',
        text: 't',
        html: 'h',
        sentAt: new Date().toISOString(),
        acceptance: 'smtp-accepted',
        providerMessageId: '<abc123@coldoutreach.test>',
        isTest: false,
      });
    });
    const signal = {
      sentId,
      kind: 'bounced' as const,
      at: '2026-10-14T10:00:00.000Z',
      detail: '550 no such user',
    };
    await expect(
      t.mutation(internal.delivery.recordDeliverySignals, {
        signals: [signal],
      }),
    ).resolves.toEqual({ bounced: 1, replied: 0 });
    await expect(
      t.mutation(internal.delivery.recordDeliverySignals, {
        signals: [{ ...signal, detail: 'later duplicate' }],
      }),
    ).resolves.toEqual({ bounced: 0, replied: 0 });
    const watched = await t.query(internal.delivery.watchedSentEmails, {});
    expect(watched.map((row) => row.id)).toEqual([sentId]);
    const [row] = await t.query(api.send.listSentEmails, {});
    expect(row).toMatchObject({
      bouncedAt: '2026-10-14T10:00:00.000Z',
      bounceDetail: '550 no such user',
      repliedAt: null,
    });
  });
});
