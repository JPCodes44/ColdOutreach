import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftActions } from './DraftActions';

describe('DraftActions', () => {
  it('offers only saving and disables it when unchanged or busy', () => {
    const { rerender } = render(
      <DraftActions dirty={false} busy={false} onSave={vi.fn()} />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save edits' })).toBeDisabled();
    rerender(<DraftActions dirty busy onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save edits' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /approv/i })).toBeNull();
  });
  it('saves changed fields without approval', async () => {
    const onSave = vi.fn();
    render(<DraftActions dirty busy={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
