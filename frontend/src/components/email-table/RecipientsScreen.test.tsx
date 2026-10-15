import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipientsScreen } from './RecipientsScreen';

const mocks = vi.hoisted(() => ({
  rows: undefined as unknown,
  deleteCompanies: vi.fn(),
  setEmailRow: vi.fn(),
}));

// The spreadsheet itself is third-party; stub it so tests exercise our logic quickly.
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: ({ id }: { id: string }) => <div id={id} />,
  HotColumn: () => null,
}));
vi.mock('handsontable/registry', () => ({
  registerAllModules: () => undefined,
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.rows,
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
  });

  it('renders the recipients table shell and filters', () => {
    const { container } = render(<RecipientsScreen />);
    expect(
      screen.getByRole('heading', { name: 'Recipients' }),
    ).toBeInTheDocument();
    expect(container.querySelector('#email-hot-table')).toBeInTheDocument();
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
