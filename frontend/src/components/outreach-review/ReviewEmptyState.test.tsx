import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewEmptyState } from './ReviewEmptyState';

describe('ReviewEmptyState', () => {
  it('points the user back to the pipeline', async () => {
    const onBack = vi.fn();
    render(<ReviewEmptyState onBack={onBack} />);
    expect(
      screen.getByText(/Pick a company from the Outreach Pipeline/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Go to Pipeline' }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
