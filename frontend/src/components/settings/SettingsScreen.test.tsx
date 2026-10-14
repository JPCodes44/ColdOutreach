import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';
import type { SettingsData } from './types';

const mocks = vi.hoisted(() => ({ data: undefined as unknown, save: vi.fn() }));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.data,
  useMutation: () => mocks.save,
}));

const loaded: SettingsData = {
  version: 2,
  niche: 'Dental clinics',
  offer: 'Lead-response automation',
  senderName: 'Sam',
  signature: '',
  customInstructions: '',
  updatedAt: '2026-10-14T12:00:00.000Z',
  limits: {
    niche: 200,
    offer: 1500,
    senderName: 100,
    signature: 500,
    customInstructions: 3000,
  },
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    mocks.data = loaded;
    mocks.save.mockReset();
  });

  it('shows a loading state before settings arrive', () => {
    mocks.data = undefined;
    render(<SettingsScreen />);
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading settings…')).toBeInTheDocument();
  });

  it('loads saved values and keeps Save disabled until something changes', () => {
    render(<SettingsScreen />);
    expect(screen.getByLabelText(/^Niche/)).toHaveValue('Dental clinics');
    expect(screen.getByText(/Current version 2/)).toBeInTheDocument();
    expect(screen.getByText(/never shown or entered here/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save settings' }),
    ).toBeDisabled();
  });

  it('saves edits and reports the new version', async () => {
    mocks.save.mockResolvedValue({ version: 3 });
    render(<SettingsScreen />);
    const niche = screen.getByLabelText(/^Niche/);
    await userEvent.clear(niche);
    await userEvent.type(niche, 'Vet clinics');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save settings' }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: 'Vet clinics',
        offer: 'Lead-response automation',
      }),
    );
    expect(await screen.findByText('Saved as version 3.')).toBeInTheDocument();
  });

  it('blocks saving when a required field is empty', async () => {
    render(<SettingsScreen />);
    await userEvent.clear(screen.getByLabelText(/^Offer/));
    expect(
      screen.getByRole('button', { name: 'Save settings' }),
    ).toBeDisabled();
  });

  it('shows backend validation errors', async () => {
    mocks.save.mockRejectedValue(
      new Error('customInstructions looks like it contains a credential.'),
    );
    render(<SettingsScreen />);
    await userEvent.type(
      screen.getByLabelText(/^Custom email instructions/),
      'x',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save settings' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'looks like it contains a credential',
    );
  });
});
