import { useState } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
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
import { CampaignsScreen } from './components/campaigns/Campaigns';
import { DraftReviewScreen } from './components/draft-review/DraftReview';
import { EmailTableScreen } from './components/email-table/EmailTable';
import { HistoryScreen } from './components/history/HistoryScreen';
import { OutreachReviewScreen } from './components/outreach-review/OutreachReviewScreen';
import { ScheduleSubmissionScreen } from './components/schedule/ScheduleSubmission';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { TopBar } from './components/shell/TopBar';
import { navItems } from './components/shell/navItems';
import { Sidebar } from './components/outreach/Sidebar';
import { Screen } from './components/outreach/Screen';
import { OutreachProvider } from './components/outreach/OutreachContext';

const brand = { title: 'ColdOutreach', subtitle: 'Business Outreach' };
const flushPages = new Set(['campaigns', 'email-table']);

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is not set. Add it to frontend/.env.local.');
}
const convex = new ConvexReactClient(convexUrl);

/** App root — swaps between the outreach workflow screens. */
export function App() {
  const [activePage, setActivePage] = useState('companies');
  // Company opened from the Pipeline, shown on the Review page.
  const [reviewCompanyId, setReviewCompanyId] = useState<string | undefined>();
  // Companies checked on the Send page, carried to Schedule.
  const [sendCompanyIds, setSendCompanyIds] = useState<string[]>([]);

  const pages: Record<string, JSX.Element> = {
    companies: <Screen onViewCompanies={() => setActivePage('campaigns')} />,
    campaigns: (
      <CampaignsScreen
        onOpenReview={(id) => {
          setReviewCompanyId(id);
          setActivePage('review');
        }}
      />
    ),
    review: (
      <OutreachReviewScreen
        companyId={reviewCompanyId}
        onBack={() => setActivePage('campaigns')}
      />
    ),
    'email-table': <EmailTableScreen />,
    drafts: (
      <DraftReviewScreen
        onContinue={(ids) => {
          setSendCompanyIds(ids);
          setActivePage('schedule');
        }}
        onBack={() => setActivePage('email-table')}
      />
    ),
    schedule: (
      <ScheduleSubmissionScreen
        companyIds={sendCompanyIds}
        onBack={() => setActivePage('drafts')}
      />
    ),
    history: <HistoryScreen />,
    settings: <SettingsScreen />,
  };

  return (
    <ConvexProvider client={convex}>
      <OutreachProvider>
        <div className="appShell">
          <Sidebar
            brand={brand}
            items={navItems}
            activeId={activePage}
            onSelect={setActivePage}
          />
          <main className="appMain">
            <TopBar />
            <div
              className={`appPage ${flushPages.has(activePage) ? 'appPageFlush' : ''}`}
            >
              {pages[activePage] ?? pages.companies}
            </div>
          </main>
        </div>
      </OutreachProvider>
    </ConvexProvider>
  );
}
