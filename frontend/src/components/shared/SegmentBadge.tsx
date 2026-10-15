import type { SegmentBadgeProps } from './types';

function tone(segment: string): string {
  if (/exclusively vegan/i.test(segment)) return 'vegan';
  if (/mixed/i.test(segment)) return 'mixed';
  return 'unclear';
}

/** Industry-preset label, e.g. "Exclusively vegan" vs "Mixed manufacturer". */
export function SegmentBadge({ segment }: SegmentBadgeProps) {
  if (segment === undefined || segment === null || segment.length === 0) {
    return null;
  }
  return (
    <span className={`segmentBadge segmentBadge-${tone(segment)}`}>
      {segment}
    </span>
  );
}
