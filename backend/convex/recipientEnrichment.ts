import { v } from 'convex/values';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { requireOperatorAction } from './operator';
import {
  ApolloError,
  enrichRecipients,
  type EmailSlot,
} from './outreach/apolloEnrichment';

const slots: EmailSlot[] = ['email1', 'email2', 'email3'];
const contactValidator = v.object({
  slot: v.union(v.literal('email1'), v.literal('email2'), v.literal('email3')),
  apolloId: v.string(),
  name: v.string(),
  title: v.string(),
  email: v.string(),
  role: v.union(v.literal('management'), v.literal('specialist')),
});
export const begin = internalMutation({
  args: { companyId: v.string(), token: v.string() },
  handler: async (ctx, { companyId, token }) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('by_externalId', (q) => q.eq('externalId', companyId))
      .unique();
    if (!company) throw new Error('Company no longer exists.');
    if (
      company.recipientEnrichment?.status === 'running' &&
      Date.now() - company.recipientEnrichment.startedAt < 180_000
    )
      throw new Error('Apollo enrichment is already running for this company.');
    const missing = slots.filter((slot) => !company[slot]?.trim());
    if (!missing.length) return null;
    await ctx.db.patch(company._id, {
      recipientEnrichment: {
        token,
        startedAt: Date.now(),
        status: 'running',
        message: 'Finding verified work emails…',
      },
    });
    return {
      domain: company.domain,
      slots: missing,
      existingEmails: slots.map((slot) => company[slot] ?? ''),
      existingApolloIds: (company.apolloContacts ?? [])
        .filter((c) => company[c.slot]?.trim().toLowerCase() === c.email)
        .map((c) => c.apolloId),
    };
  },
});
export const finish = internalMutation({
  args: {
    companyId: v.string(),
    token: v.string(),
    contacts: v.array(contactValidator),
    creditsConsumed: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('by_externalId', (q) => q.eq('externalId', args.companyId))
      .unique();
    if (
      !company ||
      company.recipientEnrichment?.token !== args.token ||
      company.recipientEnrichment.status !== 'running'
    )
      return { filled: 0, message: 'Company changed; no emails saved.' };
    const seen = new Set(
      slots.map((slot) => company[slot]?.trim().toLowerCase()).filter(Boolean),
    );
    const patch: Partial<Record<EmailSlot, string>> = {};
    const contacts = (company.apolloContacts ?? []).filter(
      (c) => company[c.slot]?.trim().toLowerCase() === c.email,
    );
    for (const contact of args.contacts) {
      if (
        company[contact.slot]?.trim() ||
        patch[contact.slot] ||
        seen.has(contact.email)
      )
        continue;
      seen.add(contact.email);
      patch[contact.slot] = contact.email;
      contacts.push(contact);
    }
    const filled = Object.keys(patch).length;
    const remaining = slots.filter(
      (slot) => !(patch[slot] ?? company[slot])?.trim(),
    ).length;
    const message =
      args.error ??
      `Added ${filled} verified work email${filled === 1 ? '' : 's'}.${remaining ? ` ${remaining} slot${remaining === 1 ? '' : 's'} still empty; no suitable verified match saved.` : ''}`;
    await ctx.db.patch(company._id, {
      ...patch,
      apolloContacts: contacts,
      recipientEnrichment: {
        ...company.recipientEnrichment,
        status: args.error ? 'failed' : 'done',
        message,
        ...(args.creditsConsumed !== undefined
          ? { creditsConsumed: args.creditsConsumed }
          : {}),
      },
    });
    return { filled, message, failed: Boolean(args.error) };
  },
});

/** Explicit user-triggered contact discovery. Never queues or sends email. */
export const fillEmails = action({
  args: { companyId: v.string(), targetTitles: v.array(v.string()) },
  handler: async (
    ctx,
    { companyId, targetTitles },
  ): Promise<{ filled: number; message: string; failed?: boolean }> => {
    await requireOperatorAction(ctx);
    const apiKey = process.env.APOLLO_API_KEY?.trim();
    if (!apiKey)
      throw new Error(
        'Set APOLLO_API_KEY in the Convex server environment to fill recipient emails.',
      );
    const titles = [
      ...new Set(targetTitles.map((t) => t.trim()).filter(Boolean)),
    ];
    if (
      !titles.length ||
      titles.length > 12 ||
      titles.some((t) => t.length > 100)
    )
      throw new Error(
        'Enter 1–12 target job titles, up to 100 characters each.',
      );
    const token = crypto.randomUUID();
    const input = await ctx.runMutation(internal.recipientEnrichment.begin, {
      companyId,
      token,
    });
    if (!input)
      return {
        filled: 0,
        message: 'All three email slots are already filled.',
      };
    try {
      const result = await enrichRecipients({
        ...input,
        apiKey,
        targetTitles: titles,
      });
      return await ctx.runMutation(internal.recipientEnrichment.finish, {
        companyId,
        token,
        contacts: result.contacts,
        ...(result.creditsConsumed !== null
          ? { creditsConsumed: result.creditsConsumed }
          : {}),
      });
    } catch (error) {
      const message =
        error instanceof ApolloError
          ? error.message
          : 'Apollo enrichment failed. Check Apollo usage before retrying.';
      return await ctx.runMutation(internal.recipientEnrichment.finish, {
        companyId,
        token,
        contacts: [],
        error: message,
      });
    }
  },
});
