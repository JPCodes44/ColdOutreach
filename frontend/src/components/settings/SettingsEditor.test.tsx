import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsEditor } from './SettingsEditor';

describe('SettingsEditor', () => {
  it('seeds the form from the loaded version', () => {
    render(
      <SettingsEditor
        data={{
          version: 0,
          niche: 'Local services',
          offer: 'Automation',
          senderName: '',
          signature: '',
          customInstructions: '',
          updatedAt: null,
          limits: {
            niche: 200,
            offer: 1500,
            senderName: 100,
            signature: 500,
            customInstructions: 3000,
          },
        }}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Offer/)).toHaveValue('Automation');
  });
});
