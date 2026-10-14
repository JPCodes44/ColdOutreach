import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailPreview } from './EmailPreview';
import { reviewFixture } from './testReview';

describe('EmailPreview', () => {
  it('renders escaped HTML in a fully sandboxed iframe and a plain-text tab', async () => {
    const content = {
      ...reviewFixture().draft!.content,
      opening: 'Hi <script>alert(1)</script>',
    };
    render(<EmailPreview content={content} />);
    const frame = screen.getByTitle('HTML email preview');
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.getAttribute('srcdoc')).toContain('&lt;script&gt;');
    expect(frame.getAttribute('srcdoc')).not.toContain('<script>');
    await userEvent.click(screen.getByRole('tab', { name: 'Plain text' }));
    expect(
      screen.getByText(/ILLUSTRATIVE DASHBOARD CONCEPT/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Would a quick sketch be useful\?/),
    ).toBeInTheDocument();
  });
});
