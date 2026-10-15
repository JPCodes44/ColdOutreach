import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ApiBalances } from './ApiBalances';
import { formatCredit } from './formatCredit';

const convexClient = new ConvexReactClient('https://example.convex.cloud');

describe('ApiBalances', () => {
  it('renders the three provider indicators (placeholder while loading)', () => {
    render(
      <ConvexProvider client={convexClient}>
        <ApiBalances />
      </ConvexProvider>,
    );
    expect(screen.getByText('GPT')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    // No live query under the test client → dashes, not numbers.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows spend instead of a negative balance when no start is set', () => {
    expect(formatCredit(null, 0.034)).toBe('$0.03 spent');
    expect(formatCredit(null, 0)).toBe('—');
    expect(formatCredit(null, undefined)).toBe('—');
    expect(formatCredit(4.5, 1)).toBe('$4.50');
  });
});
