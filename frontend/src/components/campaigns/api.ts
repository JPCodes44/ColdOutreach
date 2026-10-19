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
  {
    companyIds: string[];
    websiteReviewEnabled?: boolean;
    regenerate?: boolean;
  },
  { started: string[]; skipped: { companyId: string; reason: string }[] }
>('outreachRuns:requestRuns');

export const deleteDraftsMutation = makeFunctionReference<
  'mutation',
  { companyIds: string[] },
  { deleted: number }
>('outreachRuns:deleteDrafts');

export const deleteCompaniesMutation = makeFunctionReference<
  'mutation',
  { externalIds: string[] },
  null
>('companies:deleteCompanies');
