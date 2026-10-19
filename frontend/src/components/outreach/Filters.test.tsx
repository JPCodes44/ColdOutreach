import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ActiveFilters,
  FilterActions,
  FilterChip,
  FilterCompanyLimitInput,
  FilterConsole,
  FilterField,
  FilterSearch,
  FilterSelect,
  FilterTechInput,
} from './Filters';
import type { FilterConsoleProps } from './types';

describe('FilterField', () => {
  it('renders its label and child control', () => {
    render(
      <FilterField label="Industry">
        <input aria-label="industry-input" />
      </FilterField>,
    );
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByLabelText('industry-input')).toBeInTheDocument();
  });
});

describe('FilterChip', () => {
  it('renders the label and removes on click', async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Tech: React" onRemove={onRemove} />);
    expect(screen.getByText('Tech: React')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove filter Tech: React' }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('FilterSearch', () => {
  it('reports typed input', async () => {
    const onChange = vi.fn();
    render(<FilterSearch value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('FilterSelect', () => {
  const options = [
    { value: 'all', label: 'All Industries' },
    { value: 'finance', label: 'Financial Services' },
  ];

  it('renders options and reports the chosen value', async () => {
    const onChange = vi.fn();
    render(
      <FilterSelect
        label="Industry"
        options={options}
        value="all"
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Industry'), 'finance');
    expect(onChange).toHaveBeenCalledWith('finance');
  });
});

describe('FilterTechInput', () => {
  it('renders under a Tech Stack label and reports input', async () => {
    const onChange = vi.fn();
    render(<FilterTechInput value="" onChange={onChange} />);
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'R');
    expect(onChange).toHaveBeenCalledWith('R');
  });
});

describe('FilterCompanyLimitInput', () => {
  it('renders under a Companies label and reports numeric input', async () => {
    const onChange = vi.fn();
    render(<FilterCompanyLimitInput value="" onChange={onChange} />);
    expect(screen.getByText('Companies')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton'), '2');
    expect(onChange).toHaveBeenCalledWith('2');
  });
});

describe('ActiveFilters', () => {
  const chips = [
    { id: 'size', label: 'Size: 51-200' },
    { id: 'tech', label: 'Tech: React' },
  ];

  it('renders chips and removes the chosen one by id', async () => {
    const onRemove = vi.fn();
    render(<ActiveFilters chips={chips} onRemove={onRemove} />);
    expect(screen.getByText('Active Filters:')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove filter Tech: React' }),
    );
    expect(onRemove).toHaveBeenCalledWith('tech');
  });
});

describe('FilterActions', () => {
  it('wires the reset and search actions', async () => {
    const onReset = vi.fn();
    const onSearch = vi.fn();
    render(<FilterActions onReset={onReset} onSearch={onSearch} />);
    await userEvent.click(
      screen.getByRole('button', { name: /Reset Filters/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Search Companies/ }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});

function makeConsoleProps(): FilterConsoleProps {
  return {
    keywords: '',
    onKeywordsChange: vi.fn(),
    techStack: '',
    onTechStackChange: vi.fn(),
    industry: 'all',
    onIndustryChange: vi.fn(),
    companySize: 'any',
    onCompanySizeChange: vi.fn(),
    location: 'Global',
    onLocationChange: vi.fn(),
    locationOptions: ['Global'],
    region: 'all',
    onRegionChange: vi.fn(),
    regionOptions: ['All Regions'],
    city: 'all',
    onCityChange: vi.fn(),
    cityOptions: ['All Cities'],
    companyLimit: '50',
    onCompanyLimitChange: vi.fn(),
    chips: [{ id: 'tech', label: 'Tech: React' }],
    onRemoveChip: vi.fn(),
    onReset: vi.fn(),
    onSearch: vi.fn(),
  };
}

describe('FilterConsole', () => {
  it.each([
    ['Small', 'small'],
    ['Medium', 'medium'],
    ['Large', 'large'],
    ['Megacorp', 'megacorp'],
  ])('uses %s as an understandable size filter', async (label, value) => {
    const props = makeConsoleProps();
    render(<FilterConsole {...props} />);
    await userEvent.selectOptions(
      screen.getByLabelText('Company Size'),
      screen.getByRole('option', { name: label }),
    );
    expect(props.onCompanySizeChange).toHaveBeenCalledWith(value);
  });

  it('renders the search, all filter selects, and active chips', () => {
    render(<FilterConsole {...makeConsoleProps()} />);
    expect(screen.getByText('Keywords')).toBeInTheDocument();
    expect(screen.getByLabelText('Industry')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(screen.getByText('Tech: React')).toBeInTheDocument();
  });
});
