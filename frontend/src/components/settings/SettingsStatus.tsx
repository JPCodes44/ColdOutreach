import type { SettingsStatusProps } from './types';

/** Save confirmation or backend error message. */
export function SettingsStatus({ savedVersion, error }: SettingsStatusProps) {
  if (error !== null) {
    return (
      <p className="settingsStatus settingsStatusError" role="alert">
        {error}
      </p>
    );
  }
  if (savedVersion !== null) {
    return (
      <p className="settingsStatus" role="status">
        Saved as version {savedVersion}.
      </p>
    );
  }
  return null;
}
