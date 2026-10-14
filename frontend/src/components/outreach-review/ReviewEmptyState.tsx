import { Icon } from '../outreach/Common';
import type { ReviewEmptyStateProps } from './types';

/** Shown when no company has been chosen for review yet. */
export function ReviewEmptyState({ onBack }: ReviewEmptyStateProps) {
  return (
    <section className="reviewEmpty">
      <Icon name="rate_review" size={28} />
      <h1 className="reviewTitle">Outreach Review</h1>
      <p className="reviewMuted">
        Pick a company from the Outreach Pipeline to review its website evidence
        and draft email.
      </p>
      {onBack !== undefined ? (
        <button type="button" className="reviewPrimaryButton" onClick={onBack}>
          Go to Pipeline
        </button>
      ) : null}
    </section>
  );
}
