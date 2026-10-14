import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  nonEmptyStrings,
  renderOutreachEmail,
  splitParagraphs,
} from '@emailstrat/common';
import { draftState, type DraftState } from './outreachRuns';

const DRAFT_LABELS: Record<DraftState, string> = {
  none: 'Not Drafted',
  running: 'Generating',
  ready: 'Needs Approval',
  approved: 'Approved',
  failed: 'Generation Failed',
  legacy: 'Legacy Draft',
};

function hasRecipient(company: {
  email1?: string;
  email2?: string;
  email3?: string;
}): boolean {
  return (
    nonEmptyStrings([company.email1, company.email2, company.email3]).length > 0
  );
}

/**
 * Rows for the Email Table: every company with a generated draft or at least
 * one recipient. `status` is the send status once drafted, else the draft state.
 */
export const listEmailTableRows = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query('companies').collect();
    const rows = [];
    for (const company of companies) {
      const { state } = await draftState(ctx, company.externalId);
      const drafted = state === 'ready' || state === 'approved';
      if (!drafted && !hasRecipient(company)) continue;
      const sendStatus = company.emailStatus ?? 'Not Sent';
      rows.push({
        companyId: company.externalId,
        company: company.name,
        email1: company.email1 ?? '',
        email2: company.email2 ?? '',
        email3: company.email3 ?? '',
        draftState: state,
        status:
          drafted || sendStatus !== 'Not Sent'
            ? sendStatus
            : DRAFT_LABELS[state],
      });
    }
    rows.sort((a, b) => a.company.localeCompare(b.company));
    return rows;
  },
});

/** Companies with at least one recipient email, with draft readiness. */
export const listCompaniesWithEmails = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query('companies').collect();
    const rows = [];
    for (const company of companies.filter(hasRecipient)) {
      const { state } = await draftState(ctx, company.externalId);
      rows.push({
        companyId: company.externalId,
        company: company.name,
        email1: company.email1 ?? '',
        email2: company.email2 ?? '',
        email3: company.email3 ?? '',
        status: company.emailStatus ?? 'Not Sent',
        draftState: state,
        draftLabel: DRAFT_LABELS[state],
      });
    }
    rows.sort((a, b) => a.company.localeCompare(b.company));
    return rows;
  },
});

/**
 * One preview card per recipient for the company's current outreach draft,
 * rendered exactly as it would be queued (plain-text paragraphs + HTML).
 */
export const getCompanyEmailDrafts = query({
  args: { companyId: v.string() },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('by_externalId', (q) => q.eq('externalId', companyId))
      .unique();
    if (company === null) return [];
    const { draft } = await draftState(ctx, companyId);
    if (draft === null) return [];
    const rendered = renderOutreachEmail(draft.content);
    return nonEmptyStrings([
      company.email1,
      company.email2,
      company.email3,
    ]).map((to, index) => ({
      id: `${companyId}-${index}`,
      to,
      subject: rendered.subject,
      body: splitParagraphs(rendered.text),
      html: rendered.html,
      approved: draft.status === 'approved',
    }));
  },
});

/** Persist manually-edited recipient cells for a company. */
export const setEmailRow = mutation({
  args: {
    companyId: v.string(),
    email1: v.optional(v.string()),
    email2: v.optional(v.string()),
    email3: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('by_externalId', (q) => q.eq('externalId', args.companyId))
      .unique();
    if (company === null) return;
    const patch: { email1?: string; email2?: string; email3?: string } = {};
    if (args.email1 !== undefined) patch.email1 = args.email1.trim();
    if (args.email2 !== undefined) patch.email2 = args.email2.trim();
    if (args.email3 !== undefined) patch.email3 = args.email3.trim();
    await ctx.db.patch(company._id, patch);
  },
});
