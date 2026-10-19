import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftEditor } from './DraftEditor';
import type { DraftEditorProps } from './types';

function renderEditor(overrides: Partial<DraftEditorProps> = {}) {
  const props: DraftEditorProps = {
    fields: {
      subject: 'Hi',
      opening: 'Hello',
      closing: 'Question?',
      signature: 'Sam',
    },
    onChange: vi.fn(),
    dirty: false,
    busy: false,
    error: null,
    onSave: vi.fn(),
    ...overrides,
  };
  render(<DraftEditor {...props} />);
  return props;
}

describe('DraftEditor', () => {
  it('edits fields without approval controls or claim confirmations', async () => {
    const props = renderEditor();
    await userEvent.type(screen.getByLabelText('Subject'), '!');
    expect(props.onChange).toHaveBeenCalledWith({
      ...props.fields,
      subject: 'Hi!',
    });
    expect(screen.getByText(/Saving does not send email/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approv/i })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save edits' })).toBeDisabled();
  });
  it('saves changes and displays backend errors', async () => {
    const props = renderEditor({ dirty: true, error: 'Subject is empty.' });
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Subject is empty.');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
