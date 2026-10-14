export type QueueStatus =
  | 'queued'
  | 'drafted'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'uncertain'
  | 'canceled'
  | 'legacy-blocked';

export type ResolveOutcome = 'sent' | 'not-sent';

/** A row from `send:listQueue`. */
export interface QueueRow {
  id: string;
  companyId: string;
  company: string;
  to: string;
  actualTo: string | null;
  subject: string;
  status: QueueStatus;
  stale: boolean;
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  isTest: boolean;
}

/** A row from `send:listSentEmails`. */
export interface SentEmailRow {
  id: string;
  companyName: string;
  companyDomain: string;
  intendedTo: string;
  actualTo: string;
  redirected: boolean;
  subject: string;
  sentAt: string;
  acceptance: 'smtp-accepted' | 'manually-confirmed';
  providerMessageId: string | null;
  isTest: boolean;
}

/** Full stored content from `send:getSentEmail`. */
export interface SentEmailDetail {
  _id: string;
  companyName: string;
  intendedTo: string;
  actualTo: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
}

export type QueueFilter = 'all' | 'active' | 'review' | 'failed' | 'sent';

export interface QueueActionsProps {
  row: QueueRow;
  onCancel: (id: string) => Promise<void>;
  onResolve: (id: string, outcome: ResolveOutcome) => Promise<void>;
}

export interface QueueTableProps {
  rows: QueueRow[] | undefined;
  onCancel: (id: string) => Promise<void>;
  onResolve: (id: string, outcome: ResolveOutcome) => Promise<void>;
}

export type QueueRowItemProps = QueueActionsProps;

export interface SentTableProps {
  rows: SentEmailRow[] | undefined;
  onOpen: (id: string) => void;
}

export interface SentEmailViewerProps {
  email: SentEmailDetail | null | undefined;
  onClose: () => void;
}

export interface StatusChipProps {
  status: QueueStatus;
  stale: boolean;
}
