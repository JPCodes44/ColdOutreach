import { convexTest } from 'convex-test';
import { vi } from 'vitest';
import schema from '../convex/schema';

// Lazily-loaded function modules for convex-test (Vite's import.meta.glob).
export const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob('../convex/**/*.*s');

export const OPERATOR_EMAIL = 'operator@coldoutreach.test';

/** A fresh backend plus a user row for `email`, without signing in. */
export async function backendWithUser(email = OPERATOR_EMAIL) {
  vi.stubEnv('ALLOWED_EMAILS', OPERATOR_EMAIL);
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert('users', { email }));
  return { t, userId };
}

/** A fresh backend accessed as the signed-in, allowlisted operator. */
export async function signedInOperator() {
  const { t, userId } = await backendWithUser();
  return t.withIdentity({ subject: `${userId}|test-session` });
}
