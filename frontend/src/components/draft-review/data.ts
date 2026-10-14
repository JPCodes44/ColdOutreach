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

export const NOT_APPROVED_HINT = 'Approve the draft in Review first';

/** Only companies with an approved draft can be sent. */
export function isSendable(row: CompanyEmailRow): boolean {
  return row.draftState === 'approved';
}

/** Show an email address, or a dash when that slot is empty. */
export function emailCell(value: string): string {
  return value.trim().length > 0 ? value : '—';
}
