import { useAuthActions } from '@convex-dev/auth/react';

/** Ends the current session. */
export function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button
      className="authSignOut"
      type="button"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
