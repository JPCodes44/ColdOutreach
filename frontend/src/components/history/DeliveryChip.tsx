import type { DeliveryChipProps } from './types';

/** Delivery signal for a sent email: bounced, replied, or Gmail-accepted. */
export function DeliveryChip({ row }: DeliveryChipProps) {
  if (row.bouncedAt !== null) {
    return (
      <span
        className="historyChip historyChip-failed"
        title={row.bounceDetail ?? undefined}
      >
        Bounced
      </span>
    );
  }
  if (row.repliedAt !== null) {
    return <span className="historyChip historyChip-replied">Replied</span>;
  }
  return <span className="historyChip historyChip-sent">Accepted</span>;
}
