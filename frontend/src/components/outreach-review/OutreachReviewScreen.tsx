import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { requestRunsMutation } from '../campaigns/api';
import { errorMessage } from '../shared/errorMessage';
import { getReviewQuery } from './api';
import { DraftWorkspace } from './DraftWorkspace';
import { EvidencePanel } from './EvidencePanel';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewHeader } from './ReviewHeader';
import { RunError } from './RunError';
import { RunProgress } from './RunProgress';
import { WorkflowDashboard } from './WorkflowDashboard';
import type { OutreachReviewScreenProps } from './types';

/** View one company's evidence and edit its outreach draft. */
export function OutreachReviewScreen({
  companyId,
  onBack,
}: OutreachReviewScreenProps) {
  const review = useQuery(
    getReviewQuery,
    companyId !== undefined ? { companyId } : 'skip',
  );
  const requestRuns = useMutation(requestRunsMutation);
  const [starting, setStarting] = useState(false);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  if (companyId === undefined) return <ReviewEmptyState onBack={onBack} />;
  if (review === undefined)
    return <p className="reviewMuted reviewLoading">Loading review…</p>;
  if (review === null) return <ReviewEmptyState onBack={onBack} />;

  const run = async () => {
    setStarting(true);
    setRunNotice(null);
    try {
      const { skipped } = await requestRuns({
        companyIds: [companyId],
        ...(review.draft !== null ? { regenerate: true } : {}),
        websiteReviewEnabled:
          review.latestRun?.websiteReviewEnabled ??
          review.draft?.websiteReviewEnabled ??
          false,
      });
      if (skipped.length > 0)
        setRunNotice(skipped.map((skip) => skip.reason).join(' '));
    } catch (error) {
      setRunNotice(errorMessage(error, 'Could not start the pipeline.'));
    } finally {
      setStarting(false);
    }
  };

  const { latestRun, draft, evidence, analysis } = review;
  // Same corpus the backend validated against: facts plus page excerpts.
  const evidenceText = [
    ...(evidence?.facts.map((fact) => fact.text) ?? []),
    ...(evidence?.excerpts?.map((excerpt) => excerpt.text) ?? []),
    ...(evidence?.researchContext === undefined
      ? []
      : [evidence.researchContext]),
  ].join('\n');
  return (
    <section className="reviewScreen">
      <ReviewHeader
        company={review.company}
        draftState={review.draftState}
        hasDraft={draft !== null}
        starting={starting}
        onRun={() => void run()}
        onBack={onBack}
      />
      {runNotice !== null ? (
        <p className="reviewBanner reviewBanner-warning" role="status">
          {runNotice}
        </p>
      ) : null}
      {latestRun?.status === 'running' && review.draftState === 'running' ? (
        <RunProgress
          stage={latestRun.stage}
          websiteReviewEnabled={latestRun.websiteReviewEnabled}
        />
      ) : null}
      {latestRun?.status === 'failed' && latestRun.error !== null ? (
        <RunError error={latestRun.error} hasDraft={draft !== null} />
      ) : null}
      {draft === null ? (
        review.draftState !== 'running' ? (
          <p className="reviewMuted reviewLoading">
            {review.draftState === 'legacy'
              ? 'Only a legacy job-application draft exists. It cannot be sent; run the pipeline to create an outreach draft.'
              : 'No draft yet. Run the pipeline to review the website and generate one.'}
          </p>
        ) : null
      ) : (
        <div className="reviewLayout">
          <div className="reviewColumn">
            {draft.websiteReviewEnabled === false ? (
              <section className="reviewCard" aria-label="Company research">
                <h2 className="reviewCardTitle">Company research</h2>
                <p className="reviewMuted">
                  Website review was turned off. This draft uses saved company
                  research and your email instructions only.
                </p>
              </section>
            ) : evidence !== null && analysis !== null ? (
              <EvidencePanel evidence={evidence} analysis={analysis} />
            ) : null}
            {draft.websiteReviewEnabled !== false &&
            draft.content.format !== 'letter' ? (
              <WorkflowDashboard
                workflow={draft.content.workflow}
                dashboard={draft.content.dashboard}
              />
            ) : null}
          </div>
          <DraftWorkspace
            key={draft.updatedAt}
            companyId={companyId}
            draft={draft}
            evidenceText={evidenceText}
          />
        </div>
      )}
    </section>
  );
}
