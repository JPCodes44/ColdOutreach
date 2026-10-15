import { makeFunctionReference } from 'convex/server';
import type {
  InboxCheckResult,
  QueueRow,
  ResolveOutcome,
  SentEmailDetail,
  SentEmailRow,
} from './types';

type Empty = Record<string, never>;
export const listQueueQuery = makeFunctionReference<'query', Empty, QueueRow[]>(
  'send:listQueue',
);
export const listSentQuery = makeFunctionReference<
  'query',
  Empty,
  SentEmailRow[]
>('send:listSentEmails');
export const getSentQuery = makeFunctionReference<
  'query',
  { id: string },
  SentEmailDetail | null
>('send:getSentEmail');
export const cancelMutation = makeFunctionReference<
  'mutation',
  { itemId: string },
  null
>('send:cancelQueueItem');
export const resolveMutation = makeFunctionReference<
  'mutation',
  { itemId: string; outcome: ResolveOutcome },
  null
>('send:resolveUncertainSend');
export const checkInboxAction = makeFunctionReference<
  'action',
  Empty,
  InboxCheckResult
>('delivery:checkNow');
