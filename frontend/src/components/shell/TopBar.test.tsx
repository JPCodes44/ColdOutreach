import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { TopBar } from './TopBar';
import { navItems } from './navItems';

describe('TopBar', () => {
  it('renders the API balance indicators', () => {
    const convexClient = new ConvexReactClient('https://example.convex.cloud');
    render(
      <ConvexProvider client={convexClient}>
        <TopBar />
      </ConvexProvider>,
    );
    expect(screen.getByLabelText('API credit balances')).toBeInTheDocument();
  });
});

describe('navItems', () => {
  it('lists the outreach workflow without job-seeking pages', () => {
    expect(navItems.map((item) => item.label)).toEqual([
      'Companies',
      'Pipeline',
      'Review',
      'Recipients',
      'Send',
      'Schedule',
      'History',
      'Settings',
    ]);
  });
});
