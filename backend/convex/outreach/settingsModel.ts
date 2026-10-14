// Editable outreach configuration: defaults, limits, and validation. Plain
// module so queries, mutations, and Node actions can all share it.

export interface OutreachSettingsInput {
  niche: string;
  offer: string;
  senderName: string;
  signature: string;
  customInstructions: string;
}

export interface OutreachSettings extends OutreachSettingsInput {
  /** 0 for the built-in defaults; saved versions start at 1. */
  version: number;
}

export const DEFAULT_SETTINGS: OutreachSettings = {
  version: 0,
  niche:
    'Local service businesses that rely on inbound web and phone inquiries',
  offer:
    'Lead-response automation: instant acknowledgement of new website inquiries, routing each lead to the right person, follow-up reminders so nothing goes cold, and a simple dashboard showing where every lead stands.',
  senderName: '',
  signature: '',
  customInstructions: '',
};

export const SETTINGS_LIMITS: Record<keyof OutreachSettingsInput, number> = {
  niche: 200,
  offer: 1500,
  senderName: 100,
  signature: 500,
  customInstructions: 3000,
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|app[_-]?password|secret|token)\s*[:=]\s*\S{8,}/i,
];

/** Heuristic guard so credentials are not stored in (or sent to models via) settings. */
export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

/** Trim, enforce limits, and reject secret-looking values. Throws on invalid input. */
export function normalizeSettingsInput(
  input: OutreachSettingsInput,
): OutreachSettingsInput {
  const normalized: OutreachSettingsInput = {
    niche: input.niche.trim(),
    offer: input.offer.trim(),
    senderName: input.senderName.trim(),
    signature: input.signature.replace(/\r\n?/g, '\n').trim(),
    customInstructions: input.customInstructions.replace(/\r\n?/g, '\n').trim(),
  };
  if (normalized.niche.length === 0) throw new Error('Niche is required.');
  if (normalized.offer.length === 0) {
    throw new Error('Offer description is required.');
  }
  for (const key of Object.keys(
    SETTINGS_LIMITS,
  ) as (keyof OutreachSettingsInput)[]) {
    if (normalized[key].length > SETTINGS_LIMITS[key]) {
      throw new Error(
        `${key} must be at most ${SETTINGS_LIMITS[key]} characters.`,
      );
    }
    if (looksLikeSecret(normalized[key])) {
      throw new Error(
        `${key} looks like it contains a credential. Keep secrets in Convex environment variables, not Settings.`,
      );
    }
  }
  return normalized;
}

/** The signature block appended to emails generated with these settings. */
export function signatureBlock(settings: OutreachSettingsInput): string {
  return [settings.senderName, settings.signature]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n');
}
