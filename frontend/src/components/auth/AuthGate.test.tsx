import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGate } from './AuthGate';
import type { OperatorIdentity } from './types';

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false },
  me: undefined as OperatorIdentity | undefined,
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: (_ref: unknown, args: unknown) =>
    args === 'skip' ? undefined : mocks.me,
}));
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

function renderGate() {
  render(
    <AuthGate>
      <p>Workspace</p>
    </AuthGate>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    mocks.auth = { isLoading: false, isAuthenticated: false };
    mocks.me = undefined;
  });

  it('shows a loading state while the session resolves', () => {
    mocks.auth = { isLoading: true, isAuthenticated: false };
    renderGate();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('asks anonymous visitors to sign in', () => {
    renderGate();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Workspace')).toBeNull();
  });

  it('blocks signed-in accounts that are not allowlisted', () => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.me = { email: 'someone@else.test', authorized: false };
    renderGate();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'someone@else.test is not allowed',
    );
    expect(screen.queryByText('Workspace')).toBeNull();
  });

  it('renders the workspace for the allowlisted operator', () => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.me = { email: 'op@x.test', authorized: true };
    renderGate();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });
});
