import { useState } from 'react';
import { useMutation } from 'convex/react';
import { errorMessage } from '../shared/errorMessage';
import {
  approveDraftMutation,
  saveDraftEditsMutation,
  unapproveDraftMutation,
} from './api';
import type { EditableFields } from './types';

/** Save/approve/withdraw mutations with shared busy and error state. */
export function useDraftActions(companyId: string) {
  const saveEdits = useMutation(saveDraftEditsMutation);
  const approve = useMutation(approveDraftMutation);
  const unapprove = useMutation(unapproveDraftMutation);
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
    approve: (acknowledgedClaims: string[]) =>
      perform(
        () => approve({ companyId, acknowledgedClaims }),
        'Could not approve the draft.',
      ),
    unapprove: () =>
      perform(() => unapprove({ companyId }), 'Could not withdraw approval.'),
  };
}
