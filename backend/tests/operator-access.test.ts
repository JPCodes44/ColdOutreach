import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import {
  NOT_AUTHORIZED,
  SIGN_IN_REQUIRED,
  isAllowedEmail,
  parseAllowedEmails,
} from '../convex/outreach/operatorAccess';
import { api, internal } from '../convex/_generated/api';
import { backendWithUser, modules, OPERATOR_EMAIL } from './operatorHarness';

type Kind = 'query' | 'mutation' | 'action';
type Args = Record<string, unknown>;

/** Functions anyone may call: the sign-in endpoints and the identity probe. */
const OPEN = new Set([
  'auth:signIn',
  'auth:signOut',
  'auth:isAuthenticated',
  'operator:me',
]);

/**
 * Every operator-only public function with valid sample arguments. The test
 * below fails if a public function is added without being listed here.
 */
function guardedCalls(ids: {
  queue: string;
  sent: string;
}): Record<string, Args> {
  return {
    'settings:get': {},
    'settings:save': {
      niche: 'Clinics',
      offer: 'Lead response',
      senderName: '',
      signature: '',
      customInstructions: '',
    },
    'outreachRuns:requestRuns': { companyIds: [] },
    'outreachRuns:listPipelineCompanies': {},
    'outreachRuns:getReview': { companyId: 'a.test' },
    'outreachRuns:saveDraftEdits': {
      companyId: 'a.test',
      subject: 's',
      opening: 'o',
      closing: 'c',
      signature: '',
    },
    'outreachRuns:approveDraft': { companyId: 'a.test' },
    'outreachRuns:unapproveDraft': { companyId: 'a.test' },
    'companies:research': {
      industry: 'x',
      companySize: 'x',
      location: 'x',
      techStack: [],
      limit: 1,
    },
    'companies:importCompanies': { companies: [] },
    'companies:deleteCompanies': { externalIds: [] },
    'emails:listEmailTableRows': {},
    'emails:listCompaniesWithEmails': {},
    'emails:getCompanyEmailDrafts': { companyId: 'a.test' },
    'emails:setEmailRow': { companyId: 'a.test' },
    'usageDb:getBalances': {},
    'usageDb:setBalance': { provider: 'openai', balanceUsd: 1 },
    'send:getScheduleSummary': { companyIds: [] },
    'send:enqueueSend': {
      companyIds: [],
      scheduledAtMs: 0,
      method: 'immediate',
    },
    'send:resolveUncertainSend': { itemId: ids.queue, outcome: 'sent' },
    'send:cancelScheduledSends': { companyIds: [] },
    'send:cancelQueueItem': { itemId: ids.queue },
    'send:listQueue': {},
    'send:listSentEmails': {},
    'send:getSentEmail': { id: ids.sent },
    'send:purgeSettledCompanies': { companyIds: [] },
    'delivery:checkNow': {},
  };
}

interface Registered {
  isPublic?: boolean;
  isQuery?: boolean;
  isMutation?: boolean;
  isAction?: boolean;
}

/** Discover every public function exported by the Convex modules. */
async function publicFunctions(): Promise<Map<string, Kind>> {
  const found = new Map<string, Kind>();
  for (const [path, load] of Object.entries(modules)) {
    const match = /convex\/(.+)\.ts$/.exec(path);
    if (match === null || match[1]!.startsWith('_generated')) continue;
    const exports = (await load()) as Record<string, unknown>;
    for (const [name, value] of Object.entries(exports)) {
      if (typeof value !== 'function') continue;
      const fn = value as Registered;
      if (fn.isPublic !== true) continue;
      const kind: Kind = fn.isQuery
        ? 'query'
        : fn.isMutation
          ? 'mutation'
          : 'action';
      found.set(`${match[1]}:${name}`, kind);
    }
  }
  return found;
}

async function seedIds(t: Awaited<ReturnType<typeof backendWithUser>>['t']) {
  return t.run(async (ctx) => {
    const queue = await ctx.db.insert('sendQueue', {
      batchId: 'b',
      companyId: 'a.test',
      company: 'A',
      to: 'owner@a.test',
      subject: 's',
      status: 'uncertain',
      scheduledAt: '2026-10-14T00:00:00.000Z',
      createdAt: '2026-10-14T00:00:00.000Z',
    });
    const sent = await ctx.db.insert('sentEmails', {
      queueItemId: queue,
      companyId: 'a.test',
      companyName: 'A',
      companyDomain: 'a.test',
      intendedTo: 'owner@a.test',
      actualTo: 'owner@a.test',
      redirected: false,
      subject: 's',
      text: 't',
      html: 'h',
      sentAt: '2026-10-14T00:00:00.000Z',
      acceptance: 'smtp-accepted',
      isTest: false,
    });
    return { queue, sent };
  });
}

