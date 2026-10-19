/** Apollo boundary: free candidate discovery, at most three paid work-email reveals. */
export type EmailSlot = 'email1' | 'email2' | 'email3';
export interface ApolloContact {
  slot: EmailSlot;
  apolloId: string;
  name: string;
  title: string;
  email: string;
  role: 'management' | 'specialist';
}
export class ApolloError extends Error {}
const seniorities = [
  'owner',
  'founder',
  'c_suite',
  'partner',
  'vp',
  'head',
  'director',
];
const personalDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'msn.com',
]);
type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
const string = (value: unknown): string =>
  typeof value === 'string' ? value : '';
export function companyDomain(value: string): string {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!domain.includes('.') || url.username || url.password)
      throw new Error();
    return domain;
  } catch {
    throw new ApolloError(
      'A valid company website is required for Apollo enrichment.',
    );
  }
}

export async function enrichRecipients(input: {
  apiKey: string;
  domain: string;
  targetTitles: string[];
  slots: EmailSlot[];
  existingEmails: string[];
  existingApolloIds?: string[];
  fetcher?: typeof fetch;
}): Promise<{ contacts: ApolloContact[]; creditsConsumed: number | null }> {
  const domain = companyDomain(input.domain);
  const request = async (path: string, body: unknown): Promise<Json> => {
    let response: Response;
    try {
      response = await (input.fetcher ?? fetch)(
        `https://api.apollo.io/api/v1/${path}`,
        {
          method: 'POST',
          headers: {
            'x-api-key': input.apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(25_000),
        },
      );
    } catch {
      throw new ApolloError(
        'Apollo request failed or timed out. No automatic paid retry was made.',
      );
    }
    if (!response.ok) {
      const message =
        response.status === 429
          ? 'Apollo rate limit reached. Try again later.'
          : response.status === 401
            ? 'Apollo rejected the API key. Check the Convex server configuration.'
            : response.status === 403
              ? 'Apollo access denied. Check API permissions and account eligibility.'
              : response.status === 402
                ? 'Apollo credits are unavailable. Check your Apollo account.'
                : `Apollo request failed (${response.status}). Check your account before retrying.`;
      throw new ApolloError(message);
    }
    try {
      return object(await response.json());
    } catch {
      throw new ApolloError('Apollo returned an invalid response.');
    }
  };
  const selected: {
    id: string;
    slot: EmailSlot;
    role: ApolloContact['role'];
  }[] = [];
  for (const role of ['management', 'specialist'] as const) {
    const slots = input.slots.filter(
      (slot) => (slot === 'email3') === (role === 'specialist'),
    );
    if (!slots.length) continue;
    const result = await request('mixed_people/api_search', {
      q_organization_domains_list: [domain],
      contact_email_status: ['verified'],
      person_seniorities:
        role === 'management' ? seniorities : ['senior', 'entry'],
      ...(role === 'specialist'
        ? { person_titles: input.targetTitles, include_similar_titles: true }
        : {}),
      per_page: 25,
      page: 1,
    });
    if (!Array.isArray(result.people))
      throw new ApolloError('Apollo returned an invalid candidate list.');
    const candidates = result.people
      .map(object)
      .filter(
        (p) =>
          p.has_email === true &&
          string(p.id) &&
          !input.existingApolloIds?.includes(string(p.id)),
      );
    // Prefer operational/technical decision-makers within the management pool.
    if (role === 'management')
      candidates.sort(
        (a, b) =>
          Number(
            /research|development|operations|technical|engineering|technology|ceo|chief executive/i.test(
              string(b.title),
            ),
          ) -
          Number(
            /research|development|operations|technical|engineering|technology|ceo|chief executive/i.test(
              string(a.title),
            ),
          ),
      );
    for (const candidate of candidates) {
      const slot = slots.shift();
      if (!slot) break;
      const id = string(candidate.id);
      if (selected.some((p) => p.id === id)) {
        slots.unshift(slot);
        continue;
      }
      selected.push({ id, slot, role });
    }
  }
  if (!selected.length) return { contacts: [], creditsConsumed: 0 };
  const result = await request(
    'people/bulk_match?reveal_personal_emails=false&reveal_phone_number=false&run_waterfall_email=false&run_waterfall_phone=false',
    { details: selected.map((p) => ({ id: p.id })) },
  );
  if (!Array.isArray(result.matches))
    throw new ApolloError(
      'Apollo returned an invalid enrichment response. Check usage before retrying.',
    );
  const matches = result.matches.map(object);
  const seen = new Set(
    input.existingEmails.map((email) => email.trim().toLowerCase()),
  );
  const contacts: ApolloContact[] = [];
  for (const candidate of selected) {
    const person = matches.find((p) => p.id === candidate.id);
    if (
      !person ||
      (person.match_confidence !== undefined &&
        person.match_confidence !== 'high')
    )
      continue;
    const organization = object(person.organization);
    // The top-level organization is the current employer. Never trust a past
    // employment_history domain, which Apollo's search also matches.
    let currentDomain = '';
    try {
      currentDomain = companyDomain(
        string(organization.primary_domain) || string(organization.website_url),
      );
    } catch {
      continue;
    }
    if (currentDomain !== domain) continue;
    const level = string(person.seniority);
    if (
      candidate.role === 'management'
        ? !seniorities.includes(level)
        : !['senior', 'entry'].includes(level)
    )
      continue;
    const email = string(person.email).trim().toLowerCase();
    if (
      person.email_status !== 'verified' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      personalDomains.has(email.split('@')[1]!) ||
      seen.has(email)
    )
      continue;
    seen.add(email);
    contacts.push({
      slot: candidate.slot,
      apolloId: candidate.id,
      role: candidate.role,
      email,
      name: string(person.name),
      title: string(person.title),
    });
  }
  return {
    contacts,
    creditsConsumed:
      typeof result.credits_consumed === 'number'
        ? result.credits_consumed
        : null,
  };
}
