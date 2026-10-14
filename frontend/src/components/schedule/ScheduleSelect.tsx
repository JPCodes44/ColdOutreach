import { Icon } from '../outreach/Common';
import type { ScheduleSelectProps } from './types';

/** Labeled select with the shared chevron styling. */
export function ScheduleSelect({
  label,
  value,
  options,
  onChange,
}: ScheduleSelectProps) {
  return (
    <label className="scheduleField">
      <span className="scheduleFieldLabel">{label}</span>
      <div className="scheduleSelectWrap">
        <select
          className="scheduleSelect"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="scheduleSelectIcon">
          <Icon name="expand_more" size={20} />
        </span>
      </div>
    </label>
  );
}
