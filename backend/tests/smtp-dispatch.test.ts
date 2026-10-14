import { describe, expect, it } from 'vitest';
import {
  dispatchQueueItem,
  redirectedMessage,
  type ClaimedSend,
  type DispatchDeps,
  type MailMessage,
} from '../convex/outreach/dispatch';
import {
  classifySmtpError,
  describeSmtpError,
  redactSecrets,
} from '../convex/outreach/smtpOutcome';

const CLAIM: ClaimedSend = {
  to: 'owner@prospect.test',
  actualTo: 'owner@prospect.test',
  snapshot: {
    subject: 'Hello',
    text: 'Plain body',
    html: '<html><body style="x"><p>Body</p></body></html>',
  },
  isTest: false,
};

function smtpError(fields: Record<string, unknown>) {
  return Object.assign(
    new Error(String(fields.message ?? 'smtp error')),
    fields,
  );
}

function harness(
  sendMail: DispatchDeps['sendMail'],
  claim: ClaimedSend | null = CLAIM,
  redirectTo?: string,
) {
  const calls: string[] = [];
  const sent: MailMessage[] = [];
  let claimedWith: string | undefined = 'unset';
  const deps: DispatchDeps = {
    redirectTo,
    secrets: ['s3cret-app-pass'],
    claim: async (actualTo) => {
      claimedWith = actualTo;
      calls.push('claim');
      return claim === null
        ? null
        : { ...claim, actualTo: actualTo ?? claim.to };
    },
    sendMail: async (message) => {
      sent.push(message);
      calls.push('send');
      return sendMail(message);
    },
    markSent: async (id) => void calls.push(`sent:${id}`),
    markFailed: async (error) => void calls.push(`failed:${error}`),
    markUncertain: async (error) => void calls.push(`uncertain:${error}`),
  };
  return { deps, calls, sent, claimed: () => claimedWith };
}

describe('classifySmtpError', () => {
  it('treats explicit server rejections and pre-DATA failures as definite', () => {
    expect(
      classifySmtpError(
        smtpError({ code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535 }),
      ),
    ).toBe('failed');
    expect(
      classifySmtpError(
        smtpError({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 }),
      ),
    ).toBe('failed');
    expect(
      classifySmtpError(
        smtpError({ code: 'EMESSAGE', command: 'DATA', responseCode: 552 }),
      ),
    ).toBe('failed');
    expect(
      classifySmtpError(smtpError({ code: 'ECONNECTION', command: 'CONN' })),
    ).toBe('failed');
    expect(
      classifySmtpError(smtpError({ code: 'ETIMEDOUT', command: 'MAIL FROM' })),
    ).toBe('failed');
  });

  it('treats breaks during or after message data as uncertain', () => {
    expect(
      classifySmtpError(smtpError({ code: 'ETIMEDOUT', command: 'DATA' })),
    ).toBe('uncertain');
    expect(classifySmtpError(smtpError({ code: 'ESOCKET' }))).toBe('uncertain');
    expect(classifySmtpError(new Error('mystery'))).toBe('uncertain');
    expect(classifySmtpError('string error')).toBe('uncertain');
  });
});

describe('dispatchQueueItem', () => {
  it('marks sent only after Gmail accepts, with the provider message id', async () => {
    const h = harness(async () => ({
      messageId: '<m1@gmail>',
      accepted: ['owner@prospect.test'],
      rejected: [],
    }));
    await expect(dispatchQueueItem(h.deps)).resolves.toBe('sent');
    expect(h.calls).toEqual(['claim', 'send', 'sent:<m1@gmail>']);
    expect(h.sent[0]).toEqual({ to: 'owner@prospect.test', ...CLAIM.snapshot });
  });

  it('does nothing when the row cannot be claimed (already dispatched or canceled)', async () => {
    const h = harness(async () => ({ accepted: ['x'], rejected: [] }), null);
    await expect(dispatchQueueItem(h.deps)).resolves.toBe('skipped');
    expect(h.calls).toEqual(['claim']);
  });

  it('records a definite rejection as failed, redacting credentials', async () => {
    const h = harness(async () => {
      throw smtpError({
        code: 'EAUTH',
        responseCode: 535,
        message: 'Invalid login for s3cret-app-pass',
      });
    });
    await expect(dispatchQueueItem(h.deps)).resolves.toBe('failed');
    expect(h.calls[2]).toBe('failed:EAUTH 535 Invalid login for [redacted]');
    expect(h.calls.some((call) => call.startsWith('sent'))).toBe(false);
  });

  it('holds an ambiguous outcome as uncertain and never retries', async () => {
    let attempts = 0;
    const h = harness(async () => {
      attempts += 1;
      throw smtpError({
        code: 'ETIMEDOUT',
        command: 'DATA',
        message: 'Timeout',
      });
    });
    await expect(dispatchQueueItem(h.deps)).resolves.toBe('uncertain');
    expect(attempts).toBe(1);
    expect(h.calls[2]).toMatch(
      /^uncertain:Connection ended without a clear Gmail response/,
    );
  });

  it('fails when Gmail rejects every recipient', async () => {
    const h = harness(async () => ({
      accepted: [],
      rejected: ['owner@prospect.test'],
    }));
    await expect(dispatchQueueItem(h.deps)).resolves.toBe('failed');
  });

  it('applies the test redirect and labels the intended recipient distinctly', async () => {
    const h = harness(
      async () => ({ accepted: ['inbox@me.test'], rejected: [] }),
      CLAIM,
      ' inbox@me.test ',
    );
    await dispatchQueueItem(h.deps);
    expect(h.claimed()).toBe('inbox@me.test');
    expect(h.sent[0]!.to).toBe('inbox@me.test');
    expect(h.sent[0]!.subject).toBe(
      '[Redirected for owner@prospect.test] Hello',
    );
    expect(h.sent[0]!.text).toMatch(
      /^Redirected test send\. Intended recipient: owner@prospect\.test/,
    );
    expect(h.sent[0]!.html).toContain('<body style="x"><p');
  });
});

describe('redirectedMessage and redaction', () => {
  it('leaves non-redirected mail untouched', () => {
    expect(redirectedMessage(CLAIM)).toEqual({
      to: CLAIM.to,
      ...CLAIM.snapshot,
    });
  });

  it('redacts configured values, including space-separated app passwords', () => {
    expect(
      redactSecrets('pw abcd efgh ijkl / abcdefghijkl', ['abcd efgh ijkl']),
    ).toBe('pw [redacted] / [redacted]');
    expect(redactSecrets('nothing here', [undefined, ''])).toBe('nothing here');
    expect(describeSmtpError({ code: 'ESOCKET', message: 'reset' }, [])).toBe(
      'ESOCKET reset',
    );
  });
});
