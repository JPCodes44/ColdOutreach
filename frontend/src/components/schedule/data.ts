import { zonedWallTimeToUtcMs } from '@emailstrat/common';
import type { DeliveryOption, SelectOption, TargetEntity } from './types';

export const timeOptions: SelectOption[] = [
  { value: 'now', label: 'Immediately' },
  { value: '09:15', label: '09:15 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '18:00', label: '06:00 PM' },
];

export const timezoneOptions: SelectOption[] = [
  { value: 'pst', label: 'US/Pacific (PST)' },
  { value: 'est', label: 'US/Eastern (EST)' },
  { value: 'utc', label: 'UTC' },
  { value: 'cet', label: 'Europe/Central (CET)' },
];

export const deliveryOptions: DeliveryOption[] = [
  {
    id: 'immediate',
    iconName: 'bolt',
    title: 'Immediate Send',
    description: 'Emails will be dispatched exactly at the scheduled time.',
  },
  {
    id: 'batch',
    iconName: 'layers',
    title: 'Batch Dispatch',
    description: 'Stagger delivery over a 2-hour window.',
  },
];

const TZ_TO_IANA: Record<string, string> = {
  pst: 'America/Los_Angeles',
  est: 'America/New_York',
  utc: 'UTC',
  cet: 'Europe/Berlin',
};

/** Convert a wall-clock date+time in the chosen timezone to a UTC timestamp (ms). */
export function computeScheduledAtMs(
  date: string,
  time: string,
  tzValue: string,
): number {
  if (time === 'now') return Date.now();
  return zonedWallTimeToUtcMs(date, time, TZ_TO_IANA[tzValue] ?? 'UTC');
}

/** Today as YYYY-MM-DD for the date input's default. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Label + chip class for a target entity's readiness/send state. */
export function targetStatus(entity: TargetEntity): {
  label: string;
  className: string;
} {
  if (entity.status === 'Sent')
    return { label: 'Sent', className: 'scheduleStatusSent' };
  if (entity.status === 'Sending')
    return { label: 'Scheduled', className: 'scheduleStatusScheduled' };
  if (entity.status === 'Needs Review')
    return { label: 'Needs review', className: 'scheduleStatusAttention' };
  if (entity.ready === false) {
    return {
      label:
        entity.notReadyReason ??
        (entity.contacts === 0 ? 'No recipients' : 'Draft not ready'),
      className: 'scheduleStatusAttention',
    };
  }
  if (entity.status === 'Failed')
    return { label: 'Failed', className: 'scheduleStatusAttention' };
  return { label: 'Ready', className: 'scheduleStatusNotScheduled' };
}
