import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useSetSelection } from '../shared/useSetSelection';
import { getScheduleSummaryQuery, purgeSettledCompaniesMutation } from './api';
import {
  computeScheduledAtMs,
  timeOptions,
  timezoneOptions,
  todayIso,
} from './data';
import { DispatchSummaryPanel } from './DispatchSummaryPanel';
import { ScheduleHeader } from './ScheduleHeader';
import { SchedulingOptions } from './SchedulingOptions';
import { TargetEntities } from './TargetEntities';
import { useScheduleActions } from './useScheduleActions';
import type { DeliveryMethod, ScheduleSubmissionScreenProps } from './types';

/** Schedule approved outreach snapshots for Gmail delivery. */
export function ScheduleSubmissionScreen({
  companyIds = [],
  onBack,
}: ScheduleSubmissionScreenProps) {
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(timeOptions[0]!.value);
  const [timezone, setTimezone] = useState(timezoneOptions[0]!.value);
  const [method, setMethod] = useState<DeliveryMethod>('immediate');
  const selection = useSetSelection<string>();
  const actions = useScheduleActions();
  const summary = useQuery(
    getScheduleSummaryQuery,
    companyIds.length > 0 ? { companyIds } : 'skip',
  );
  const purgeSettled = useMutation(purgeSettledCompaniesMutation);

  // Clean up settled (fully sent) companies when the user leaves this page.
  const companyIdsRef = useRef(companyIds);
  companyIdsRef.current = companyIds;
  useEffect(
    () => () => {
      const ids = companyIdsRef.current;
      if (ids.length > 0) void purgeSettled({ companyIds: ids });
    },
    [purgeSettled],
  );

  const entities = summary?.entities ?? [];
  const allReady =
    entities.length > 0 && entities.every((entity) => entity.ready === true);
  const canSchedule =
    summary !== undefined && summary.approvedDrafts > 0 && allReady;

  return (
    <section className="scheduleScreen">
      <ScheduleHeader
        onBack={onBack}
        onSchedule={() =>
          void actions.schedule(
            companyIds,
            computeScheduledAtMs(date, time, timezone),
            method,
          )
        }
        scheduling={actions.scheduling}
        canSchedule={canSchedule}
      />
      {summary !== undefined && entities.length > 0 && !allReady ? (
        <div className="scheduleNotice">
          Some selected companies are not ready (draft not approved or no
          recipients). Approve their drafts in Review or go back and deselect
          them.
        </div>
      ) : null}
      {actions.notice !== null ? (
        <div className="scheduleNotice">{actions.notice}</div>
      ) : null}
      <div className="scheduleLayout">
        <div className="scheduleMain">
          <SchedulingOptions
            date={date}
            onDateChange={setDate}
            time={time}
            onTimeChange={setTime}
            timezone={timezone}
            onTimezoneChange={setTimezone}
            method={method}
            onMethodChange={setMethod}
          />
          <TargetEntities
            entities={entities}
            selectedIds={selection.selectedIds}
            onToggleSelected={selection.toggleSelected}
            onToggleAll={() =>
              selection.toggleAll(
                entities.map((entity) => entity.id),
                entities.length > 0 &&
                  entities.every((e) => selection.selectedIds.has(e.id)),
              )
            }
            onUnschedule={async () => {
              if (await actions.unschedule([...selection.selectedIds]))
                selection.clearSelected();
            }}
            unscheduling={actions.unscheduling}
            canUnschedule={selection.selectedIds.size > 0}
          />
        </div>
        <DispatchSummaryPanel
          summary={{
            totalCompanies: summary?.totalCompanies ?? 0,
            approvedDrafts: summary?.approvedDrafts ?? 0,
            totalEmailsQueued: summary?.totalEmailsQueued ?? 0,
          }}
        />
      </div>
    </section>
  );
}
