import { SignOutButton } from './SignOutButton';
import type { AccessDeniedProps } from './types';

/** Signed in, but the address is not on the ALLOWED_EMAILS allowlist. */
export function AccessDenied({ email }: AccessDeniedProps) {
  return (
    <div className="authScreen">
      <div className="authCard" role="alert">
        <h1 className="authTitle">Not authorized</h1>
        <p className="authMuted">
          {email || 'This account'} is not allowed to use this ColdOutreach
          deployment.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
