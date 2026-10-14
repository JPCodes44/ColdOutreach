import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('extracts the uncaught server message from a Convex error', () => {
    const error = new Error(
      '[CONVEX M(companies:deleteCompanies)] [Request ID: x] Server Error\nUncaught Error: Acme has sends queued.\n    at handler',
    );
    expect(errorMessage(error, 'fallback')).toBe('Acme has sends queued.');
  });

  it('falls back for plain errors and non-errors', () => {
    expect(errorMessage(new Error('plain'), 'fallback')).toBe('plain');
    expect(errorMessage('nope', 'fallback')).toBe('fallback');
  });
});
