import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './SettingsForm';
import { emptySettings } from './data';

const limits = {
  niche: 10,
  offer: 10,
  senderName: 10,
  signature: 10,
  customInstructions: 10,
};

describe('SettingsForm', () => {
  it('renders every field and submits only when allowed', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <SettingsForm
        values={emptySettings}
        limits={limits}
        canSave={false}
        saving={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(
      screen.getByRole('button', { name: 'Save settings' }),
    ).toBeDisabled();
    rerender(
      <SettingsForm
        values={emptySettings}
        limits={limits}
        canSave
        saving={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save settings' }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
