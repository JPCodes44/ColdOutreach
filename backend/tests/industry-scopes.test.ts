import { describe, expect, it } from 'vitest';
import { buildResearchContents, classifyCandidates } from '../convex/companies';
import {
  PLANT_BASED_MANUFACTURING,
  industryScope,
} from '../convex/outreach/industryScopes';

const base = { name: 'Co', location: 'Toronto', size: '11-50', confidence: 90 };

describe('company research content', () => {
  it('requests a grounded business description rather than vegan classification', () => {
    const request = JSON.parse(
      buildResearchContents({
        industry: PLANT_BASED_MANUFACTURING,
        companySize: 'any',
        location: 'Canada',
        techStack: [],
        limit: 10,
        excludedCompanyDomains: [],
        outreachTarget: { niche: 'n', offer: 'o' },
      }),
    );
    expect(request.researchCriteria.scope).toContain(
      'sauces, dips, dry mixes, grains, pulses, nuts, seeds',
    );
    expect(request.outputRequirements.includeFields).toContain('description');
    expect(request.outputRequirements.includeFields).toContain(
      'manufacturingRole',
    );
    expect(request.outputRequirements.includeFields).not.toContain(
      'plantBasedFocus',
    );
    expect(request.instruction).toContain(
      'what the company actually makes or does',
    );
    expect(request.instruction).toContain('specific products');
    expect(request.researchCriteria.scope).not.toContain('exclusively vegan');
  });

  it.each(['small', 'medium', 'large', 'megacorp'])(
    'passes %s as an industry-relative scale rather than an employee range',
    (companySize) => {
      const request = JSON.parse(
        buildResearchContents({
          industry: 'software',
          companySize,
          location: 'Canada',
          techStack: [],
          limit: 10,
          excludedCompanyDomains: [],
          outreachTarget: { niche: 'n', offer: 'o' },
        }),
      );
      expect(request.researchCriteria.companySize).toBe(companySize);
      expect(request.instruction).toContain(
        'relative to the selected industry',
      );
      expect(request.instruction).toContain('not an employee-count filter');
      expect(request.responseShape.companies[0].size).toContain('Unknown');
    },
  );

  it('does not forward an old numeric size filter as a headcount requirement', () => {
    const request = JSON.parse(
      buildResearchContents({
        industry: 'software',
        companySize: '501-10000',
        location: 'Canada',
        techStack: [],
        limit: 10,
        excludedCompanyDomains: [],
        outreachTarget: { niche: 'n', offer: 'o' },
      }),
    );
    expect(request.researchCriteria.companySize).toBe('any');
    expect(JSON.stringify(request)).not.toContain('501-10000');
  });

  it('keeps qualitative result sizes and leaves unsupported numeric sizes unknown', () => {
    const results = classifyCandidates('software', [
      { ...base, domain: 'small.test', size: 'small' },
      { ...base, domain: 'uncertain.test', size: '150-200 employees' },
    ]);
    expect(results.map((result) => result.size)).toEqual(['Small', 'Unknown']);
  });

  it('keeps manufacturing scope and factual descriptions without creating labels', () => {
    const results = classifyCandidates(PLANT_BASED_MANUFACTURING, [
      {
        ...base,
        domain: 'oats.test',
        manufacturingRole: 'processor',
        plantBasedFocus: 'exclusively-vegan',
        description:
          'Processes oats and pulses into ingredients for food manufacturers.',
      },
      {
        ...base,
        domain: 'retail.test',
        manufacturingRole: 'retailer',
        description: 'Sells prepared foods.',
      },
      {
        ...base,
        domain: 'mixed.test',
        manufacturingRole: 'contract manufacturer',
        plantBasedFocus: 'mixed',
        description: 'Manufactures sauces for private-label customers.',
      },
    ]);
    expect(results.map((r) => r.domain)).toEqual(['oats.test', 'mixed.test']);
    expect(results[0]!.description).toContain('Processes oats and pulses');
    expect(results.every((r) => r.segment === undefined)).toBe(true);
  });

  it('preserves descriptions for other sectors and does not invent missing ones', () => {
    expect(industryScope('software')).toBeUndefined();
    const results = classifyCandidates('software', [
      {
        ...base,
        domain: 'software.test',
        description: 'Builds inventory planning software.',
      },
      { ...base, domain: 'unknown.test' },
    ]);
    expect(results[0]!.description).toBe('Builds inventory planning software.');
    expect(results[1]!.description).toBeUndefined();
  });
});
