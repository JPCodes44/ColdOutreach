import { useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { QueueTable } from './QueueTable';
import { SentEmailViewer } from './SentEmailViewer';
import { SentTable } from './SentTable';
import {
  cancelMutation,
  checkInboxAction,
  getSentQuery,
  listQueueQuery,
  listSentQuery,
  resolveMutation,
} from './api';

/** Queue attempts plus the durable sent-email record. */
export function HistoryScreen() {
  const queue = useQuery(listQueueQuery, {});
  const sent = useQuery(listSentQuery, {});
  const [openId, setOpenId] = useState<string | null>(null);
  const openEmail = useQuery(
    getSentQuery,
    openId !== null ? { id: openId } : 'skip',
  );
  const cancel = useMutation(cancelMutation);
  const resolve = useMutation(resolveMutation);
  const checkInbox = useAction(checkInboxAction);

  return (
    <section className="historyScreen">
      <header>
        <h1 className="historyTitle">Send History</h1>
        <p className="historySubtitle">
          Every scheduled send, its Gmail outcome, and the exact content that
          was sent.
        </p>
      </header>
      <QueueTable
        rows={queue}
        onCancel={async (itemId) => {
          await cancel({ itemId });
        }}
        onResolve={async (itemId, outcome) => {
          await resolve({ itemId, outcome });
        }}
      />
      <SentTable
        rows={sent}
        onOpen={setOpenId}
        onCheckInbox={() => checkInbox({})}
      />
      {openId !== null ? (
        <SentEmailViewer email={openEmail} onClose={() => setOpenId(null)} />
      ) : null}
    </section>
  );
}
