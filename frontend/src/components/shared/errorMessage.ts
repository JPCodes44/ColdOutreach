/**
 * Pull a human-readable message out of a thrown Convex error. Convex wraps
 * server errors as "[CONVEX M(...)] [Request ID: ...] Server Error
 * Uncaught Error: <message>\n    at ...", so prefer the uncaught message.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const uncaught = error.message.match(/Uncaught Error: ([^\n]+)/);
  return uncaught?.[1]?.trim() || error.message || fallback;
}
