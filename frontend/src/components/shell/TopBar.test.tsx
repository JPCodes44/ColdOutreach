import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { TopBar } from './TopBar';
import { navItems } from './navItems';

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

describe('TopBar', () => {
  it('renders the API balance indicators and sign-out', () => {
    const convexClient = new ConvexReactClient('https://example.convex.cloud');
    render(
      <ConvexProvider client={convexClient}>
        <TopBar />
      </ConvexProvider>,
    );
    expect(screen.getByLabelText('API credit balances')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument();
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
