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
  it('previews and saves edits without an approval step', async () => {
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
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /approv/i })).toBeNull();
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

  it('surfaces backend errors while saving', async () => {
    mocks.fail = 'Closing must include a conversation-starting question.';
    render(
      <DraftWorkspace companyId="acme.test" draft={draft!} evidenceText="" />,
    );
    await userEvent.type(screen.getByLabelText('Subject'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(mocks.calls[0]![0]).toBe('outreachRuns:saveDraftEdits');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Closing must include a conversation-starting question.',
    );
  });
  it('treats legacy approved drafts as ordinary editable drafts', () => {
    render(
      <DraftWorkspace
        companyId="acme.test"
        draft={{ ...draft!, status: 'approved' }}
        evidenceText=""
      />,
    );
    expect(screen.getByLabelText('Subject')).toBeEnabled();
    expect(screen.queryByRole('button', { name: /approv/i })).toBeNull();
  });
});
