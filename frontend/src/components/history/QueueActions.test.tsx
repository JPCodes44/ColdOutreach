import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueueActions } from './QueueActions';
import { queueRow } from './fixtures';

describe('QueueActions', () => {
  it('cancels a queued send', async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(
      <QueueActions row={queueRow()} onCancel={onCancel} onResolve={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledWith('q1');
  });

  it('requires confirmation before resolving an uncertain send', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    render(
      <QueueActions
        row={queueRow({ status: 'uncertain' })}
        onCancel={vi.fn()}
        onResolve={onResolve}
      />,
    );
    expect(
      screen.getByText('Check your Gmail Sent folder first.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'It was not sent' }),
    );
    expect(onResolve).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onResolve).toHaveBeenCalledWith('q1', 'not-sent');
  });

  it('offers resolution for stuck sends and shows backend errors', async () => {
    const onResolve = vi
      .fn()
      .mockRejectedValue(
        new Error('Only uncertain or stuck sends can be resolved.'),
      );
    render(
      <QueueActions
        row={queueRow({ status: 'sending', stale: true })}
        onCancel={vi.fn()}
        onResolve={onResolve}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'It was sent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only uncertain or stuck sends',
    );
  });

  it('offers no actions for sent or in-flight rows', () => {
    const { container } = render(
      <QueueActions
        row={queueRow({ status: 'sending' })}
        onCancel={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(container.querySelector('button')).toBeNull();
  });
});
