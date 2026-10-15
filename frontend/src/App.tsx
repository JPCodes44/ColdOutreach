import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import './components/shell/styles.css';
import './components/campaigns/styles.css';
import './components/email-table/styles.css';
import './components/outreach/styles.css';
import './components/outreach-review/styles.css';
import './components/draft-review/styles.css';
import './components/schedule/styles.css';
import './components/history/styles.css';
import './components/settings/styles.css';
import './components/modals/styles.css';
import './components/account/styles.css';
import './components/auth/styles.css';
import './components/shared/styles.css';
import { AuthGate } from './components/auth/AuthGate';
import { Workspace } from './components/shell/Workspace';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is not set. Add it to frontend/.env.local.');
}
const convex = new ConvexReactClient(convexUrl);

/** App root: Convex + auth providers, then the operator-only workspace. */
export function App() {
  return (
    <ConvexAuthProvider client={convex}>
      <AuthGate>
        <Workspace />
      </AuthGate>
    </ConvexAuthProvider>
  );
}
