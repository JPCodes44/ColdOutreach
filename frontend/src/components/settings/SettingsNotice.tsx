import type { SettingsNoticeProps } from './types';

/** Version info plus how settings changes and credentials are handled. */
export function SettingsNotice({ version, updatedAt }: SettingsNoticeProps) {
  return (
    <aside className="settingsNotice">
      <p className="settingsVersion">
        {version === 0
          ? 'Using built-in defaults (not yet saved).'
          : `Current version ${version}${
              updatedAt !== null
                ? `, saved ${new Date(updatedAt).toLocaleString()}`
                : ''
            }.`}
      </p>
      <p>
        Changes apply to future pipeline runs only. Existing drafts and
        scheduled emails are unchanged.
      </p>
      <p>
        Credentials (API keys, Gmail password) are managed in Convex environment
        variables and are never shown or entered here.
      </p>
    </aside>
  );
}
