import { Icon, StatusPill } from '../outreach/Common';
import { draftStateThemes } from '../campaigns/status';
import type { ReviewHeaderProps } from './types';

/** Company identity, draft status, and Run/Regenerate + Back actions. */
export function ReviewHeader({
  company,
  draftState,
  hasDraft,
  starting,
  onRun,
  onBack,
}: ReviewHeaderProps) {
  const running = draftState === 'running';
  return (
    <header className="reviewHeader">
      <div className="reviewHeaderText">
        <h1 className="reviewTitle">{company.name}</h1>
        <p className="reviewMuted">
          {company.domain} · {company.industry}
          {company.recipients.length > 0
            ? ` · ${company.recipients.length} recipient${company.recipients.length === 1 ? '' : 's'}`
            : ' · no recipients yet'}
        </p>
        <StatusPill tone={draftStateThemes[draftState].tone}>
          {draftStateThemes[draftState].label}
        </StatusPill>
      </div>
      <div className="reviewHeaderActions">
        {onBack !== undefined ? (
          <button
            type="button"
            className="reviewSecondaryButton"
            onClick={onBack}
          >
            <Icon name="arrow_back" size={16} />
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="reviewPrimaryButton"
          onClick={onRun}
          disabled={running || starting}
        >
          <Icon
            name={running || starting ? 'sync' : 'travel_explore'}
            size={16}
          />
          {running ? 'Running…' : hasDraft ? 'Regenerate' : 'Run pipeline'}
        </button>
      </div>
    </header>
  );
}
