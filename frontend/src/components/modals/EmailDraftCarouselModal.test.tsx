import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailDraftCarouselModal } from './EmailDraftCarouselModal';
import type { EmailDraft } from './types';

const drafts: EmailDraft[] = [
  {
    id: 'a',
    to: 'a@x.com',
    subject: 'Alpha',
    body: ['Hi A'],
  },
  { id: 'b', to: 'b@x.com', subject: 'Beta', body: ['Hi B'] },
  { id: 'c', to: 'c@x.com', subject: 'Gamma', body: ['Hi C'] },
];

function renderModal(
  overrides: Partial<Parameters<typeof EmailDraftCarouselModal>[0]> = {},
) {
  const props = {
    drafts,
    activeIndex: 1,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    onDiscard: vi.fn(),
    onEdit: vi.fn(),
    onApprove: vi.fn(),
    ...overrides,
  };
  render(<EmailDraftCarouselModal {...props} />);
  return props;
}

describe('EmailDraftCarouselModal', () => {
  it('shows the active draft, position, and fires the approve action with its id', async () => {
    const { onApprove, onNext } = renderModal();
    expect(screen.getByText('Reviewing 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Looks good' }));
    expect(onApprove).toHaveBeenCalledWith('b');

    await userEvent.click(screen.getByRole('button', { name: 'Next draft' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('hides actions whose handlers are not provided', () => {
    renderModal({ onDiscard: undefined, onEdit: undefined });
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Looks good' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/résumé/i)).toBeNull();
  });

  it('disables Previous on the first draft', () => {
    renderModal({ activeIndex: 0 });
    expect(
      screen.getByRole('button', { name: 'Previous draft' }),
    ).toBeDisabled();
  });

  it('renders nothing when there are no drafts', () => {
    renderModal({ drafts: [], activeIndex: 0 });
    expect(screen.queryByText(/Reviewing/)).not.toBeInTheDocument();
  });
});
