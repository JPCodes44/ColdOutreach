import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import { backendWithUser, OPERATOR_EMAIL } from './operatorHarness';

const get = makeFunctionReference<
  'query',
  Record<string, never>,
  { email: string } | null
>('emailOnboarding:get');
const save = makeFunctionReference<'mutation', { email: string }, null>(
  'emailOnboarding:save',
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('email onboarding', () => {
  it('saves and replaces an address only for the signed-in account', async () => {
    const { t, userId } = await backendWithUser();
    const operator = t.withIdentity({ subject: `${userId}|session` });
    expect(await operator.query(get, {})).toBeNull();
    await operator.mutation(save, { email: ' Client@Proton.me ' });
    expect(await operator.query(get, {})).toEqual({
      email: 'client@proton.me',
    });

    const otherId = await t.run((ctx) =>
      ctx.db.insert('users', { email: 'other@client.test' }),
    );
    vi.stubEnv('ALLOWED_EMAILS', `${OPERATOR_EMAIL},other@client.test`);
    const other = t.withIdentity({ subject: `${otherId}|session` });
    expect(await other.query(get, {})).toBeNull();
    await other.mutation(save, { email: 'other@proton.me' });
    await operator.mutation(save, { email: 'updated@proton.me' });
    expect(await operator.query(get, {})).toEqual({
      email: 'updated@proton.me',
    });
    expect(await other.query(get, {})).toEqual({ email: 'other@proton.me' });
  });

  it.each([
    '',
    'not-an-email',
    'a@b',
    'a@b.test\npassword',
    `${'x'.repeat(250)}@proton.me`,
  ])('rejects an invalid address: %s', async (email) => {
    const { t, userId } = await backendWithUser();
    const operator = t.withIdentity({ subject: `${userId}|session` });
    await expect(operator.mutation(save, { email })).rejects.toThrow(
      'Enter a valid email address',
    );
    expect(await operator.query(get, {})).toBeNull();
  });
});
