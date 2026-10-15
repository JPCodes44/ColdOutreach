import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryChip } from './DeliveryChip';
import { sentRow } from './fixtures';

describe('DeliveryChip', () => {
  it('shows a bounce with its reason', () => {
    render(
      <DeliveryChip
        row={sentRow({
          bouncedAt: '2026-10-14T13:00:00.000Z',
          bounceDetail: '550 no such user',
          repliedAt: '2026-10-14T14:00:00.000Z',
        })}
      />,
    );
    expect(screen.getByText('Bounced')).toHaveAttribute(
      'title',
      '550 no such user',
    );
  });

  it('shows a reply', () => {
    render(
      <DeliveryChip row={sentRow({ repliedAt: '2026-10-14T14:00:00.000Z' })} />,
    );
    expect(screen.getByText('Replied')).toHaveClass('historyChip-replied');
  });

  it('falls back to Gmail acceptance', () => {
    render(<DeliveryChip row={sentRow()} />);
    expect(screen.getByText('Accepted')).toHaveClass('historyChip-sent');
  });
});
