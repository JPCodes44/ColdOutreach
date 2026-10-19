import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipientResearchInfo } from './RecipientResearchInfo';

describe('RecipientResearchInfo', () => {
  it('copies reusable system instructions that choose recipients from each draft', async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<RecipientResearchInfo />);
    await user.click(screen.getByRole('button', { name: 'Copy Codex prompt' }));
    const prompt = copy.mock.calls[0]![0];
    expect(prompt).toContain('system');
    expect(prompt).toContain('ChatGPT computer use');
    expect(prompt).toContain('Do not route this task through gstack');
    expect(prompt).not.toContain('Follow applicable AGENTS.md');
    expect(prompt).not.toContain('or authenticated browser tools');
    expect(prompt).toContain('read the complete saved email draft');
    expect(prompt).toContain('Email1');
    expect(prompt).toContain('Email2');
    expect(prompt).toContain('Email3');
    expect(prompt).toContain('context');
    expect(prompt).toContain('Never overwrite');
    expect(prompt).toContain('Do not guess');
    expect(prompt).toContain('Use the signed-in Apollo website');
    expect(prompt).toContain('Search or ask a question in Apollo');
    expect(prompt).toContain('Suggested leads');
    expect(prompt).toContain('Search people');
    expect(prompt).toContain('Show Filters');
    expect(prompt).toContain('copy icon');
    expect(prompt).toContain('clear the previous role');
    expect(prompt).not.toMatch(/\bMeta\b/);
    expect(prompt).not.toContain('Senior Project Manager');
    expect(prompt).toContain('already authorized');
    expect(prompt).toContain('existing Apollo credit balance');
    expect(prompt).toContain('up to three distinct contacts per company');
    expect(prompt).toContain('Do not ask the user again');
    expect(prompt).toContain('Access email');
    expect(prompt).toContain('Verified');
    expect(prompt).toContain('Do not reveal phone');
    expect(prompt).toContain('CAPTCHA');
    expect(prompt).toContain('stop debugging');
    expect(prompt).toContain('release control');
    expect(prompt).toContain('Wait for the user');
    expect(prompt).not.toContain('Use only the existing free allowance');
    expect(prompt).toContain('Do not call Apollo APIs directly');
    expect(prompt).toContain('Normal clicks');
    expect(prompt).not.toContain(
      "Only use a person's work email when it is explicitly published",
    );
    expect(prompt).not.toContain(
      'Do not use paid APIs, Apollo enrichment/reveal credits',
    );
    expect(prompt).toContain('source URL');
    expect(prompt).toContain('Do not send');
    expect(prompt).not.toContain('Company snapshot');
    expect(prompt).not.toContain('http://localhost');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Prompt copied',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('keeps the general prompt available without company data', () => {
    render(<RecipientResearchInfo />);
    expect(
      screen.getByRole('button', { name: 'Copy Codex prompt' }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText('Company-specific instructions (optional)'),
    ).toBeNull();
  });

  it('provides a selectable prompt when clipboard access fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('Denied'),
    );
    render(<RecipientResearchInfo />);
    await user.click(screen.getByRole('button', { name: 'Copy Codex prompt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Copy the prompt below',
    );
    expect(
      (screen.getByLabelText('Codex research prompt') as HTMLTextAreaElement)
        .value,
    ).toContain('read the complete saved email draft');
  });
});
