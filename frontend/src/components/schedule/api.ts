import { makeFunctionReference } from 'convex/server';
import type { DeliveryMethod, ScheduleSummary } from './types';

export const getScheduleSummaryQuery = makeFunctionReference<
  'query',
  { companyIds: string[] },
  ScheduleSummary
>('send:getScheduleSummary');

export const enqueueSendMutation = makeFunctionReference<
  'mutation',
  { companyIds: string[]; scheduledAtMs: number; method: DeliveryMethod },
  { batchId: string; queued: number }
>('send:enqueueSend');

export const cancelScheduledSendsMutation = makeFunctionReference<
  'mutation',
  { companyIds: string[] },
  { canceled: number }
>('send:cancelScheduledSends');

export const purgeSettledCompaniesMutation = makeFunctionReference<
  'mutation',
  { companyIds: string[] },
  { removed: number }
>('send:purgeSettledCompanies');
