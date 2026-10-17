import { Button, Icon, SplitButton } from './Common';
import type {
  BulkFooterProps,
  CompanyAvatarProps,
  CompanyCellProps,
  ConfidenceBadgeProps,
  ResultsHeaderProps,
  ResultsProps,
  ResultsRowProps,
  ResultsTableProps,
  TechBadgeProps,
} from './types';

/** A monospace tag for a single technology in a company's stack. */
export function TechBadge({ label }: TechBadgeProps) {
  return <span className="outreachTechBadge">{label}</span>;
}

/** Pill showing a match-confidence percentage, colored by tone. */
export function ConfidenceBadge({ value, tone }: ConfidenceBadgeProps) {
  const icon = tone === 'positive' ? 'check_circle' : 'help';
  return (
    <span className={`outreachConfidenceBadge outreachConfidence-${tone}`}>
      <Icon name={icon} size={14} />
      {value}%
    </span>
  );
}

/** Square monogram avatar for a company. */
export function CompanyAvatar({ initial }: CompanyAvatarProps) {
  return <div className="outreachCompanyAvatar">{initial}</div>;
}

/** Company avatar with its name and domain, for the first table column. */
export function CompanyCell({ company }: CompanyCellProps) {
  return (
    <div className="outreachCompanyCell">
      <CompanyAvatar initial={company.initial} />
      <span className="outreachCompanyText">
        <span className="outreachCompanyName">{company.name}</span>
        <span className="outreachCompanyDomain">{company.domain}</span>
      </span>
    </div>
  );
}

const headerCells = [
  ['Company', 'outreachColCompany'],
  ['Industry', 'outreachColStandard'],
  ['Location', 'outreachColStandard'],
  ['Size', 'outreachColSize'],
  ['Tech Stack', 'outreachColTech'],
] as const;

/** A single company result row with selection, meta, tech, and confidence. */
export function ResultsRow({ company, selected, onToggle }: ResultsRowProps) {
  return (
    <div
      className={`outreachRow ${selected ? 'outreachRowSelected' : ''}`}
      role="row"
    >
      <div role="cell" className="outreachTableCell outreachColSelect">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select ${company.name}`}
          onChange={() => onToggle(company.id)}
        />
      </div>
      <div role="cell" className="outreachTableCell outreachColCompany">
        <CompanyCell company={company} />
      </div>
      <div role="cell" className="outreachTableCell outreachColStandard">
        <span className="segmentStack">
          {company.industry}
          {company.description ? (
            <span className="outreachCompanyDomain" title={company.description}>
              {company.description}
            </span>
          ) : null}
        </span>
      </div>
      <div role="cell" className="outreachTableCell outreachColStandard">
        {company.location}
      </div>
      <div role="cell" className="outreachTableCell outreachColSize">
        {company.size}
      </div>
      <div role="cell" className="outreachTableCell outreachColTech">
        <span className="outreachTechWrap">
          {company.techStack.map((tech) => (
            <TechBadge key={tech} label={tech} />
          ))}
        </span>
      </div>
      <div role="cell" className="outreachTableCell outreachColConfidence">
        <ConfidenceBadge
          value={company.confidence}
          tone={company.confidenceTone}
        />
      </div>
    </div>
  );
}

/** Results card header: title, match count, and clear-selected action. */
export function ResultsHeader({
  selectedCount,
  onClearSelected,
}: Omit<ResultsHeaderProps, 'matches'>) {
  return (
    <div className="outreachResultsHeader">
      <h3 className="outreachResultsTitle">Discovery Results</h3>
      <div className="outreachResultsTools">
        <Button
          variant="secondary"
          size="sm"
          iconName="delete"
          disabled={selectedCount === 0}
          onClick={onClearSelected}
        >
          Clear Results
        </Button>
      </div>
    </div>
  );
}

/** Scrollable discovery results table with a select-all header. */
export function ResultsTable({
  companies,
  selectedIds,
  allSelected,
  isLoading = false,
  error,
  onToggleRow,
  onToggleAll,
}: ResultsTableProps) {
  return (
    <div className="outreachTableWrap">
      <div
        role="table"
        aria-label="Discovery results"
        className="outreachTable"
      >
        <div role="rowgroup" className="outreachTableHeadGroup">
          <div role="row" className="outreachTableHeaderRow">
            <div
              role="columnheader"
              className="outreachTableHeadCell outreachColSelect"
            >
              <input
                type="checkbox"
                checked={allSelected}
                aria-label="Select all companies"
                onChange={onToggleAll}
              />
            </div>
            {headerCells.map(([label, className]) => (
              <div
                key={label}
                role="columnheader"
                className={`outreachTableHeadCell ${className}`}
              >
                {label}
              </div>
            ))}
            <div
              role="columnheader"
              className="outreachTableHeadCell outreachColConfidence"
            >
              Confidence
            </div>
          </div>
        </div>
        <div role="rowgroup" className="outreachTableBody">
          {error !== undefined ? (
            <div className="outreachResultsState" role="status">
              {error}
            </div>
          ) : isLoading ? (
            <div className="outreachResultsState" role="status">
              Searching companies...
            </div>
          ) : companies.length === 0 ? (
            <div className="outreachResultsState" role="status">
              No companies found
            </div>
          ) : (
            companies.map((company) => (
              <ResultsRow
                key={company.id}
                company={company}
                selected={selectedIds.has(company.id)}
                onToggle={onToggleRow}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Sticky bulk-action bar showing selection count and export/import actions. */
export function BulkFooter({
  selectedCount,
  onExport,
  onImport,
}: BulkFooterProps) {
  return (
    <div className="outreachBulkFooter">
      <div className="outreachFooterGroup">
        <span className="outreachSelectionPill">
          {selectedCount} companies selected
        </span>
        <span className="outreachFooterHint">Ready for pipeline import</span>
      </div>
      <div className="outreachFooterGroup">
        <Button
          variant="secondary"
          size="sm"
          iconName="download"
          onClick={onExport}
        >
          Export CSV
        </Button>
        <SplitButton
          label="Import to Pipeline"
          iconName="add_task"
          onClick={onImport}
        />
      </div>
    </div>
  );
}

/** Discovery results card: header, scrollable table, and bulk footer. */
export function Results({
  companies,
  selectedIds,
  isLoading = false,
  error,
  onToggleRow,
  onToggleAll,
  onClearSelected,
  onExport,
  onImport,
}: ResultsProps) {
  const allSelected =
    companies.length > 0 && companies.every((c) => selectedIds.has(c.id));
  return (
    <section className="outreachResults">
      <ResultsHeader
        selectedCount={selectedIds.size}
        onClearSelected={onClearSelected}
      />
      <ResultsTable
        companies={companies}
        selectedIds={selectedIds}
        allSelected={allSelected}
        isLoading={isLoading}
        error={error}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
      <BulkFooter
        selectedCount={selectedIds.size}
        onExport={onExport}
        onImport={onImport}
      />
    </section>
  );
}
