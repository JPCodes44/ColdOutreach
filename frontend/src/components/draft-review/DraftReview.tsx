import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Icon } from '../outreach/Common';
import { EmailDraftCarouselModal } from '../modals/EmailDraftCarouselModal';
import { useSetSelection } from '../shared/useSetSelection';
import type { EmailDraft } from '../modals/types';
import { isSendable } from './data';
import { DraftReviewHeader } from './DraftReviewHeader';
import { DraftReviewTable } from './DraftReviewTable';
import type { CompanyEmailRow, DraftReviewScreenProps } from './types';

const listCompaniesWithEmailsQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  CompanyEmailRow[]
>('emails:listCompaniesWithEmails');

const getCompanyEmailDraftsQuery = makeFunctionReference<
  'query',
  { companyId: string },
  EmailDraft[]
>('emails:getCompanyEmailDrafts');

function matches(row: CompanyEmailRow, term: string, status: string): boolean {
  if (status !== 'all' && row.status !== status) return false;
  return (
    term.length === 0 ||
    [row.company, row.email1, row.email2, row.email3].some((v) =>
      v.toLowerCase().includes(term),
    )
  );
}

/** Choose companies with approved drafts to schedule for sending. */
export function DraftReviewScreen({
  onContinue,
  onBack,
}: DraftReviewScreenProps) {
  const rows = useQuery(listCompaniesWithEmailsQuery, {});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const { selectedIds, toggleSelected, toggleAll } = useSetSelection<string>();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const draftCards = useQuery(
    getCompanyEmailDraftsQuery,
    activeId !== undefined ? { companyId: activeId } : 'skip',
  );

  const visibleRows = useMemo(
    () =>
      (rows ?? []).filter((row) =>
        matches(row, query.trim().toLowerCase(), status),
      ),
    [rows, query, status],
  );
  const sendableIds = visibleRows
    .filter(isSendable)
    .map((row) => row.companyId);
  const allSelected =
    sendableIds.length > 0 && sendableIds.every((id) => selectedIds.has(id));
  // Only approved companies that are still listed can be sent.
  const chosen = (rows ?? [])
    .filter((r) => isSendable(r) && selectedIds.has(r.companyId))
    .map((r) => r.companyId);

  return (
    <section className="draftScreen">
      <div className="draftHeader">
        <h1 className="draftTitle">Choose Companies to Send</h1>
        <p className="draftSubtitle">
          Select companies whose reviewed draft is approved. Click a row to
          preview each recipient&apos;s email.
        </p>
      </div>
      <DraftReviewHeader
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
      />
      <DraftReviewTable
        loading={rows === undefined}
        rows={visibleRows}
        selectedIds={selectedIds}
        allSelected={allSelected}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setCarouselIndex(0);
        }}
        onToggleSelected={toggleSelected}
        onToggleAll={() => toggleAll(sendableIds, allSelected)}
      />
      <div className="draftFooter">
        <button className="draftSecondaryButton" type="button" onClick={onBack}>
          Back
        </button>
        <button
          className="draftPrimaryButton"
          type="button"
          onClick={() => onContinue?.(chosen)}
          disabled={chosen.length === 0}
        >
          Continue to Schedule
          <Icon name="arrow_forward" size={18} />
        </button>
      </div>
      {activeId !== undefined ? (
        <EmailDraftCarouselModal
          drafts={draftCards ?? []}
          activeIndex={carouselIndex}
          onPrev={() => setCarouselIndex((index) => Math.max(0, index - 1))}
          onNext={() =>
            setCarouselIndex((index) =>
              Math.min((draftCards?.length ?? 1) - 1, index + 1),
            )
          }
          onClose={() => setActiveId(undefined)}
        />
      ) : null}
    </section>
  );
}
