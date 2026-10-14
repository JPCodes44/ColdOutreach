import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { SettingsEditor } from './SettingsEditor';
import type { SettingsData, SettingsValues } from './types';

const getSettingsQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  SettingsData
>('settings:get');
const saveSettingsMutation = makeFunctionReference<
  'mutation',
  SettingsValues,
  { version: number }
>('settings:save');

/** Editable, versioned outreach configuration. */
export function SettingsScreen() {
  const data = useQuery(getSettingsQuery, {});
  const save = useMutation(saveSettingsMutation);
  return (
    <section className="settingsScreen">
      <header className="settingsHeader">
        <h1 className="settingsTitle">Settings</h1>
        <p className="settingsSubtitle">
          Niche, offer, signature, and instructions used to generate outreach.
        </p>
      </header>
      {data === undefined ? (
        <p className="settingsLoading">Loading settings…</p>
      ) : (
        <SettingsEditor
          key={data.version}
          data={data}
          onSave={(values) => save(values)}
        />
      )}
    </section>
  );
}
