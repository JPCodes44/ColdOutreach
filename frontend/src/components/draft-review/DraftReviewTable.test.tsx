import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftReviewTable } from './DraftReviewTable';

describe('DraftReviewTable', () => {
  it('shows an empty state and a Draft column', () => {
    render(
      <DraftReviewTable
        loading={false}
        rows={[]}
        selectedIds={new Set()}
        allSelected={false}
        onSelect={vi.fn()}
        onToggleSelected={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    expect(
      screen.getByText('No companies with recipients yet.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Draft' }),
    ).toBeInTheDocument();
  });
});
