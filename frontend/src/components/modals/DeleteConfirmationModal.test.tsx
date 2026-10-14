import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

describe('DeleteConfirmationModal', () => {
  it('shows the count and wires cancel/confirm', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmationModal
        count={3}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Delete 3 companies?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sent email history is kept/)).toBeInTheDocument();
    expect(screen.queryByText(/resume/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
