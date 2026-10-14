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
    approved: false,
    dirty: false,
    busy: false,
    error: null,
    warnings: [],
    onSave: vi.fn(),
    onApprove: vi.fn(),
    onUnapprove: vi.fn(),
    ...overrides,
  };
  render(<DraftEditor {...props} />);
  return props;
}

describe('DraftEditor', () => {
  it('edits fields and says approving does not send', async () => {
    const props = renderEditor();
    await userEvent.type(screen.getByLabelText('Subject'), '!');
    expect(props.onChange).toHaveBeenCalledWith({
      ...props.fields,
      subject: 'Hi!',
    });
    expect(
      screen.getByText('Approving does not send. Use Schedule to send.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save edits' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve for sending' }),
    );
    expect(props.onApprove).toHaveBeenCalledTimes(1);
  });

  it('requires saving before approval and shows warnings and errors', async () => {
    const props = renderEditor({
      dirty: true,
      warnings: ['30%'],
      error: 'Subject is empty.',
    });
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve for sending' }),
    ).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent('30%');
    expect(screen.getByRole('alert')).toHaveTextContent('Subject is empty.');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the immutable-snapshot banner and withdraw action once approved', async () => {
    const props = renderEditor({ approved: true });
    expect(screen.getByRole('status')).toHaveTextContent(
      "later edits won't change queued emails",
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Withdraw approval' }),
    );
    expect(props.onUnapprove).toHaveBeenCalledTimes(1);
  });
});
