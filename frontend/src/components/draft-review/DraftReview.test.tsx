import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftReviewScreen } from './DraftReview';
import type { CompanyEmailRow } from './types';

const mocks = vi.hoisted(() => ({ rows: undefined as unknown }));

vi.mock('convex/react', () => ({
  useQuery: (ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = String(
      (ref as Record<symbol, unknown>)[Symbol.for('functionName')] ?? '',
    );
    if (name === 'emails:listCompaniesWithEmails') return mocks.rows;
    if (name === 'emails:getCompanyEmailDrafts') {
      return [
        {
          id: 'd1',
          to: 'owner@acme.test',
          subject: 'Idea for Acme',
          body: ['Hi Acme team,'],
          html: '<p></p>',
          approved: true,
        },
      ];
    }
    return undefined;
  },
}));

function row(overrides: Partial<CompanyEmailRow>): CompanyEmailRow {
  return {
    companyId: 'acme.test',
    company: 'Acme',
    email1: 'owner@acme.test',
    email2: '',
    email3: '',
    status: 'Not Sent',
    draftState: 'approved',
    draftLabel: 'Approved',
    ...overrides,
  };
}

describe('DraftReviewScreen', () => {
  beforeEach(() => {
    mocks.rows = [
      row({}),
      row({
        companyId: 'beta.test',
        company: 'Beta',
        email1: 'hi@beta.test',
        draftState: 'ready',
        draftLabel: 'Needs Approval',
      }),
    ];
  });

  it('shows loading until rows arrive', () => {
    mocks.rows = undefined;
    render(<DraftReviewScreen />);
    expect(
      screen.getByRole('heading', { name: 'Choose Companies to Send' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('only lets approved drafts be selected and sent', async () => {
    const onContinue = vi.fn();
    render(<DraftReviewScreen onContinue={onContinue} />);
    expect(screen.getByLabelText('Select Beta')).toBeDisabled();
    expect(
      screen.getByText('Approve the draft in Review first'),
    ).toBeInTheDocument();
    const continueButton = screen.getByRole('button', {
      name: /Continue to Schedule/,
    });
    expect(continueButton).toBeDisabled();
    await userEvent.click(
      screen.getByLabelText('Select all approved companies'),
    );
    await userEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledWith(['acme.test']);
  });

  it('opens the per-recipient preview without résumé attachments', async () => {
    render(<DraftReviewScreen />);
    await userEvent.click(screen.getByText('Acme'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Idea for Acme')).toBeInTheDocument();
    expect(within(dialog).queryByText(/resume/i)).toBeNull();
  });

  it('filters by search text', async () => {
    render(<DraftReviewScreen />);
    await userEvent.type(
      screen.getByPlaceholderText('Search company or email'),
      'beta',
    );
    expect(screen.queryByText('Acme')).toBeNull();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});
