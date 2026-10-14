import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunProgress } from './RunProgress';

describe('RunProgress', () => {
  it('marks completed, current, and pending stages', () => {
    render(<RunProgress stage="composing" />);
    expect(screen.getByText('Reviewing website')).toHaveClass(
      'reviewStep-done',
    );
    expect(screen.getByText('Writing email')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Rendering')).toHaveClass('reviewStep-pending');
    expect(screen.getByText(/no email will be sent/)).toBeInTheDocument();
  });
});
