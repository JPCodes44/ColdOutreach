import type { ReactNode } from 'react';

/** Shape returned by the `operator:me` Convex query. */
export type OperatorIdentity = { email: string; authorized: boolean } | null;

export type SignInFlow = 'signIn' | 'signUp';

export interface AuthGateProps {
  children: ReactNode;
}

export interface AccessDeniedProps {
  email: string;
}
