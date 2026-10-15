import { ApiBalances } from '../account/ApiBalances';
import { SignOutButton } from '../auth/SignOutButton';

/** Fixed app header hosting the provider credit balances and sign-out. */
export function TopBar() {
  return (
    <header className="shellTopBar">
      <div className="shellTopSpacer">
        <ApiBalances />
      </div>
      <SignOutButton />
    </header>
  );
}
