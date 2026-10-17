import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BulkFooter,
  CompanyAvatar,
  CompanyCell,
  ConfidenceBadge,
  Results,
  ResultsHeader,
  ResultsRow,
  ResultsTable,
  TechBadge,
} from './Results';
import { companies, discoveryMatches } from './data';

describe('TechBadge', () => {
  it('renders the technology label', () => {
    render(<TechBadge label="React" />);
    expect(screen.getByText('React')).toBeInTheDocument();
  });
});

describe('ConfidenceBadge', () => {
  it('shows a check icon for a positive tone', () => {
    render(<ConfidenceBadge value={98} tone="positive" />);
    expect(screen.getByText(/98%/)).toBeInTheDocument();
    expect(screen.getByText('check_circle')).toBeInTheDocument();
  });

  it('shows a help icon for a neutral tone', () => {
    render(<ConfidenceBadge value={75} tone="neutral" />);
    expect(screen.getByText('help')).toBeInTheDocument();
  });
});

describe('CompanyAvatar', () => {
  it('renders the company initial', () => {
    render(<CompanyAvatar initial="A" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('CompanyCell', () => {
  it('renders the company name and domain', () => {
    render(<CompanyCell company={companies[0]!} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('acme.io')).toBeInTheDocument();
  });
});

function renderRow(selected: boolean, onToggle = vi.fn()) {
  return render(
    <ResultsRow
      company={companies[0]!}
      selected={selected}
      onToggle={onToggle}
    />,
  );
}

describe('ResultsRow', () => {
  it('shows the research description instead of legacy classifications', () => {
    render(
      <ResultsRow
        company={{
          ...companies[0]!,
          segment: 'Exclusively vegan',
          description: 'Processes oats and pulses into ingredients.',
        }}
        selected={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText('Exclusively vegan')).toBeNull();
    expect(
      screen.getByText('Processes oats and pulses into ingredients.'),
    ).toBeInTheDocument();
  });

  it('reflects selection state in its checkbox', () => {
    renderRow(true);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders meta, tech badges, and confidence', () => {
    renderRow(false);
    expect(screen.getByText('SaaS / Enterprise')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText(/98%/)).toBeInTheDocument();
  });

  it('toggles by company id', async () => {
    const onToggle = vi.fn();
    renderRow(false, onToggle);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('acme');
  });
});

describe('ResultsHeader', () => {
  it('renders the title and a disabled clear action with no selection', () => {
    render(<ResultsHeader selectedCount={0} onClearSelected={vi.fn()} />);
    expect(screen.getByText('Discovery Results')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Clear Results/ }),
    ).toBeDisabled();
  });

  it('fires the clear action when rows are selected', async () => {
    const onClearSelected = vi.fn();
    render(
      <ResultsHeader selectedCount={2} onClearSelected={onClearSelected} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Clear Results/ }),
    );
    expect(onClearSelected).toHaveBeenCalledTimes(1);
  });
});

describe('ResultsTable', () => {
  it('renders a column header and every company row', () => {
    render(
      <ResultsTable
        companies={companies}
        selectedIds={new Set()}
        allSelected={false}
        onToggleRow={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: 'Company' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Orbit Logistics')).toBeInTheDocument();
  });

  it('fires select-all from the header checkbox', async () => {
    const onToggleAll = vi.fn();
    render(
      <ResultsTable
        companies={companies}
        selectedIds={new Set()}
        allSelected={false}
        onToggleRow={vi.fn()}
        onToggleAll={onToggleAll}
      />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all companies' }),
    );
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });
});

describe('BulkFooter', () => {
  it('shows the selection count and wires export/import', async () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    render(
      <BulkFooter selectedCount={2} onExport={onExport} onImport={onImport} />,
    );
    expect(screen.getByText('2 companies selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await userEvent.click(
      screen.getByRole('button', { name: /Import to Pipeline/ }),
    );
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});

describe('Results', () => {
  it('composes header, table, and footer with the selection count', () => {
    render(
      <Results
        companies={companies}
        matches={discoveryMatches}
        selectedIds={new Set(['acme', 'nexus'])}
        onToggleRow={vi.fn()}
        onToggleAll={vi.fn()}
        onClearSelected={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText('Discovery Results')).toBeInTheDocument();
    expect(screen.getByText('Nexus Dynamics')).toBeInTheDocument();
    expect(screen.getByText('2 companies selected')).toBeInTheDocument();
  });
});
