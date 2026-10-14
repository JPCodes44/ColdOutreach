import { useState } from 'react';
import { errorMessage } from '../shared/errorMessage';
import { editableValues, settingsFields } from './data';
import { SettingsForm } from './SettingsForm';
import { SettingsNotice } from './SettingsNotice';
import { SettingsStatus } from './SettingsStatus';
import type { SettingsEditorProps, SettingsKey, SettingsValues } from './types';

/** Form state for one loaded settings version; remounted per version. */
export function SettingsEditor({ data, onSave }: SettingsEditorProps) {
  const [values, setValues] = useState<SettingsValues>(() =>
    editableValues(data),
  );
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changed = settingsFields.some((f) => values[f.key] !== data[f.key]);
  const valid = settingsFields.every(
    (f) =>
      values[f.key].length <= data.limits[f.key] &&
      (!f.required || values[f.key].trim().length > 0),
  );

  const onChange = (key: SettingsKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSavedVersion(null);
    setError(null);
  };

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      setSavedVersion((await onSave(values)).version);
    } catch (cause) {
      setError(errorMessage(cause, 'Saving settings failed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settingsLayout">
      <SettingsForm
        values={values}
        limits={data.limits}
        canSave={changed && valid}
        saving={saving}
        onChange={onChange}
        onSubmit={() => void onSubmit()}
      />
      <div className="settingsSide">
        <SettingsNotice version={data.version} updatedAt={data.updatedAt} />
        <SettingsStatus savedVersion={savedVersion} error={error} />
      </div>
    </div>
  );
}
