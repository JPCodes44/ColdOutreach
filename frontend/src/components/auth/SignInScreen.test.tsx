import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInScreen } from './SignInScreen';

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: mocks.signIn, signOut: vi.fn() }),
}));

async function fill() {
  await userEvent.type(screen.getByLabelText('Email'), 'op@x.test');
  await userEvent.type(screen.getByLabelText('Password'), 'a-long-passphrase');
}

describe('SignInScreen', () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
  });

  it('signs in with the password provider', async () => {
    mocks.signIn.mockResolvedValue({ signingIn: true });
    render(<SignInScreen />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const [provider, form] = mocks.signIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe('password');
    expect(form.get('flow')).toBe('signIn');
    expect(form.get('email')).toBe('op@x.test');
  });

  it('switches to account creation and shows server errors', async () => {
    mocks.signIn.mockImplementation(async () => {
      throw new Error(
        'Uncaught Error: This account is not authorized to use ColdOutreach.\n at x',
      );
    });
    render(<SignInScreen />);
    await userEvent.click(
      screen.getByRole('button', { name: /Create account/ }),
    );
    await fill();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    );
    const [, form] = mocks.signIn.mock.calls[0] as [string, FormData];
    expect(form.get('flow')).toBe('signUp');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is not authorized to use ColdOutreach.',
    );
  });
});
