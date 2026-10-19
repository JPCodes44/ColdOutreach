import type { StatusTone } from '../outreach/types';
import type { DraftState, PipelineCompanyRow, PipelineFilter } from './types';

/** Label + color tone for each draft state, reused by any status UI. */
export const draftStateThemes: Record<
  DraftState,
  { label: string; tone: StatusTone }
> = {
  none: { label: 'Not generated', tone: 'neutral' },
  running: { label: 'Generating', tone: 'neutral' },
  ready: { label: 'Draft ready', tone: 'success' },
  approved: { label: 'Draft ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  legacy: { label: 'Legacy draft – regenerate', tone: 'danger' },
};

/** Pill text for a row, including the live stage while a run is in flight. */
export function draftStatusLabel(row: PipelineCompanyRow): string {
  const base = draftStateThemes[row.draftState].label;
  return row.draftState === 'running' && row.stage !== null
    ? `${base} · ${row.stage}`
    : base;
}

export const pipelineFilterOptions: { value: PipelineFilter; label: string }[] =
  [
    { value: 'all', label: 'All' },
    { value: 'needs-run', label: 'Needs run' },
    { value: 'ready', label: 'Draft ready' },
    { value: 'failed', label: 'Failed' },
  ];

/** Whether a row belongs under the given filter chip. */
export function matchesFilter(state: DraftState, filter: PipelineFilter) {
  switch (filter) {
    case 'all':
      return true;
    case 'ready':
      return state === 'ready' || state === 'approved';
    case 'needs-run':
      return state === 'none' || state === 'legacy';
    default:
      return state === filter;
  }
}
