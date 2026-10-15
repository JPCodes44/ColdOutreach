import { useConvexAuth, useQuery } from 'convex/react';
import { AccessDenied } from './AccessDenied';
import { SignInScreen } from './SignInScreen';
import { operatorMeQuery } from './api';
import type { AuthGateProps } from './types';

/** Render the app only for a signed-in, allowlisted operator. */
export function AuthGate({ children }: AuthGateProps) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(operatorMeQuery, isAuthenticated ? {} : 'skip');

  if (isLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="authScreen" role="status">
        <p className="authMuted">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated || me === null || me === undefined) {
    return <SignInScreen />;
  }
  if (!me.authorized) return <AccessDenied email={me.email} />;
  return <>{children}</>;
}
