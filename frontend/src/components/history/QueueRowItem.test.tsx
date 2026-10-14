import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueueRowItem } from './QueueRowItem';
import { StatusChip } from './StatusChip';
import { queueRow } from './fixtures';

describe('QueueRowItem', () => {
  it('shows redirects, test badges, and failure reasons', () => {
    render(
      <ul>
        <QueueRowItem
          row={queueRow({
            status: 'failed',
            actualTo: 'me@inbox.test',
            isTest: true,
            error: 'EAUTH 535',
          })}
          onCancel={vi.fn()}
          onResolve={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText(/redirected to me@inbox.test/)).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('EAUTH 535')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});

describe('StatusChip', () => {
  it('labels stuck sends as needing review', () => {
    render(<StatusChip status="sending" stale />);
    expect(screen.getByText('Needs review')).toHaveClass(
      'historyChip-uncertain',
    );
  });
});
