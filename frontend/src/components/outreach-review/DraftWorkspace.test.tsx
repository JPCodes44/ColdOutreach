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
    expect(screen.getByRole('group')).toHaveTextContent('40%');
    expect(screen.getByRole('group')).toHaveTextContent('more bookings');
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
      { companyId: 'acme.test', acknowledgedClaims: [] },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Closing must include a conversation-starting question.',
    );
  });

  it('sends acknowledged claims with approval once each is confirmed', async () => {
    render(
      <DraftWorkspace
        companyId="acme.test"
        draft={{
          ...draft!,
          content: {
            ...draft!.content,
            opening: 'Hi,\n\nThis will boost your bookings by 30%.',
          },
        }}
        evidenceText=""
      />,
    );
    const approve = screen.getByRole('button', { name: 'Approve for sending' });
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/30%/));
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/boost your bookings/));
    await userEvent.click(approve);
    expect(mocks.calls[0]).toEqual([
      'outreachRuns:approveDraft',
      {
        companyId: 'acme.test',
        acknowledgedClaims: ['boost your bookings', '30%'],
      },
    ]);
  });

  it('blocks approval when the signature is empty', () => {
    render(
      <DraftWorkspace
        companyId="acme.test"
        draft={{ ...draft!, content: { ...draft!.content, signature: '' } }}
        evidenceText=""
      />,
    );
    expect(screen.getByText(/Add a signature before approving/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Approve for sending' }),
    ).toBeDisabled();
  });
});
