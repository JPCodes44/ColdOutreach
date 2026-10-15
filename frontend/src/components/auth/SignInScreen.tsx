import { useState, type FormEvent } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { errorMessage } from '../shared/errorMessage';
import type { SignInFlow } from './types';

/** Email + password sign-in (or one-time account creation) for the operator. */
export function SignInScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<SignInFlow>('signIn');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('flow', flow);
    setBusy(true);
    setError(null);
    try {
      await signIn('password', form);
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          flow === 'signIn'
            ? 'Sign-in failed. Check your email and password.'
            : 'Could not create the account.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const creating = flow === 'signUp';
  return (
    <div className="authScreen">
      <form className="authCard" onSubmit={(event) => void submit(event)}>
        <h1 className="authTitle">ColdOutreach</h1>
        <p className="authMuted">
          {creating
            ? 'Create the operator account. Only allowlisted emails can sign up.'
            : 'Sign in to continue.'}
        </p>
        <label className="authField">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="authField">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={creating ? 12 : undefined}
            required
          />
        </label>
        {error !== null ? (
          <p className="authError" role="alert">
            {error}
          </p>
        ) : null}
        <button className="authPrimary" type="submit" disabled={busy}>
          {creating ? 'Create account' : 'Sign in'}
        </button>
        <button
          className="authLink"
          type="button"
          onClick={() => setFlow(creating ? 'signIn' : 'signUp')}
        >
          {creating
            ? 'I already have an account'
            : 'First time? Create account'}
        </button>
      </form>
    </div>
  );
}
