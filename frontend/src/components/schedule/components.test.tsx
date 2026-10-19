import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryOptionCard } from './DeliveryOptionCard';
import { DispatchSummaryPanel } from './DispatchSummaryPanel';
import { ScheduleHeader } from './ScheduleHeader';
import { ScheduleSelect } from './ScheduleSelect';
import { SchedulingOptions } from './SchedulingOptions';
import { TargetEntities } from './TargetEntities';
import { TargetEntityRow } from './TargetEntityRow';
import { deliveryOptions, targetStatus, timeOptions } from './data';

const entity = {
  id: 'acme',
  name: 'Acme Corp',
  initial: 'A',
  segment: 'Dental',
  contacts: 2,
  status: 'Sending',
  ready: true,
};

describe('schedule components', () => {
  it('ScheduleHeader disables scheduling when not allowed', () => {
    render(<ScheduleHeader canSchedule={false} />);
    expect(
      screen.getByRole('button', { name: /Schedule Outreach/ }),
    ).toBeDisabled();
  });

  it('DeliveryOptionCard selects its method', async () => {
    const onSelect = vi.fn();
    render(
      <DeliveryOptionCard
        option={deliveryOptions[1]!}
        selected={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /Batch Dispatch/ }),
    );
    expect(onSelect).toHaveBeenCalledWith('batch');
  });

  it('ScheduleSelect lists options', () => {
    render(
      <ScheduleSelect
        label="Time"
        value="now"
        options={timeOptions}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('option', { name: 'Immediately' })).toHaveValue(
      'now',
    );
  });

  it('SchedulingOptions switches delivery method', async () => {
    const onMethodChange = vi.fn();
    render(
      <SchedulingOptions
        date="2026-10-14"
        onDateChange={vi.fn()}
        time="now"
        onTimeChange={vi.fn()}
        timezone="utc"
        onTimezoneChange={vi.fn()}
        method="immediate"
        onMethodChange={onMethodChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /Batch Dispatch/ }),
    );
    expect(onMethodChange).toHaveBeenCalledWith('batch');
  });

  it('TargetEntities lists entities with contact counts', () => {
    render(
      <TargetEntities
        entities={[entity, { ...entity, id: 'b', name: 'Beta', contacts: 1 }]}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Target Entities' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dental • 2 Contacts')).toBeInTheDocument();
    expect(screen.getByText('Dental • 1 Contact')).toBeInTheDocument();
  });

  it('TargetEntityRow shows readiness chips', () => {
    render(<TargetEntityRow entity={entity} selected={false} />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('targetStatus flags unapproved and recipient-less companies', () => {
    expect(
      targetStatus({ ...entity, status: 'Not Sent', ready: false }).label,
    ).toBe('Draft not ready');
    expect(
      targetStatus({ ...entity, status: 'Not Sent', ready: false, contacts: 0 })
        .label,
    ).toBe('No recipients');
    expect(targetStatus({ ...entity, status: 'Not Sent' }).label).toBe('Ready');
  });

  it('DispatchSummaryPanel renders counters', () => {
    render(
      <DispatchSummaryPanel
        summary={{ totalCompanies: 3, readyDrafts: 3, totalEmailsQueued: 6 }}
      />,
    );
    expect(screen.getByText('Emails to Schedule')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
