import { makeFunctionReference } from 'convex/server';
import type { Company, ConfidenceTone } from './types';

export interface CompanyResearchCriteria {
  [key: string]: unknown;
  keywords?: string;
  industry: string;
  companySize: string;
  location: string;
  techStack: string[];
  limit: number;
}

interface CompanyResearchResult {
  id: string;
  name: string;
  domain: string;
  industry: string;
  location: string;
  size: string;
  techStack: string[];
  confidence: number;
  segment?: string;
}

interface CompanyResearchResponse {
  companies: CompanyResearchResult[];
  total: number;
}

/** Called through the app's authenticated Convex client (`useAction`). */
export const researchCompaniesAction = makeFunctionReference<
  'action',
  CompanyResearchCriteria,
  CompanyResearchResponse
>('companies:research');

const defaultCompanyLimit = 50;
const maxCompanyLimit = 100;

function parseTechStackInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseCompanyLimit(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return defaultCompanyLimit;
  }
  return Math.min(Math.max(parsed, 1), maxCompanyLimit);
}

function toCompany(result: CompanyResearchResult): Company {
  const confidenceTone: ConfidenceTone =
    result.confidence >= 80 ? 'positive' : 'neutral';
  return {
    id: result.id,
    name: result.name,
    domain: result.domain,
    initial: result.name.trim().charAt(0).toUpperCase() || '?',
    industry: result.industry,
    location: result.location,
    size: result.size,
    techStack: result.techStack,
    confidence: result.confidence,
    confidenceTone,
    ...(result.segment !== undefined ? { segment: result.segment } : {}),
  };
}

export function buildCompanyResearchCriteria(args: {
  keywords: string;
  industry: string;
  companySize: string;
  location: string;
  techStack: string;
  companyLimit: string;
}): CompanyResearchCriteria {
  return {
    keywords: args.keywords.trim() || undefined,
    industry: args.industry,
    companySize: args.companySize,
    location: args.location,
    techStack: parseTechStackInput(args.techStack),
    limit: parseCompanyLimit(args.companyLimit),
  };
}

export type RunResearch = (
  criteria: CompanyResearchCriteria,
) => Promise<CompanyResearchResponse>;

export async function researchCompanies(
  run: RunResearch,
  criteria: CompanyResearchCriteria,
): Promise<{ companies: Company[]; total: number }> {
  const result = await run(criteria);
  return {
    companies: result.companies.map(toCompany),
    total: result.total,
  };
}
