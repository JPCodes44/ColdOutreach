import { describe, expect, it } from 'vitest';
import { buildResearchContents, classifyCandidates } from '../convex/companies';
import {
  PLANT_BASED_MANUFACTURING,
  industryScope,
} from '../convex/outreach/industryScopes';

const base = { name: 'Co', location: 'Toronto', size: '11-50', confidence: 90 };

describe('plant-based manufacturing preset', () => {
  it('sends the full scope and asks for role and vegan-focus fields', () => {
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
    expect(request.researchCriteria.industry).toBe(
      'Plant-Based Food & Ingredient Manufacturers',
    );
    expect(request.researchCriteria.scope).toMatch(
      /sauces, dips, dry mixes, grains, pulses, nuts, seeds/,
    );
    expect(request.researchCriteria.scope).toMatch(
      /Exclude businesses that only retail, distribute or market/,
    );
    expect(request.outputRequirements.includeFields).toEqual(
      expect.arrayContaining(['manufacturingRole', 'plantBasedFocus']),
    );
    expect(request.outputRequirements.includeFields).toHaveLength(9);
    expect(request.responseShape.companies[0].industry).toMatch(
      /main product category/,
    );
  });

  it('drops non-manufacturers and labels mixed vs exclusively vegan', () => {
    const results = classifyCandidates(PLANT_BASED_MANUFACTURING, [
      {
        ...base,
        name: 'Mixed Foods',
        domain: 'mixed.test',
        manufacturingRole: 'co-manufacturer',
        plantBasedFocus: 'mixed',
      },
      {
        ...base,
        name: 'Shop',
        domain: 'shop.test',
        manufacturingRole: 'retailer',
        plantBasedFocus: 'exclusively-vegan',
      },
      {
        ...base,
        name: 'Brand',
        domain: 'brand.test',
        manufacturingRole: 'brand-only',
        plantBasedFocus: 'exclusively-vegan',
      },
      {
        ...base,
        name: 'Unknown Role',
        domain: 'u.test',
        plantBasedFocus: 'mixed',
      },
      {
        ...base,
        name: 'Vegan Mills',
        domain: 'vegan.test',
        manufacturingRole: 'Private-Label Manufacturer',
        plantBasedFocus: 'exclusively-vegan',
      },
      {
        ...base,
        name: 'Nut Co',
        domain: 'nut.test',
        manufacturingRole: 'processor',
        plantBasedFocus: 'unknown',
      },
    ]);
    // Model order is kept (the action sorts after limiting).
    expect(results.map((r) => [r.domain, r.segment])).toEqual([
      ['mixed.test', 'Mixed manufacturer'],
      ['vegan.test', 'Exclusively vegan'],
      ['nut.test', 'Vegan focus unclear'],
    ]);
  });

  it('leaves other industries unchanged', () => {
    expect(industryScope('software')).toBeUndefined();
    expect(industryScope('toString')).toBeUndefined();
    const [result] = classifyCandidates('software', [
      { ...base, domain: 'a.test', manufacturingRole: 'retailer' },
    ]);
    expect(result).toMatchObject({ domain: 'a.test' });
    expect(result?.segment).toBeUndefined();
  });

  it('accepts wording variants from the model', () => {
    const results = classifyCandidates(PLANT_BASED_MANUFACTURING, [
      {
        ...base,
        domain: 'a.test',
        manufacturingRole: 'Contract Manufacturer',
        plantBasedFocus: 'Exclusively Vegan',
      },
      {
        ...base,
        domain: 'b.test',
        manufacturingRole: 'co-packer',
        plantBasedFocus: 'vegan only',
      },
      {
        ...base,
        domain: 'c.test',
        manufacturingRole: 'Manufacturer',
        plantBasedFocus: 'Mixed (also dairy)',
      },
      {
        ...base,
        domain: 'd.test',
        manufacturingRole: 'distributor and manufacturer',
        plantBasedFocus: 'mixed',
      },
      {
        ...base,
        domain: 'e.test',
        manufacturingRole: 'food producer',
        plantBasedFocus: 'Unknown',
      },
    ]);
    expect(results.map((r) => [r.domain, r.segment])).toEqual([
      ['a.test', 'Exclusively vegan'],
      ['b.test', 'Exclusively vegan'],
      ['c.test', 'Mixed manufacturer'],
      ['d.test', 'Mixed manufacturer'],
      ['e.test', 'Vegan focus unclear'],
    ]);
  });
});
