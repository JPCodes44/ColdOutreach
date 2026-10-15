// Detailed discovery scopes for specialised industry presets. A preset adds a
// precise scope to the research request, asks for classification fields, and
// lets the server drop candidates outside the scope and label the rest.

export interface CandidateClassification {
  manufacturingRole?: unknown;
  plantBasedFocus?: unknown;
}

export interface IndustryScope {
  /** Human-readable industry sent to the researcher. */
  label: string;
  /** Exact inclusion/exclusion rules for the researcher. */
  scope: string;
  /** Extra response fields the researcher must fill for each company. */
  responseFields: Record<string, string>;
  /** Decide whether a candidate is in scope and how to label it. */
  classify: (candidate: CandidateClassification) => {
    keep: boolean;
    segment?: string;
  };
}

const FOCUS_LABELS = {
  vegan: 'Exclusively vegan',
  mixed: 'Mixed manufacturer',
};

function text(value: unknown): string {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    : '';
}

/**
 * Makes or processes the products (incl. co-, contract, private-label). A
 * business that also distributes still counts; one that only retails,
 * distributes or markets does not.
 */
function isManufacturingRole(role: string): boolean {
  return /manufactur|processor|co-?pack|producer/.test(role);
}

function focusLabel(focus: string): string {
  if (focus.startsWith('mixed')) return FOCUS_LABELS.mixed;
  if (
    /^(exclusively-|100%-|all-|only-)?vegan(-only)?$|plant-based-only/.test(
      focus,
    )
  ) {
    return FOCUS_LABELS.vegan;
  }
  return 'Vegan focus unclear';
}

export const PLANT_BASED_MANUFACTURING = 'plant-based-manufacturing';

export const INDUSTRY_SCOPES: Record<string, IndustryScope> = {
  [PLANT_BASED_MANUFACTURING]: {
    label: 'Plant-Based Food & Ingredient Manufacturers',
    scope:
      'Manufacturers, processors and co-manufacturers of plant-based foods and ingredients, including products not explicitly branded vegan: sauces, dips, dry mixes, grains, pulses, nuts, seeds and plant-based alternatives. Include private-label and contract manufacturers. Exclude businesses that only retail, distribute or market products without manufacturing them. Flag mixed manufacturers (that also make animal-based products) separately from exclusively vegan manufacturers.',
    responseFields: {
      industry:
        'the main product category made, e.g. "Pulse ingredients", "Plant-based cheese", "Sauces & dips", "Nut butters", "Dry mixes"',
      manufacturingRole:
        'one of: manufacturer, processor, co-manufacturer, private-label manufacturer, contract manufacturer, retailer, distributor, brand-only (markets products made by others), unknown',
      plantBasedFocus:
        'one of: exclusively-vegan (every product is plant-based), mixed (also makes animal-based products), unknown',
    },
    classify: (candidate) => {
      if (!isManufacturingRole(text(candidate.manufacturingRole))) {
        return { keep: false };
      }
      return {
        keep: true,
        segment: focusLabel(text(candidate.plantBasedFocus)),
      };
    },
  },
};

/** The preset scope for an industry filter value, if it has one. */
export function industryScope(industry: string): IndustryScope | undefined {
  return Object.prototype.hasOwnProperty.call(INDUSTRY_SCOPES, industry)
    ? INDUSTRY_SCOPES[industry]
    : undefined;
}

/** Display order: exclusively vegan first, then mixed, then unclear. */
export function segmentRank(segment: string | undefined): number {
  if (segment === FOCUS_LABELS.vegan) return 0;
  if (segment === FOCUS_LABELS.mixed) return 1;
  return segment === undefined ? 3 : 2;
}
