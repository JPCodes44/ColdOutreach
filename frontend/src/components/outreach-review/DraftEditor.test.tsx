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
    review: {
      claims: [],
      blockers: [],
      acknowledged: [],
      onAcknowledge: vi.fn(),
    },
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

  it('requires saving before approval and shows errors', async () => {
    const props = renderEditor({ dirty: true, error: 'Subject is empty.' });
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve for sending' }),
    ).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Subject is empty.');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('blocks approval until flagged claims are acknowledged', () => {
    renderEditor({
      review: {
        claims: ['30%'],
        blockers: [],
        acknowledged: [],
        onAcknowledge: vi.fn(),
      },
    });
    expect(
      screen.getByRole('button', { name: 'Approve for sending' }),
    ).toBeDisabled();
  });

  it('blocks approval while a blocker remains, even with claims confirmed', () => {
    renderEditor({
      review: {
        claims: ['30%'],
        blockers: ['Add a signature before approving.'],
        acknowledged: ['30%'],
        onAcknowledge: vi.fn(),
      },
    });
    expect(screen.getByText('Add a signature before approving.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Approve for sending' }),
    ).toBeDisabled();
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
