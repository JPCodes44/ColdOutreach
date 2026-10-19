import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { Icon } from '../outreach/Common';
import { DeleteConfirmationModal } from '../modals';
import { useSetSelection } from '../shared/useSetSelection';
import { listPipelineCompaniesQuery } from './api';
import { CampaignHeader } from './CampaignHeader';
import { CampaignTable } from './CampaignTable';
import { matchesFilter } from './status';
import { usePipelineActions } from './usePipelineActions';
import { OutreachReviewModal } from '../outreach-review/OutreachReviewModal';
import type { CampaignCompany, PipelineFilter } from './types';

/** Outreach pipeline: run website reviews and open each company's draft. */
export function CampaignsScreen() {
  const rows = useQuery(listPipelineCompaniesQuery, {});
  const [query, setQuery] = useState('');
  const [reviewCompany, setReviewCompany] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [websiteReviewEnabled, setWebsiteReviewEnabled] = useState(false);
  const [filter, setFilter] = useState<PipelineFilter>('all');
  const { selectedIds, clearSelected, toggleSelected, toggleAll } =
    useSetSelection<string>();
  const runnableIds = new Set(
    (rows ?? [])
      .filter(
        (row) =>
          selectedIds.has(row.id) &&
          (row.draftState === 'none' ||
            row.draftState === 'failed' ||
            row.draftState === 'legacy'),
      )
      .map((row) => row.id),
  );
  const actions = usePipelineActions(
    selectedIds,
    runnableIds,
    clearSelected,
    websiteReviewEnabled,
  );

  const companies: CampaignCompany[] = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (rows ?? [])
      .filter(
        (row) =>
          matchesFilter(row.draftState, filter) &&
          (term === '' ||
            `${row.name} ${row.domain}`.toLowerCase().includes(term)),
      )
      .map((row) => ({ ...row, selected: selectedIds.has(row.id) }));
  }, [rows, query, filter, selectedIds]);

  return (
    <div className="campaignScreen">
      <CampaignHeader
        query={query}
        onQueryChange={setQuery}
        statusFilter={filter}
        onStatusFilterChange={setFilter}
        selectedCount={selectedIds.size}
        runnableCount={runnableIds.size}
        running={actions.running}
        websiteReviewEnabled={websiteReviewEnabled}
        onWebsiteReviewChange={setWebsiteReviewEnabled}
        onRun={() => void actions.run()}
        onDelete={() => actions.requestDelete('companies')}
        onDeleteDrafts={() => actions.requestDelete('drafts')}
      />
      {actions.notice !== null ? (
        <div className="campaignNotice" role="status">
          <span>{actions.notice}</span>
          <button
            type="button"
            className="campaignNoticeClose"
            aria-label="Dismiss notice"
            onClick={actions.dismissNotice}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
      <div className="campaignCanvas">
        <div className="campaignTableWrap">
          <CampaignTable
            companies={companies}
            loading={rows === undefined}
            onOpenReview={(id) => {
              const company = rows?.find((row) => row.id === id);
              if (company) setReviewCompany({ id, name: company.name });
            }}
            onToggleSelected={toggleSelected}
            onToggleAll={() =>
              toggleAll(
                companies.map((company) => company.id),
                companies.length > 0 &&
                  companies.every((company) => company.selected),
              )
            }
          />
        </div>
      </div>
      {reviewCompany !== null ? (
        <OutreachReviewModal
          companyId={reviewCompany.id}
          companyName={reviewCompany.name}
          onClose={() => setReviewCompany(null)}
        />
      ) : null}
      {actions.pendingDelete !== null ? (
        <DeleteConfirmationModal
          count={actions.pendingDelete.ids.length}
          target={actions.pendingDelete.kind}
          onCancel={actions.cancelDelete}
          onConfirm={() => void actions.confirmDelete()}
        />
      ) : null}
    </div>
  );
}
