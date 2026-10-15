import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimReview } from './ClaimReview';

describe('ClaimReview', () => {
  it('renders nothing when there is nothing to resolve', () => {
    const { container } = render(
      <ClaimReview
        claims={[]}
        blockers={[]}
        acknowledged={[]}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists blockers and lets each claim be confirmed or unconfirmed', async () => {
    const onAcknowledge = vi.fn();
    render(
      <ClaimReview
        claims={['30%', 'guaranteed']}
        blockers={['Add a signature before approving.']}
        acknowledged={['guaranteed']}
        onAcknowledge={onAcknowledge}
      />,
    );
    expect(screen.getByText('Add a signature before approving.')).toBeVisible();
    expect(screen.getByLabelText(/guaranteed/)).toBeChecked();
    await userEvent.click(screen.getByLabelText(/30%/));
    expect(onAcknowledge).toHaveBeenCalledWith('30%', true);
    await userEvent.click(screen.getByLabelText(/guaranteed/));
    expect(onAcknowledge).toHaveBeenCalledWith('guaranteed', false);
  });
});
