import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignOutButton } from './SignOutButton';

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: mocks.signOut }),
}));

describe('SignOutButton', () => {
  it('ends the session', async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
