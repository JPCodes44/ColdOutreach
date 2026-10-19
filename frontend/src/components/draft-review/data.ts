import type { CompanyEmailRow, SelectOption } from './types';

/** Send-status filter options for the controls bar. */
export const statusOptions: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Not Sent', label: 'Not Sent' },
  { value: 'Sending', label: 'Sending' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Needs Review', label: 'Needs Review' },
];

export const DRAFT_REQUIRED_HINT = 'Generate a draft in Pipeline first';

/** Explain why a row cannot be selected for another send. */
export function sendBlockHint(row: CompanyEmailRow): string | undefined {
  if (row.draftState !== 'ready' && row.draftState !== 'approved')
    return DRAFT_REQUIRED_HINT;
  if (row.status === 'Sent') return 'Already sent';
  if (row.status === 'Sending') return 'Already queued or sending';
  if (row.status === 'Needs Review')
    return 'Resolve the delivery status in History first';
  return undefined;
}

/** Generated drafts can be sent once, without a separate approval step. */
export function isSendable(row: CompanyEmailRow): boolean {
  return sendBlockHint(row) === undefined;
}

/** Show an email address, or a dash when that slot is empty. */
export function emailCell(value: string): string {
  return value.trim().length > 0 ? value : '—';
}
