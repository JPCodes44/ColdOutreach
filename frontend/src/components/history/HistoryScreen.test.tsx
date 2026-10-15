import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryScreen } from './HistoryScreen';
import { queueRow, sentRow } from './fixtures';

vi.mock('convex/react', () => ({
  useQuery: (ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = String(
      (ref as Record<symbol, unknown>)[Symbol.for('functionName')] ?? '',
    );
    if (name === 'send:listQueue') return [queueRow()];
    if (name === 'send:listSentEmails')
      return [sentRow({ id: 's2', companyName: 'Sent Co' })];
    return undefined;
  },
  useMutation: () => vi.fn(),
  useAction: () => checkNow,
}));

const checkNow = vi.fn().mockResolvedValue({ bounced: 1, replied: 0 });

describe('HistoryScreen', () => {
  it('shows queue attempts and the sent record', () => {
    render(<HistoryScreen />);
    expect(
      screen.getByRole('heading', { name: 'Send History' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Queue & attempts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sent emails' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sent Co')).toBeInTheDocument();
  });

  it('checks the inbox through the delivery action', async () => {
    render(<HistoryScreen />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Check inbox now' }),
    );
    expect(checkNow).toHaveBeenCalledWith({});
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Checked: 1 new bounce, 0 new replies',
    );
  });
});
