/** Draft lifecycle for a company, as reported by `outreachRuns:listPipelineCompanies`. */
export type DraftState =
  | 'none'
  | 'running'
  | 'ready'
  | 'approved'
  | 'failed'
  | 'legacy';

/** Pipeline stage while a run is in progress. */
export type RunStage =
  | 'queued'
  | 'retrieving'
  | 'analyzing'
  | 'composing'
  | 'rendering'
  | 'done';

/** One row from `outreachRuns:listPipelineCompanies`. */
export interface PipelineCompanyRow {
  id: string;
  name: string;
  domain: string;
  industry: string;
  description?: string | null;
  /** Industry-preset label, e.g. "Mixed manufacturer". */
  segment: string | null;
  confidence: number;
  draftState: DraftState;
  /** Mode of the displayed draft/run; null before any pipeline run. */
  websiteReviewEnabled: boolean | null;
  stage: RunStage | null;
  lastError: string | null;
  subject: string;
  recipientCount: number;
  sendStatus: string;
}

/** A pipeline row plus its UI selection state. */
export interface CampaignCompany extends PipelineCompanyRow {
  selected: boolean;
}

/** Status-filter chip values. */
export type PipelineFilter =
  | 'all'
  | 'needs-run'
  | 'ready'
  | 'approved'
  | 'failed';

export interface CampaignHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: PipelineFilter;
  onStatusFilterChange: (value: PipelineFilter) => void;
  selectedCount: number;
  running: boolean;
  websiteReviewEnabled: boolean;
  onWebsiteReviewChange: (enabled: boolean) => void;
  onRun: () => void;
  onDelete: () => void;
}

export interface CampaignScoreProps {
  score: number;
}

export interface DraftStatusCellProps {
  company: PipelineCompanyRow;
}

export interface CampaignRowProps {
  company: CampaignCompany;
  onOpenReview: (id: string) => void;
  onToggleSelected: (id: string) => void;
}

export interface CampaignTableProps {
  companies: CampaignCompany[];
  loading: boolean;
  onOpenReview: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
}

export interface CampaignsScreenProps {
  /** Open the Outreach Review screen for one company. */
  onOpenReview?: (companyId: string) => void;
}