type Caller = {
  query: (ref: never, args: never) => Promise<unknown>;
  mutation: (ref: never, args: never) => Promise<unknown>;
  action: (ref: never, args: never) => Promise<unknown>;
};

async function expectEveryCallRefused(
  t: Awaited<ReturnType<typeof backendWithUser>>['t'],
  caller: Caller,
  message: string,
) {
  const calls = guardedCalls(await seedIds(t));
  const kinds = await publicFunctions();
  for (const [name, args] of Object.entries(calls)) {
    const kind = kinds.get(name);
    expect(kind, `${name} should be a public function`).toBeDefined();
    const ref = makeFunctionReference(name) as never;
    await expect(
      caller[kind!](ref, args as never),
      `${name} must refuse the caller`,
    ).rejects.toThrow(message);
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('operator allowlist', () => {
  it('parses a comma or whitespace separated list, case-insensitively', () => {
    expect([...parseAllowedEmails(' A@x.test, b@y.test\nc@z.test ')]).toEqual([
      'a@x.test',
      'b@y.test',
      'c@z.test',
    ]);
    expect(isAllowedEmail('B@Y.test', 'a@x.test,b@y.test')).toBe(true);
    expect(isAllowedEmail('d@x.test', 'a@x.test')).toBe(false);
  });

  it('fails closed when the allowlist is unset or empty', () => {
    expect(isAllowedEmail('a@x.test', undefined)).toBe(false);
    expect(isAllowedEmail('a@x.test', ' ')).toBe(false);
    expect(isAllowedEmail(undefined, 'a@x.test')).toBe(false);
  });
});

describe('public function access', () => {
  it('guards every public function except the sign-in endpoints', async () => {
    const kinds = await publicFunctions();
    const guarded = Object.keys(guardedCalls({ queue: '', sent: '' }));
    const unlisted = [...kinds.keys()].filter(
      (name) => !OPEN.has(name) && !guarded.includes(name),
    );
    expect(unlisted).toEqual([]);
  });

  it('refuses anonymous callers', async () => {
    const { t } = await backendWithUser();
    await expectEveryCallRefused(t, t as unknown as Caller, SIGN_IN_REQUIRED);
  });

  it('refuses signed-in accounts that are not on the allowlist', async () => {
    const { t, userId } = await backendWithUser('intruder@elsewhere.test');
    const intruder = t.withIdentity({ subject: `${userId}|session` });
    await expectEveryCallRefused(
      t,
      intruder as unknown as Caller,
      NOT_AUTHORIZED,
    );
  });

  it('refuses everyone, including the operator, when the allowlist is unset', async () => {
    const { t, userId } = await backendWithUser();
    vi.stubEnv('ALLOWED_EMAILS', '');
    const operator = t.withIdentity({ subject: `${userId}|session` });
    await expect(operator.query(api.settings.get, {})).rejects.toThrow(
      NOT_AUTHORIZED,
    );
  });

  it('lets the allowlisted operator through and reports identity', async () => {
    const { t, userId } = await backendWithUser();
    const operator = t.withIdentity({ subject: `${userId}|session` });
    await expect(operator.query(api.settings.get, {})).resolves.toMatchObject({
      version: 0,
    });
    await expect(operator.query(api.operator.me, {})).resolves.toEqual({
      email: OPERATOR_EMAIL,
      authorized: true,
    });
    await expect(t.query(api.operator.me, {})).resolves.toBeNull();
    // Actions check the identity themselves (no Gmail configured: no-op).
    vi.stubEnv('GMAIL_USER', '');
    await expect(operator.action(api.delivery.checkNow, {})).resolves.toEqual({
      bounced: 0,
      replied: 0,
    });
  });
});

describe('removeAccount', () => {
  it('deletes the user with its sessions and logins, revoking access', async () => {
    const { t, userId } = await backendWithUser();
    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert('authSessions', {
        userId,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert('authRefreshTokens', {
        sessionId,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'password',
        providerAccountId: OPERATOR_EMAIL,
      });
    });
    await expect(
      t.mutation(internal.operator.removeAccount, {
        email: ' Operator@ColdOutreach.test ',
      }),
    ).resolves.toEqual({ removed: true });
    const left = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      sessions: (await ctx.db.query('authSessions').collect()).length,
      tokens: (await ctx.db.query('authRefreshTokens').collect()).length,
      accounts: (await ctx.db.query('authAccounts').collect()).length,
    }));
    expect(left).toEqual({ users: 0, sessions: 0, tokens: 0, accounts: 0 });
    const operator = t.withIdentity({ subject: `${userId}|session` });
    await expect(operator.query(api.settings.get, {})).rejects.toThrow(
      NOT_AUTHORIZED,
    );
    await expect(
      t.mutation(internal.operator.removeAccount, { email: 'nobody@x.test' }),
    ).resolves.toEqual({ removed: false });
  });
});
