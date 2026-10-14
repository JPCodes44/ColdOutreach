import type { SettingsFieldDef, SettingsValues } from './types';

export const settingsFields: SettingsFieldDef[] = [
  {
    key: 'niche',
    label: 'Niche',
    hint: 'Who you reach out to, e.g. "Independent dental clinics".',
    multiline: false,
    required: true,
  },
  {
    key: 'offer',
    label: 'Offer / service description',
    hint: 'What you propose to build or run for them.',
    multiline: true,
    required: true,
  },
  {
    key: 'senderName',
    label: 'Sender display name',
    hint: 'Shown at the end of each email.',
    multiline: false,
    required: false,
  },
  {
    key: 'signature',
    label: 'Signature',
    hint: 'Lines below your name: company, website, phone.',
    multiline: true,
    required: false,
  },
  {
    key: 'customInstructions',
    label: 'Custom email instructions',
    hint: 'Tone and focus preferences. They cannot override the evidence and safety rules.',
    multiline: true,
    required: false,
  },
];

export const emptySettings: SettingsValues = {
  niche: '',
  offer: '',
  senderName: '',
  signature: '',
  customInstructions: '',
};

/** Pick only the editable fields from loaded settings. */
export function editableValues(values: SettingsValues): SettingsValues {
  return {
    niche: values.niche,
    offer: values.offer,
    senderName: values.senderName,
    signature: values.signature,
    customInstructions: values.customInstructions,
  };
}
