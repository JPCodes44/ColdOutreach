import { makeFunctionReference } from 'convex/server';
import type { PipelineCompanyRow } from './types';

export const listPipelineCompaniesQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  PipelineCompanyRow[]
>('outreachRuns:listPipelineCompanies');

/** Start background pipeline runs. Generation never sends email. */
export const requestRunsMutation = makeFunctionReference<
  'mutation',
  { companyIds: string[]; websiteReviewEnabled?: boolean },
  { started: string[]; skipped: { companyId: string; reason: string }[] }
>('outreachRuns:requestRuns');

export const deleteCompaniesMutation = makeFunctionReference<
  'mutation',
  { externalIds: string[] },
  null
>('companies:deleteCompanies');

/** Backend refuses runs for more than this many companies per request. */
export const MAX_RUNS_PER_REQUEST = 10;
