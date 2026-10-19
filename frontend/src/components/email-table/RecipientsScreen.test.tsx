import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipientsScreen } from './RecipientsScreen';

const mocks = vi.hoisted(() => ({
  rows: undefined as unknown,
  deleteCompanies: vi.fn(),
  setEmailRow: vi.fn(),
  fillEmails: vi.fn(),
}));

// The spreadsheet itself is third-party; stub it so tests exercise our logic quickly.
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: ({
    id,
    data,
    height,
  }: {
    id: string;
    data: unknown;
    height: string;
  }) => (
    <div id={id} data-grid={JSON.stringify(data)} data-grid-height={height} />
  ),
  HotColumn: () => null,
}));
vi.mock('handsontable/registry', () => ({
  registerAllModules: () => undefined,
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.rows,
  useAction: () => mocks.fillEmails,
  useMutation: (ref: unknown) =>
    String((ref as Record<symbol, unknown>)[Symbol.for('functionName')]) ===
    'companies:deleteCompanies'
      ? mocks.deleteCompanies
      : mocks.setEmailRow,
}));

function row(companyId: string, draftState: string, status: string) {
  return {
    companyId,
    company: companyId,
    email1: `a@${companyId}`,
    email2: '',
    email3: '',
    status,
    draftState,
  };
}

describe('RecipientsScreen', () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.deleteCompanies.mockReset();
    mocks.fillEmails.mockReset();
  });

  it('renders the recipients table shell and filters', () => {
    const { container } = render(<RecipientsScreen />);
    expect(
      screen.getByRole('heading', { name: 'Recipients' }),
    ).toBeInTheDocument();
    expect(container.querySelector('#email-hot-table')).toHaveAttribute(
      'data-grid-height',
      'auto',
    );
    expect(screen.getByText('0 companies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const name of ['Sent', 'Failed', 'Not sent', 'Not drafted']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(
      screen.getByRole('button', { name: 'Delete filtered' }),
    ).toBeDisabled();
  });

  it('keeps the general system prompt above Apollo and independent of company filters', async () => {
    mocks.rows = [
      row('a.test', 'ready', 'Not Sent'),
      row('b.test', 'ready', 'Sent'),
    ];
    render(<RecipientsScreen />);
    const info = screen.getByRole('region', {
      name: 'Free email research with Codex',
    });
    const fill = screen.getByRole('button', { name: 'Fill missing emails' });
    expect(
      info.compareDocumentPosition(fill) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(screen.getByText('View Codex prompt'));
    const prompt = screen.getByLabelText(
      'Codex research prompt',
    ) as HTMLTextAreaElement;
    const before = prompt.value;
    expect(before).not.toContain('a.test');
    expect(before).not.toContain('b.test');
    await userEvent.click(screen.getByRole('button', { name: 'Not sent' }));
    expect(prompt.value).toBe(before);
  });

  it('fills only missing emails on filtered companies with editable specialist roles', async () => {
    mocks.rows = [
      row('a.test', 'ready', 'Not Sent'),
      {
        ...row('full.test', 'ready', 'Not Sent'),
        email2: 'b@full.test',
        email3: 'c@full.test',
      },
    ];
    mocks.fillEmails.mockResolvedValue({
      filled: 2,
      message: 'Added 2 verified work emails.',
    });
    render(<RecipientsScreen />);
    const roles = screen.getByRole('textbox', {
      name: 'Specialist job titles',
    });
    await userEvent.clear(roles);
    await userEvent.type(roles, 'process engineer, research scientist');
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill missing emails' }),
    );
    expect(mocks.fillEmails).toHaveBeenCalledTimes(1);
    expect(mocks.fillEmails).toHaveBeenCalledWith({
      companyId: 'a.test',
      targetTitles: ['process engineer', 'research scientist'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added 2 verified work emails.',
    );
  });

  it('shows setup errors when Apollo is not configured', async () => {
    mocks.rows = [row('a.test', 'ready', 'Not Sent')];
    mocks.fillEmails.mockRejectedValue(
      new Error('Set APOLLO_API_KEY in the Convex server environment.'),
    );
    render(<RecipientsScreen />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill missing emails' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Set APOLLO_API_KEY',
    );
  });

  it('refreshes emails when enrichment finishes for the same company', () => {
    mocks.rows = [row('a.test', 'ready', 'Not Sent')];
    const { container, rerender } = render(<RecipientsScreen />);
    mocks.rows = [
      {
        ...row('a.test', 'ready', 'Not Sent'),
        email2: 'boss@a.test',
        enrichment: {
          token: 'lookup',
          status: 'done',
          message: 'Added 1 verified work email.',
        },
      },
    ];
    rerender(<RecipientsScreen />);
    expect(container.querySelector('#email-hot-table')).toHaveAttribute(
      'data-grid',
      expect.stringContaining('boss@a.test'),
    );
  });

  it('filters undrafted rows by draft state', async () => {
    mocks.rows = [
      row('a.test', 'approved', 'Not Sent'),
      row('b.test', 'legacy', 'Legacy Draft'),
      row('c.test', 'failed', 'Generation Failed'),
    ];
    render(<RecipientsScreen />);
    expect(screen.getByText('3 companies')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Not drafted' }));
    expect(screen.getByText('2 companies')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Not sent' }));
    expect(screen.getByText('1 companies')).toBeInTheDocument();
  });

  it('shows why a delete was refused instead of failing silently', async () => {
    mocks.rows = [row('b.test', 'none', 'Not Drafted')];
    mocks.deleteCompanies.mockRejectedValue(
      new Error(
        '[CONVEX M(companies:deleteCompanies)] Uncaught Error: b.test has sends queued, in flight, or awaiting review. Cancel or resolve them first.\n  at x',
      ),
    );
    render(<RecipientsScreen />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete filtered' }),
    );
    const dialog = screen.getByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );
    expect(mocks.deleteCompanies).toHaveBeenCalledWith({
      externalIds: ['b.test'],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'b.test has sends queued, in flight, or awaiting review. Cancel or resolve them first.',
    );
  });
});
