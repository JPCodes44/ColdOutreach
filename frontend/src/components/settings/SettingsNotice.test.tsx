import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsNotice } from './SettingsNotice';
import { SettingsStatus } from './SettingsStatus';

describe('SettingsNotice', () => {
  it('explains defaults and that changes only affect future runs', () => {
    render(<SettingsNotice version={0} updatedAt={null} />);
    expect(
      screen.getByText('Using built-in defaults (not yet saved).'),
    ).toBeInTheDocument();
    expect(screen.getByText(/future pipeline runs only/)).toBeInTheDocument();
  });
});

describe('SettingsStatus', () => {
  it('renders nothing, a confirmation, or an error', () => {
    const { container, rerender } = render(
      <SettingsStatus savedVersion={null} error={null} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<SettingsStatus savedVersion={4} error={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved as version 4.');
    rerender(<SettingsStatus savedVersion={4} error="Nope" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  });
});
