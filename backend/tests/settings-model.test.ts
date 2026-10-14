import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  looksLikeSecret,
  normalizeSettingsInput,
  signatureBlock,
} from '../convex/outreach/settingsModel';

const VALID = {
  niche: '  Dental clinics ',
  offer: 'Lead-response automation',
  senderName: 'Sam',
  signature: 'Rivera Automation\r\nsam@rivera.test',
  customInstructions: '',
};

describe('outreach settings model', () => {
  it('ships neutral lead-response defaults rather than a hard-coded niche', () => {
    expect(DEFAULT_SETTINGS.version).toBe(0);
    expect(DEFAULT_SETTINGS.offer).toMatch(/lead/i);
    expect(DEFAULT_SETTINGS.niche).not.toMatch(/health|medical|dental/i);
  });

  it('trims and normalizes line endings', () => {
    expect(normalizeSettingsInput(VALID)).toEqual({
      ...VALID,
      niche: 'Dental clinics',
      signature: 'Rivera Automation\nsam@rivera.test',
    });
  });

  it('requires niche and offer and enforces length limits', () => {
    expect(() => normalizeSettingsInput({ ...VALID, niche: ' ' })).toThrow(
      'Niche is required.',
    );
    expect(() => normalizeSettingsInput({ ...VALID, offer: '' })).toThrow(
      'Offer description is required.',
    );
    expect(() =>
      normalizeSettingsInput({
        ...VALID,
        customInstructions: 'x'.repeat(SETTINGS_LIMITS.customInstructions + 1),
      }),
    ).toThrow(/customInstructions must be at most/);
  });

  it('refuses values that look like credentials', () => {
    expect(looksLikeSecret('use key sk-abcdefghijklmnopqrstuv')).toBe(true);
    expect(looksLikeSecret('AIzaSyA1234567890abcdefghijk')).toBe(true);
    // Built at runtime: an obviously fake value, kept out of scanner-visible literals.
    expect(looksLikeSecret(`app_password: ${'x'.repeat(12)}`)).toBe(true);
    expect(looksLikeSecret('Keep it short and friendly.')).toBe(false);
    expect(() =>
      normalizeSettingsInput({
        ...VALID,
        customInstructions: 'token=abcdefghijklmnop',
      }),
    ).toThrow(/looks like it contains a credential/);
  });

  it('builds the signature from sender name and signature', () => {
    expect(signatureBlock(VALID)).toBe(
      'Sam\nRivera Automation\r\nsam@rivera.test',
    );
    expect(signatureBlock({ ...VALID, senderName: '', signature: '' })).toBe(
      '',
    );
  });
});
