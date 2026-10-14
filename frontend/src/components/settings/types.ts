/** Editable outreach configuration (mirrors `settings:save` args). */
export type SettingsValues = {
  niche: string;
  offer: string;
  senderName: string;
  signature: string;
  customInstructions: string;
};

export type SettingsKey = keyof SettingsValues;

/** Shape returned by `settings:get`. Never contains credentials. */
export type SettingsData = SettingsValues & {
  version: number;
  updatedAt: string | null;
  limits: Record<SettingsKey, number>;
};

export interface SettingsFieldDef {
  key: SettingsKey;
  label: string;
  hint: string;
  multiline: boolean;
  required: boolean;
}

export interface SettingsFieldProps {
  def: SettingsFieldDef;
  value: string;
  limit: number;
  onChange: (key: SettingsKey, value: string) => void;
}

export interface SettingsFormProps {
  values: SettingsValues;
  limits: Record<SettingsKey, number>;
  canSave: boolean;
  saving: boolean;
  onChange: (key: SettingsKey, value: string) => void;
  onSubmit: () => void;
}

export interface SettingsNoticeProps {
  version: number;
  updatedAt: string | null;
}

export interface SettingsStatusProps {
  savedVersion: number | null;
  error: string | null;
}

export interface SettingsEditorProps {
  data: SettingsData;
  onSave: (values: SettingsValues) => Promise<{ version: number }>;
}
