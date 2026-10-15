import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

/** Minimal in-memory Storage for the auth client's token persistence. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

describe('App', () => {
  it('requires sign-in before showing the workspace', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    render(<App />);
    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    vi.unstubAllGlobals();
  });
});
