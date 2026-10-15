import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailTableScreen } from './EmailTable';

vi.mock('./RecipientsScreen', () => ({
  default: () => <h1>Recipients grid</h1>,
}));

describe('EmailTableScreen', () => {
  it('shows a placeholder, then the lazily loaded recipients grid', async () => {
    render(<EmailTableScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading recipients');
    expect(
      await screen.findByRole('heading', { name: 'Recipients grid' }),
    ).toBeInTheDocument();
  });
});
