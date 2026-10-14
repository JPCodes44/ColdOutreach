import { ApiBalances } from '../account/ApiBalances';

/** Fixed app header hosting the provider credit balances. */
export function TopBar() {
  return (
    <header className="shellTopBar">
      <div className="shellTopSpacer">
        <ApiBalances />
      </div>
    </header>
  );
}
