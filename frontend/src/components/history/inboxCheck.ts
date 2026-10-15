import type { InboxCheckResult } from './types';

function count(n: number, one: string, many: string): string {
  return `${n} new ${n === 1 ? one : many}`;
}

export function describeCheck(result: InboxCheckResult): string {
  return `Checked: ${count(result.bounced, 'bounce', 'bounces')}, ${count(result.replied, 'reply', 'replies')}`;
}
