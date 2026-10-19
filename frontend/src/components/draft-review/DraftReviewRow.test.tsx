import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftReviewRow } from './DraftReviewRow';

const base = {
  companyId: 'acme.test',
  company: 'Acme',
  email1: 'owner@acme.test',
  email2: '',
  email3: '',
  status: 'Not Sent',
  draftState: 'approved' as const,
  draftLabel: 'Approved',
};

describe('DraftReviewRow', () => {
  it('renders recipients with dashes for empty slots and toggles selection', async () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    render(
      <DraftReviewRow
        row={base}
        selected={false}
        active={false}
        onSelect={onSelect}
        onToggleSelected={onToggle}
      />,
    );
    expect(screen.getAllByText('—')).toHaveLength(2);
    await userEvent.click(screen.getByLabelText('Select Acme'));
    expect(onToggle).toHaveBeenCalledWith('acme.test');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(['Sending', 'Sent', 'Needs Review'])(
    'disables %s companies even when the draft is ready',
    (status) => {
      render(
        <DraftReviewRow
          row={{ ...base, status }}
          selected={false}
          active={false}
          onSelect={vi.fn()}
          onToggleSelected={vi.fn()}
        />,
      );
      expect(screen.getByLabelText('Select Acme')).toBeDisabled();
      expect(
        screen.queryByText('Generate a draft in Pipeline first'),
      ).toBeNull();
    },
  );

  it('disables selection when a generated draft is missing', () => {
    render(
      <DraftReviewRow
        row={{ ...base, draftState: 'legacy', draftLabel: 'Legacy Draft' }}
        selected={false}
        active
        onSelect={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Select Acme')).toBeDisabled();
    expect(screen.getByText('Legacy Draft')).toBeInTheDocument();
  });
});
