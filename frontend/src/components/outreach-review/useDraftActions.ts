import { useState } from 'react';
import { useMutation } from 'convex/react';
import { errorMessage } from '../shared/errorMessage';
import { saveDraftEditsMutation } from './api';
import type { EditableFields } from './types';

/** Save edits with shared busy and error state. */
export function useDraftActions(companyId: string) {
  const saveEdits = useMutation(saveDraftEditsMutation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perform = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause, fallback));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    save: (fields: EditableFields) =>
      perform(
        () => saveEdits({ companyId, ...fields }),
        'Could not save edits.',
      ),
  };
}
