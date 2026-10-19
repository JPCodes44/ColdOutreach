import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewHeader } from './ReviewHeader';
import { reviewFixture } from './testReview';

const { company } = reviewFixture();

describe('ReviewHeader', () => {
  it('offers Regenerate when a draft exists and wires Back', async () => {
    const onRun = vi.fn();
    const onBack = vi.fn();
    render(
      <ReviewHeader
        company={company}
        draftState="ready"
        hasDraft
        starting={false}
        onRun={onRun}
        onBack={onBack}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Acme Plumbing' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 recipient$/)).toBeInTheDocument();
    expect(screen.getByText('Draft ready')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Regenerate/ }));
    await userEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('disables running while a run is in progress', () => {
    render(
      <ReviewHeader
        company={company}
        draftState="running"
        hasDraft={false}
        starting={false}
        onRun={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Running/ })).toBeDisabled();
  });
});
