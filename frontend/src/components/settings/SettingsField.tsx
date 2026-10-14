import type { SettingsFieldProps } from './types';

/** One labeled settings input with a character counter. */
export function SettingsField({
  def,
  value,
  limit,
  onChange,
}: SettingsFieldProps) {
  const id = `settings-${def.key}`;
  const over = value.length > limit;
  return (
    <div className="settingsField">
      <label className="settingsLabel" htmlFor={id}>
        {def.label}
        {def.required ? <span className="settingsRequired"> *</span> : null}
      </label>
      {def.multiline ? (
        <textarea
          id={id}
          className="settingsInput settingsTextarea"
          value={value}
          rows={def.key === 'customInstructions' ? 6 : 3}
          onChange={(event) => onChange(def.key, event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="settingsInput"
          value={value}
          onChange={(event) => onChange(def.key, event.target.value)}
        />
      )}
      <div className="settingsFieldMeta">
        <span className="settingsHint">{def.hint}</span>
        <span
          className={over ? 'settingsCount settingsCountOver' : 'settingsCount'}
        >
          {value.length}/{limit}
        </span>
      </div>
    </div>
  );
}
