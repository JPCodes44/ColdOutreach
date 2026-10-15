import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccessDenied } from './AccessDenied';

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

describe('AccessDenied', () => {
  it('names the account and offers sign-out', () => {
    render(<AccessDenied email="x@y.test" />);
    expect(screen.getByRole('alert')).toHaveTextContent('x@y.test');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
