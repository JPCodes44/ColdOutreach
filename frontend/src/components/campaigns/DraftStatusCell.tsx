import { StatusPill } from '../outreach/Common';
import { draftStateThemes, draftStatusLabel } from './status';
import type { DraftStatusCellProps } from './types';

/** Draft status, generation mode, and any failure reason. */
export function DraftStatusCell({ company }: DraftStatusCellProps) {
  const failed = company.draftState === 'failed' && company.lastError !== null;
  return (
    <span
      className="campaignStatusStack"
      title={failed ? (company.lastError ?? undefined) : undefined}
    >
      <StatusPill tone={draftStateThemes[company.draftState].tone}>
        {draftStatusLabel(company)}
      </StatusPill>
      {typeof company.websiteReviewEnabled === 'boolean' ? (
        <span className="campaignModeLabel">
          {company.websiteReviewEnabled
            ? 'Website review'
            : 'Company research only'}
        </span>
      ) : null}
      {failed ? (
        <span className="campaignStatusError">{company.lastError}</span>
      ) : null}
    </span>
  );
}
