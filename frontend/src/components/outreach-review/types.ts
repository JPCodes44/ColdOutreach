import type { OutreachEmailContent } from '@emailstrat/common';
import type { DraftState, RunStage } from '../campaigns/types';

export interface EvidenceSource {
  url: string;
  title: string;
  fetchedAt: string;
  /** Rendered in a headless browser because the static HTML was empty. */
  rendered?: boolean;
}

export interface EvidenceFact {
  id: string;
  kind: string;
  sourceUrl: string;
  text: string;
}

export interface ReviewEvidence {
  researchContext?: string;
  sources: EvidenceSource[];
  facts: EvidenceFact[];
  skipped: { url: string; reason: string }[];
  /** Page text the run was checked against; absent on older runs. */
  excerpts?: { url: string; text: string }[];
}

export interface ReviewOpportunity {
  title: string;
  observation: string;
  evidenceIds: string[];
  hypothesis: string;
  suggestedImprovement: string;
}

export interface ReviewAnalysis {
  businessSummary: string;
  observations: { text: string; evidenceIds: string[] }[];
  opportunities: ReviewOpportunity[];
  proposedWorkflow: { name: string; description: string }[];
  dashboard: OutreachEmailContent['dashboard'];
  droppedCount: number;
}

export interface ReviewRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  stage: RunStage;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  settingsVersion: number;
  websiteReviewEnabled?: boolean;
}

export interface ReviewDraft {
  id: string;
  status: 'ready' | 'approved';
  content: OutreachEmailContent;
  approvedAt: string | null;
  /** Flagged claims the reviewer confirmed when approving. */
  acknowledgedClaims: string[];
  editedAt: string | null;
  updatedAt: string;
  settingsVersion: number;
  websiteReviewEnabled?: boolean;
}

/** Shape returned by `outreachRuns:getReview`. */
export interface ReviewData {
  company: {
    id: string;
    name: string;
    domain: string;
    industry: string;
    recipients: string[];
  };
  draftState: DraftState;
  latestRun: ReviewRun | null;
  draft: ReviewDraft | null;
  evidence: ReviewEvidence | null;
  analysis: ReviewAnalysis | null;
  generatedAt: number | null;
}

/** The reviewer-editable part of a draft. */
export interface EditableFields {
  subject: string;
  opening: string;
  closing: string;
  signature: string;
}

export interface OutreachReviewScreenProps {
  /** Company to review; undefined shows a pick-a-company empty state. */
  companyId?: string;
  onBack?: () => void;
}

export interface ReviewEmptyStateProps {
  onBack?: () => void;
}

export interface ReviewHeaderProps {
  company: ReviewData['company'];
  draftState: DraftState;
  hasDraft: boolean;
  starting: boolean;
  onRun: () => void;
  onBack?: () => void;
}

export interface RunProgressProps {
  stage: RunStage;
  websiteReviewEnabled?: boolean;
}

export interface RunErrorProps {
  error: string;
  hasDraft: boolean;
}

export interface EvidencePanelProps {
  evidence: ReviewEvidence;
  analysis: ReviewAnalysis;
}

export interface OpportunityListProps {
  opportunities: ReviewOpportunity[];
}

export interface WorkflowDashboardProps {
  workflow: { name: string; description: string }[];
  dashboard: OutreachEmailContent['dashboard'];
}

export interface DraftWorkspaceProps {
  companyId: string;
  draft: ReviewDraft;
  /** Retrieved website text used to flag unsupported claims in edits. */
  evidenceText: string;
}

export interface DraftEditorProps {
  fields: EditableFields;
  onChange: (fields: EditableFields) => void;
  approved: boolean;
  dirty: boolean;
  busy: boolean;
  error: string | null;
  /** Flagged claims, hard blockers, and the reviewer's acknowledgements. */
  review: ClaimReviewProps;
  onSave: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
}

export interface EmailPreviewProps {
  content: OutreachEmailContent;
}

export interface ClaimReviewProps {
  /** Unsupported claims; each must be acknowledged before approval. */
  claims: string[];
  /** Problems that must be fixed before approval (e.g. missing signature). */
  blockers: string[];
  acknowledged: string[];
  onAcknowledge: (claim: string, checked: boolean) => void;
}

export interface DraftActionsProps {
  approved: boolean;
  dirty: boolean;
  busy: boolean;
  /** No blockers and every flagged claim acknowledged. */
  ready: boolean;
  onSave: () => void;
  onApprove: () => void;
  onUnapprove: () => void;
}
