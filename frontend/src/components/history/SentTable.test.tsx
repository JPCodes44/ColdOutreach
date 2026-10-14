import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SentTable } from './SentTable';
import { sentRow } from './fixtures';

describe('SentTable', () => {
  it('explains acceptance semantics and opens an email', async () => {
    const onOpen = vi.fn();
    render(
      <SentTable
        rows={[
          sentRow({
            redirected: true,
            actualTo: 'me@inbox.test',
            acceptance: 'manually-confirmed',
          }),
        ]}
        onOpen={onOpen}
      />,
    );
    expect(
      screen.getByText(/does not prove inbox delivery/),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmed manually')).toBeInTheDocument();
    expect(screen.getByText(/redirected to me@inbox.test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Acme/ }));
    expect(onOpen).toHaveBeenCalledWith('s1');
  });

  it('shows an empty state', () => {
    render(<SentTable rows={[]} onOpen={vi.fn()} />);
    expect(screen.getByText('No emails sent yet.')).toBeInTheDocument();
  });
});
