import { useState } from 'react';
import { useMutation } from 'convex/react';
import { errorMessage } from '../shared/errorMessage';
import {
  MAX_RUNS_PER_REQUEST,
  deleteCompaniesMutation,
  requestRunsMutation,
} from './api';

/** Run/Delete actions for the pipeline screen, with user-facing notices. */
export function usePipelineActions(
  selectedIds: ReadonlySet<string>,
  clearSelected: () => void,
  nameOf: (id: string) => string,
  websiteReviewEnabled: boolean,
) {
  const requestRuns = useMutation(requestRunsMutation);
  const deleteCompanies = useMutation(deleteCompaniesMutation);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const run = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (ids.length > MAX_RUNS_PER_REQUEST) {
      setNotice(`Run at most ${MAX_RUNS_PER_REQUEST} companies at a time.`);
      return;
    }
    setRunning(true);
    try {
      const { started, skipped } = await requestRuns({
        companyIds: ids,
        websiteReviewEnabled,
      });
      const parts = [
        `Started ${started.length} run${started.length === 1 ? '' : 's'}. No email is sent.`,
      ];
      for (const skip of skipped)
        parts.push(`${nameOf(skip.companyId)}: ${skip.reason}`);
      setNotice(parts.join(' '));
      clearSelected();
    } catch (error) {
      setNotice(errorMessage(error, 'Could not start the pipeline.'));
    } finally {
      setRunning(false);
    }
  };

  const confirmDelete = async () => {
    const ids = pendingDelete;
    setPendingDelete(null);
    if (ids === null) return;
    try {
      await deleteCompanies({ externalIds: ids });
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
    requestDelete: () => {
      if (selectedIds.size > 0) setPendingDelete([...selectedIds]);
    },
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  };
}
