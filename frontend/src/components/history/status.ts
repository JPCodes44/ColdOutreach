import type { QueueFilter, QueueRow, QueueStatus } from './types';

export const queueStatusLabels: Record<QueueStatus, string> = {
  queued: 'Queued',
  drafted: 'Legacy draft',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  uncertain: 'Needs review',
  canceled: 'Canceled',
  'legacy-blocked': 'Blocked (legacy)',
};

export const queueFilters: { value: QueueFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Queued / sending' },
  { value: 'review', label: 'Needs review' },
  { value: 'failed', label: 'Failed / blocked' },
  { value: 'sent', label: 'Sent' },
];

/** True when a human must decide whether Gmail accepted the message. */
export function needsReview(row: Pick<QueueRow, 'status' | 'stale'>): boolean {
  return row.status === 'uncertain' || (row.status === 'sending' && row.stale);
}

export function matchesFilter(row: QueueRow, filter: QueueFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return (
        row.status === 'queued' || (row.status === 'sending' && !row.stale)
      );
    case 'review':
      return needsReview(row);
    case 'failed':
      return row.status === 'failed' || row.status === 'legacy-blocked';
    case 'sent':
      return row.status === 'sent';
  }
}

export function formatTime(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString();
}
