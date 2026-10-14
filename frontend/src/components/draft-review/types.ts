/** Draft readiness from the backend (`outreachRuns` draft state). */
export type DraftState =
  | 'none'
  | 'running'
  | 'ready'
  | 'approved'
  | 'failed'
  | 'legacy';

/** A company with recipients, from `emails:listCompaniesWithEmails`. */
export interface CompanyEmailRow {
  companyId: string;
  company: string;
  email1: string;
  email2: string;
  email3: string;
  /** Send status roll-up (Not Sent, Sending, Sent, Failed, Needs Review). */
  status: string;
  draftState: DraftState;
  draftLabel: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface DraftReviewHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export interface DraftReviewTableProps {
  loading: boolean;
  rows: CompanyEmailRow[];
  selectedIds: ReadonlySet<string>;
  allSelected: boolean;
  /** Currently highlighted (clicked) row. */
  activeId?: string;
  onSelect: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
}

export interface DraftReviewRowProps {
  row: CompanyEmailRow;
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  onToggleSelected: (id: string) => void;
}

export interface DraftReviewScreenProps {
  /** Advances to Schedule with the checked (approved) company ids. */
  onContinue?: (companyIds: string[]) => void;
  /** Returns to the Recipients screen. */
  onBack?: () => void;
}
