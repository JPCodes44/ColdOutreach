import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftActions } from './DraftActions';
import type { DraftActionsProps } from './types';

function renderActions(overrides: Partial<DraftActionsProps> = {}) {
  render(
    <DraftActions
      approved={false}
      dirty={false}
      busy={false}
      ready
      onSave={vi.fn()}
      onApprove={vi.fn()}
      onUnapprove={vi.fn()}
      {...overrides}
    />,
  );
  return screen.getByRole('button', { name: 'Approve for sending' });
}

describe('DraftActions', () => {
  it('explains why approval is disabled', () => {
    expect(renderActions({ dirty: true })).toHaveAttribute(
      'title',
      'Save edits before approving',
    );
  });

  it('disables approval until flagged items are resolved', () => {
    const approve = renderActions({ ready: false });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute(
      'title',
      'Resolve the flagged items before approving',
    );
  });
});
