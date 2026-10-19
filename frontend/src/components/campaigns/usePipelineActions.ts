import { useState } from 'react';
import { useMutation } from 'convex/react';
import { errorMessage } from '../shared/errorMessage';
import {
  deleteCompaniesMutation,
  deleteDraftsMutation,
  requestRunsMutation,
} from './api';

/** Run/Delete actions for the pipeline screen, with user-facing notices. */
export function usePipelineActions(
  selectedIds: ReadonlySet<string>,
  runnableIds: ReadonlySet<string>,
  clearSelected: () => void,
  websiteReviewEnabled: boolean,
) {
  const requestRuns = useMutation(requestRunsMutation);
  const deleteCompanies = useMutation(deleteCompaniesMutation);
  const deleteDrafts = useMutation(deleteDraftsMutation);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'companies' | 'drafts';
    ids: string[];
  } | null>(null);

  const run = async () => {
    const ids = [...runnableIds];
    if (ids.length === 0 || running) return;
    setRunning(true);
    setNotice(null);
    try {
      await requestRuns({
        companyIds: ids,
        websiteReviewEnabled,
      });
      clearSelected();
    } catch (error) {
      setNotice(errorMessage(error, 'Could not start the pipeline.'));
    } finally {
      setRunning(false);
    }
  };

  const confirmDelete = async () => {
    const pending = pendingDelete;
    setPendingDelete(null);
    if (pending === null) return;
    try {
      if (pending.kind === 'drafts') {
        const { deleted } = await deleteDrafts({ companyIds: pending.ids });
        setNotice(
          `Deleted ${deleted} draft${deleted === 1 ? '' : 's'}. Companies are kept.`,
        );
      } else {
        await deleteCompanies({ externalIds: pending.ids });
      }
      clearSelected();
    } catch (error) {
      setNotice(errorMessage(error, 'Delete failed.'));
    }
  };

  return {
    running,
    notice,
    dismissNotice: () => setNotice(null),
    run,
    pendingDelete,
    requestDelete: (kind: 'companies' | 'drafts') => {
      if (selectedIds.size > 0)
        setPendingDelete({ kind, ids: [...selectedIds] });
    },
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  };
}
