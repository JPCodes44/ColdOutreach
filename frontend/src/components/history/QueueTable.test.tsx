import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueueTable } from './QueueTable';
import { queueRow } from './fixtures';

describe('QueueTable', () => {
  it('filters rows by status group', async () => {
    render(
      <QueueTable
        rows={[
          queueRow({ id: 'a', company: 'Queued Co' }),
          queueRow({ id: 'b', company: 'Unsure Co', status: 'uncertain' }),
          queueRow({ id: 'c', company: 'Sent Co', status: 'sent' }),
        ]}
        onCancel={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Needs review' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Unsure Co')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Failed / blocked' }),
    );
    expect(screen.getByText('No sends match this filter.')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    render(
      <QueueTable rows={undefined} onCancel={vi.fn()} onResolve={vi.fn()} />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
