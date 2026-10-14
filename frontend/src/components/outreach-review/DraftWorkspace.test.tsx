import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { DraftWorkspace } from './DraftWorkspace';
import { reviewFixture } from './testReview';

const mocks = vi.hoisted(() => ({
  calls: [] as [string, unknown][],
  fail: null as string | null,
}));

vi.mock('convex/react', () => ({
  useMutation:
    (ref: FunctionReference<'mutation'>) => async (args: unknown) => {
      mocks.calls.push([getFunctionName(ref), args]);
      if (mocks.fail !== null)
        throw new Error(`Server Error\nUncaught Error: ${mocks.fail}\n at x`);
      return null;
    },
}));

beforeEach(() => {
  mocks.calls = [];
  mocks.fail = null;
});

const { draft } = reviewFixture();

describe('DraftWorkspace', () => {
  it('previews unsaved edits, warns on unsupported figures, and saves', async () => {
    render(
      <DraftWorkspace
        companyId="acme.test"
        draft={draft!}
        evidenceText="Open 24 hours."
      />,
    );
    const subject = screen.getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Faster replies, 40% more bookings');
    expect(screen.getByRole('note')).toHaveTextContent('40%');
    expect(
      screen.getByText(/Faster replies, 40% more bookings/, { selector: 'p' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(mocks.calls[0]).toEqual([
      'outreachRuns:saveDraftEdits',
      expect.objectContaining({
        companyId: 'acme.test',
        subject: 'Faster replies, 40% more bookings',
      }),
    ]);
  });

  it('approves and surfaces backend validation errors', async () => {
    mocks.fail = 'Closing must include a conversation-starting question.';
    render(
      <DraftWorkspace companyId="acme.test" draft={draft!} evidenceText="" />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve for sending' }),
    );
    expect(mocks.calls[0]).toEqual([
      'outreachRuns:approveDraft',
      { companyId: 'acme.test' },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Closing must include a conversation-starting question.',
    );
  });
});
