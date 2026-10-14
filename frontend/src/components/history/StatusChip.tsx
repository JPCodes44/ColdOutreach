import { needsReview, queueStatusLabels } from './status';
import type { StatusChipProps } from './types';

/** Colored queue status label; stuck sends read as "Needs review". */
export function StatusChip({ status, stale }: StatusChipProps) {
  const review = needsReview({ status, stale });
  return (
    <span
      className={`historyChip historyChip-${review ? 'uncertain' : status}`}
    >
      {review ? 'Needs review' : queueStatusLabels[status]}
    </span>
  );
}
