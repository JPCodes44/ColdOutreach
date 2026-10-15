import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentTable } from './SentTable';
import { sentRow } from './fixtures';

describe('SentTable', () => {
  it('explains acceptance semantics and opens an email', async () => {
    const onOpen = vi.fn();
    render(
      <SentTable
        rows={[
          sentRow({
            redirected: true,
            actualTo: 'me@inbox.test',
            acceptance: 'manually-confirmed',
          }),
        ]}
        onOpen={onOpen}
        onCheckInbox={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/does not prove inbox delivery/),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmed manually')).toBeInTheDocument();
    expect(screen.getByText(/redirected to me@inbox.test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Acme/ }));
    expect(onOpen).toHaveBeenCalledWith('s1');
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText(/every 30 minutes/)).toBeInTheDocument();
  });

  it('marks bounced and replied emails and offers an inbox check', async () => {
    const onCheckInbox = vi.fn().mockResolvedValue({ bounced: 0, replied: 1 });
    render(
      <SentTable
        rows={[
          sentRow({ bouncedAt: '2026-10-14T13:00:00.000Z' }),
          sentRow({ id: 's2', repliedAt: '2026-10-14T14:00:00.000Z' }),
        ]}
        onOpen={vi.fn()}
        onCheckInbox={onCheckInbox}
      />,
    );
    expect(screen.getByText('Bounced')).toBeInTheDocument();
    expect(screen.getByText('Replied')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Check inbox now' }),
    );
    expect(onCheckInbox).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Checked: 0 new bounces, 1 new reply',
    );
  });

  it('shows an empty state', () => {
    render(<SentTable rows={[]} onOpen={vi.fn()} onCheckInbox={vi.fn()} />);
    expect(screen.getByText('No emails sent yet.')).toBeInTheDocument();
  });
});
