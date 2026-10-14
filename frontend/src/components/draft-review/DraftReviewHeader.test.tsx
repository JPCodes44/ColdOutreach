import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftReviewHeader } from './DraftReviewHeader';

describe('DraftReviewHeader', () => {
  it('reports search and status changes', async () => {
    const onQueryChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <DraftReviewHeader
        query=""
        onQueryChange={onQueryChange}
        status="all"
        onStatusChange={onStatusChange}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText('Search company or email'),
      'a',
    );
    expect(onQueryChange).toHaveBeenCalledWith('a');
    await userEvent.selectOptions(
      screen.getByLabelText('Filter by status'),
      'Needs Review',
    );
    expect(onStatusChange).toHaveBeenCalledWith('Needs Review');
  });
});
