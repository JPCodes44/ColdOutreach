import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunError } from './RunError';

describe('RunError', () => {
  it('shows the failure and says the previous draft is kept', () => {
    render(<RunError error="acme.test responded with HTTP 503." hasDraft />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'acme.test responded with HTTP 503.',
    );
    expect(
      screen.getByText(/previous draft below was kept unchanged/),
    ).toBeInTheDocument();
  });

  it('says nothing was saved when there is no draft', () => {
    render(<RunError error="x" hasDraft={false} />);
    expect(screen.getByText(/No draft was saved/)).toBeInTheDocument();
  });
});
