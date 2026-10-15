export function formatUsd(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`;
}

/**
 * Remaining balance when a starting balance is known; otherwise the estimated
 * spend so far (never a made-up negative balance).
 */
export function formatCredit(
  balanceUsd: number | null,
  spentUsd: number | undefined,
): string {
  if (balanceUsd !== null) return formatUsd(balanceUsd);
  if (spentUsd !== undefined && spentUsd > 0) {
    return `${formatUsd(spentUsd)} spent`;
  }
  return '—';
}
