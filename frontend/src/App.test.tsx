import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

// Keep the third-party spreadsheet out of navigation tests (slow under jsdom).
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: ({ id }: { id: string }) => <div id={id} />,
  HotColumn: () => null,
}));
vi.mock('handsontable/registry', () => ({
  registerAllModules: () => undefined,
}));

async function go(label: RegExp, heading: string, level = 1) {
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  await userEvent.click(within(nav).getByRole('button', { name: label }));
  expect(
    screen.getByRole('heading', { name: heading, level }),
  ).toBeInTheDocument();
}

describe('App navigation', () => {
  it('moves through the outreach workflow from the sidebar', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Generate Target List' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('API credit balances')).toBeInTheDocument();

    await go(/Pipeline/, 'Outreach Pipeline');
    await go(/Review/, 'Outreach Review');
    await go(/Recipients/, 'Recipients');
    await go(/^Send$/, 'Choose Companies to Send');
    // Nothing is selectable without live data, so Continue stays disabled.
    expect(
      screen.getByRole('button', { name: /Continue to Schedule/ }),
    ).toBeDisabled();
    await go(/Schedule/, 'Schedule Submission');
    await go(/History/, 'Send History');
    await go(/Settings/, 'Settings');
    await go(/Companies/, 'Generate Target List', 2);

    expect(
      screen.queryByRole('button', { name: /Generation Jobs/ }),
    ).toBeNull();
    expect(document.body.textContent).not.toMatch(/r[ée]sum[ée]/i);
  }, 20000);
});
