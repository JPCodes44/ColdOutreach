import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckInbox } from './CheckInbox';
import { describeCheck } from './inboxCheck';

describe('CheckInbox', () => {
  it('summarizes counts with correct plurals', () => {
    expect(describeCheck({ bounced: 1, replied: 0 })).toBe(
      'Checked: 1 new bounce, 0 new replies',
    );
    expect(describeCheck({ bounced: 2, replied: 1 })).toBe(
      'Checked: 2 new bounces, 1 new reply',
    );
  });

  it('runs the check, shows busy state, then the result', async () => {
    let finish: (value: { bounced: number; replied: number }) => void = () =>
      undefined;
    const onCheck = vi.fn(
      () =>
        new Promise<{ bounced: number; replied: number }>((resolve) => {
          finish = resolve;
        }),
    );
    render(<CheckInbox onCheck={onCheck} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Check inbox now' }),
    );
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    finish({ bounced: 1, replied: 0 });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Checked: 1 new bounce, 0 new replies',
    );
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('shows an error when the check fails', async () => {
    const onCheck = vi.fn().mockRejectedValue(new Error('IMAP unavailable'));
    render(<CheckInbox onCheck={onCheck} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Check inbox now' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'IMAP unavailable',
    );
  });
});
