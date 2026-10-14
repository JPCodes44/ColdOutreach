import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { QueueTable } from './QueueTable';
import { SentEmailViewer } from './SentEmailViewer';
import { SentTable } from './SentTable';
import type {
  QueueRow,
  ResolveOutcome,
  SentEmailDetail,
  SentEmailRow,
} from './types';

type Empty = Record<string, never>;
const listQueueQuery = makeFunctionReference<'query', Empty, QueueRow[]>(
  'send:listQueue',
);
const listSentQuery = makeFunctionReference<'query', Empty, SentEmailRow[]>(
  'send:listSentEmails',
);
const getSentQuery = makeFunctionReference<
  'query',
  { id: string },
  SentEmailDetail | null
>('send:getSentEmail');
const cancelMutation = makeFunctionReference<
  'mutation',
  { itemId: string },
  null
>('send:cancelQueueItem');
const resolveMutation = makeFunctionReference<
  'mutation',
  { itemId: string; outcome: ResolveOutcome },
  null
>('send:resolveUncertainSend');

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
      <SentTable rows={sent} onOpen={setOpenId} />
      {openId !== null ? (
        <SentEmailViewer email={openEmail} onClose={() => setOpenId(null)} />
      ) : null}
    </section>
  );
}
