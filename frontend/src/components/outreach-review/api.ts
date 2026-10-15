import { makeFunctionReference } from 'convex/server';
import type { ReviewData } from './types';

export const getReviewQuery = makeFunctionReference<
  'query',
  { companyId: string },
  ReviewData | null
>('outreachRuns:getReview');

export const saveDraftEditsMutation = makeFunctionReference<
  'mutation',
  {
    companyId: string;
    subject: string;
    opening: string;
    closing: string;
    signature: string;
  },
  null
>('outreachRuns:saveDraftEdits');

/** Approve for scheduling. Approving never sends email. */
export const approveDraftMutation = makeFunctionReference<
  'mutation',
  { companyId: string; acknowledgedClaims?: string[] },
  null
>('outreachRuns:approveDraft');

export const unapproveDraftMutation = makeFunctionReference<
  'mutation',
  { companyId: string },
  null
>('outreachRuns:unapproveDraft');
