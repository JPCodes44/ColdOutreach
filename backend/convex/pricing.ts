// Pricing constants + cost estimation for the per-provider balance tracker.
// Plain module (no node-only APIs) so it can be imported by both the Node
// actions (artifacts.ts) and the regular query/mutation runtime (usageDb.ts).
import { timeZoneOffsetMs } from '@emailstrat/common';

/** USD per 1M tokens, per model. DeepSeek is omitted — it reports a real balance. */
export const MODEL_PRICING: Record<
  string,
  { inputPerM: number; outputPerM: number }
> = {
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
};

/**
 * Estimate the USD cost of a single call from its token counts. Returns 0 for
 * an unknown model (so a pricing gap degrades to "free" rather than throwing).
 */
export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const price = MODEL_PRICING[model];
  if (price === undefined) return 0;
  return (
    (promptTokens / 1_000_000) * price.inputPerM +
    (completionTokens / 1_000_000) * price.outputPerM
  );
}

/**
 * Flat per-grounded-call estimate for Gemini's Google Search fee ($35/1k ≈
 * $0.035/query, and a research call fires a few). APPROXIMATE: it ignores the
 * paid tier's free daily grounding allotment, so it over-counts — `setBalance`
 * lets the user re-anchor to reality.
 */
export const GEMINI_GROUNDING_EST_USD = 0.05;

/** Gemini free-tier daily request cap for gemini-2.5-flash. */
export const GEMINI_FREE_DAILY_LIMIT = 20;

/**
 * ISO timestamp of the next midnight in America/Los_Angeles — the boundary at
 * which Gemini's free-tier daily quota resets. (May be off by an hour for the
 * two DST-transition days a year, which is harmless for a request counter.)
 */
export function nextPacificMidnightIso(now: Date = new Date()): string {
  const tz = 'America/Los_Angeles';
  const offset = timeZoneOffsetMs(now, tz);
  // Today's Pacific wall-clock date.
  const pacificNow = new Date(now.getTime() + offset);
  // Tomorrow 00:00 expressed as a wall-clock value, then back to a UTC instant.
  const tomorrowMidnightWall = Date.UTC(
    pacificNow.getUTCFullYear(),
    pacificNow.getUTCMonth(),
    pacificNow.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return new Date(tomorrowMidnightWall - offset).toISOString();
}
