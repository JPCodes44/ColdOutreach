import { settingsFields } from './data';
import { SettingsField } from './SettingsField';
import type { SettingsFormProps } from './types';

/** The editable outreach settings form. */
export function SettingsForm({
  values,
  limits,
  canSave,
  saving,
  onChange,
  onSubmit,
}: SettingsFormProps) {
  return (
    <form
      className="settingsForm"
      aria-label="Outreach settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSubmit();
      }}
    >
      {settingsFields.map((def) => (
        <SettingsField
          key={def.key}
          def={def}
          value={values[def.key]}
          limit={limits[def.key]}
          onChange={onChange}
        />
      ))}
      <div className="settingsActions">
        <button
          className="settingsSaveButton"
          type="submit"
          disabled={!canSave || saving}
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
