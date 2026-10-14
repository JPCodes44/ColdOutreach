import { StatusPill } from '../outreach/Common';
import { draftStateThemes, draftStatusLabel } from './status';
import type { DraftStatusCellProps } from './types';

/** Draft status pill, with the failure reason shown inline and on hover. */
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
      {failed ? (
        <span className="campaignStatusError">{company.lastError}</span>
      ) : null}
    </span>
  );
}
