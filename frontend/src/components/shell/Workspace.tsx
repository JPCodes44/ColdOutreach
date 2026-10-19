import { useState } from 'react';
import { CampaignsScreen } from '../campaigns/Campaigns';
import { DraftReviewScreen } from '../draft-review/DraftReview';
import { EmailTableScreen } from '../email-table/EmailTable';
import { HistoryScreen } from '../history/HistoryScreen';
import { ScheduleSubmissionScreen } from '../schedule/ScheduleSubmission';
import { SettingsScreen } from '../settings/SettingsScreen';
import { TopBar } from './TopBar';
import { navItems } from './navItems';
import { Sidebar } from '../outreach/Sidebar';
import { Screen } from '../outreach/Screen';
import { OutreachProvider } from '../outreach/OutreachContext';

const brand = { title: 'ColdOutreach', subtitle: 'Business Outreach' };
const flushPages = new Set(['campaigns', 'email-table']);

/** The signed-in workspace — swaps between the outreach workflow screens. */
export function Workspace() {
  const [activePage, setActivePage] = useState('companies');
  // Companies checked on the Send page, carried to Schedule.
  const [sendCompanyIds, setSendCompanyIds] = useState<string[]>([]);

  const pages: Record<string, JSX.Element> = {
    companies: <Screen onViewCompanies={() => setActivePage('campaigns')} />,
    campaigns: <CampaignsScreen />,
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
  );
}
