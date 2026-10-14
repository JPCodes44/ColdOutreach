import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
}));

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
});
