// System prompt for grounded company research. Stored as a TS constant so it is
// bundled and available to the Convex action at runtime.

export const COMPANY_RESEARCH_SYSTEM_PROMPT =
  "Research real businesses that are good prospects for the business outreach described in outreachTarget (the sender's niche and service offer). Use Google Search grounding. Find companies that match researchCriteria. Every company must have a working public website; return its bare domain (for example example.com). Exclude any company whose domain matches excludedCompanyDomains. Do not invent companies or domains. Return raw JSON only, with no markdown fences, no citations, and no prose.";
