/** Shape returned by the `usageDb:getBalances` Convex query. */
export interface ApiBalancesData {
  /** Remaining dollars (null until a starting balance is set) and spend so far. */
  openai: { balanceUsd: number | null; spentUsd: number };
  deepseek: { balanceUsd: number | null };
  gemini: {
    /** Estimated remaining dollars on the paid (billing-enabled) Gemini key. */
    paidBalanceUsd: number | null;
    /** Estimated dollars spent on the paid Gemini key. */
    paidSpentUsd: number;
    /** Requests left on the free key for the current day. */
    freeRequestsRemaining: number;
    /** The free-tier daily request cap. */
    freeLimit: number;
  };
}
