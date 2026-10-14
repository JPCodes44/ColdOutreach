import { Icon } from '../outreach/Common';
import type { ScheduleHeaderProps } from './types';

/** Title row with Back, Cancel, and Schedule Outreach actions. */
export function ScheduleHeader({
  onBack,
  onSchedule,
  scheduling = false,
  canSchedule = true,
}: ScheduleHeaderProps) {
  return (
    <div className="scheduleHeader">
      <button className="scheduleBackLink" type="button" onClick={onBack}>
        <Icon name="arrow_back" size={16} />
        Back to Send
      </button>
      <div className="scheduleHeaderRow">
        <div className="scheduleHeaderText">
          <h1 className="scheduleTitle">Schedule Submission</h1>
          <p className="scheduleSubtitle">
            Choose when the approved emails are sent through Gmail.
          </p>
        </div>
        <div className="scheduleHeaderActions">
          <button
            className="scheduleSecondaryButton"
            type="button"
            onClick={onBack}
          >
            Cancel
          </button>
          <button
            className="schedulePrimaryButton"
            type="button"
            onClick={onSchedule}
            disabled={!canSchedule || scheduling}
          >
            <Icon name="send" size={18} />
            {scheduling ? 'Scheduling...' : 'Schedule Outreach'}
          </button>
        </div>
      </div>
    </div>
  );
}
