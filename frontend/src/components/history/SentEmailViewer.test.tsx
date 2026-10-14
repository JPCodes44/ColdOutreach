import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentEmailViewer } from './SentEmailViewer';

describe('SentEmailViewer', () => {
  it('renders stored HTML in a fully sandboxed frame plus the text version', async () => {
    const onClose = vi.fn();
    render(
      <SentEmailViewer
        email={{
          _id: 's1',
          companyName: 'Acme',
          intendedTo: 'owner@acme.test',
          actualTo: 'owner@acme.test',
          subject: 'Hello Acme',
          text: 'Plain body',
          html: '<p>Body</p>',
          sentAt: '2026-10-14T12:00:00.000Z',
        }}
        onClose={onClose}
      />,
    );
    const frame = screen.getByTitle('Sent HTML email');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame).toHaveAttribute('srcdoc', '<p>Body</p>');
    expect(screen.getByText('Plain body')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('handles a missing email', () => {
    render(<SentEmailViewer email={null} onClose={vi.fn()} />);
    expect(
      screen.getByText('This email could not be found.'),
    ).toBeInTheDocument();
  });
});
