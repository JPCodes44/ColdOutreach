import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsField } from './SettingsField';
import { settingsFields } from './data';

describe('SettingsField', () => {
  it('renders a counter and flags values over the limit', () => {
    const onChange = vi.fn();
    render(
      <SettingsField
        def={settingsFields[0]!}
        value="abcdef"
        limit={5}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('6/5')).toHaveClass('settingsCountOver');
    fireEvent.change(screen.getByLabelText(/^Niche/), {
      target: { value: 'a' },
    });
    expect(onChange).toHaveBeenCalledWith('niche', 'a');
  });

  it('uses a textarea for multiline fields', () => {
    render(
      <SettingsField
        def={settingsFields[1]!}
        value=""
        limit={10}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Offer/).tagName).toBe('TEXTAREA');
  });
});
