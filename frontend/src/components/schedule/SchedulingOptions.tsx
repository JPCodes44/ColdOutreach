import { Icon } from '../outreach/Common';
import { DeliveryOptionCard } from './DeliveryOptionCard';
import { ScheduleSelect } from './ScheduleSelect';
import { deliveryOptions, timeOptions, timezoneOptions } from './data';
import type { SchedulingOptionsProps } from './types';

/** Date, time, timezone, and delivery-method controls. */
export function SchedulingOptions({
  date,
  onDateChange,
  time,
  onTimeChange,
  timezone,
  onTimezoneChange,
  method,
  onMethodChange,
}: SchedulingOptionsProps) {
  return (
    <section className="scheduleCard">
      <div className="scheduleCardHeader">
        <Icon name="schedule" size={20} />
        <h2 className="scheduleCardTitle">Scheduling Options</h2>
      </div>
      <div className="scheduleCardBody">
        <label className="scheduleField">
          <span className="scheduleFieldLabel">Submission Date</span>
          <input
            className="scheduleInput"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
        <ScheduleSelect
          label="Time"
          value={time}
          options={timeOptions}
          onChange={onTimeChange}
        />
        <ScheduleSelect
          label="Timezone"
          value={timezone}
          options={timezoneOptions}
          onChange={onTimezoneChange}
        />
        <div className="scheduleField">
          <span className="scheduleFieldLabel">Delivery Method</span>
          <div
            className="scheduleDeliveryGroup"
            role="radiogroup"
            aria-label="Delivery Method"
          >
            {deliveryOptions.map((option) => (
              <DeliveryOptionCard
                key={option.id}
                option={option}
                selected={option.id === method}
                onSelect={onMethodChange}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
