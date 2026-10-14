import { useState } from 'react';
import { useMutation } from 'convex/react';
import { errorMessage } from '../shared/errorMessage';
import { cancelScheduledSendsMutation, enqueueSendMutation } from './api';
import type { DeliveryMethod } from './types';

/** Schedule / unschedule calls with in-flight flags and a user-facing notice. */
export function useScheduleActions() {
  const enqueueSend = useMutation(enqueueSendMutation);
  const cancelScheduledSends = useMutation(cancelScheduledSendsMutation);
  const [scheduling, setScheduling] = useState(false);
  const [unscheduling, setUnscheduling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const schedule = async (
    companyIds: string[],
    scheduledAtMs: number,
    method: DeliveryMethod,
  ) => {
    setScheduling(true);
    setNotice(null);
    try {
      const result = await enqueueSend({ companyIds, scheduledAtMs, method });
      setNotice(
        `${result.queued} email${result.queued === 1 ? '' : 's'} scheduled for Gmail sending.`,
      );
    } catch (error) {
      setNotice(errorMessage(error, 'Failed to schedule outreach.'));
    } finally {
      setScheduling(false);
    }
  };

  const unschedule = async (companyIds: string[]) => {
    setUnscheduling(true);
    setNotice(null);
    try {
      const { canceled } = await cancelScheduledSends({ companyIds });
      setNotice(
        canceled === 0
          ? 'No queued emails found for the selected companies.'
          : `${canceled} scheduled email${canceled === 1 ? '' : 's'} canceled.`,
      );
      return true;
    } catch (error) {
      setNotice(errorMessage(error, 'Failed to unschedule selected emails.'));
      return false;
    } finally {
      setUnscheduling(false);
    }
  };

  return { schedule, unschedule, scheduling, unscheduling, notice };
}
