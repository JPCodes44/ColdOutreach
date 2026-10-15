import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import {
  NOT_AUTHORIZED,
  isAllowedEmail,
  normalizeEmail,
} from './outreach/operatorAccess';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Password sign-in restricted to the ALLOWED_EMAILS allowlist. Convex Auth
 * rate-limits failed sign-in attempts per account.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email =
          typeof params.email === 'string' ? normalizeEmail(params.email) : '';
        if (!isAllowedEmail(email, process.env.ALLOWED_EMAILS)) {
          throw new Error(NOT_AUTHORIZED);
        }
        return { email };
      },
      validatePasswordRequirements(password) {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new Error(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          );
        }
      },
    }),
  ],
});
