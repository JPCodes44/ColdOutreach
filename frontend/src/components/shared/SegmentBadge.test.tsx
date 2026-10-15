import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SegmentBadge } from './SegmentBadge';

describe('SegmentBadge', () => {
  it('styles exclusively vegan and mixed manufacturers differently', () => {
    render(
      <>
        <SegmentBadge segment="Exclusively vegan" />
        <SegmentBadge segment="Mixed manufacturer" />
        <SegmentBadge segment="Vegan focus unclear" />
      </>,
    );
    expect(screen.getByText('Exclusively vegan')).toHaveClass(
      'segmentBadge-vegan',
    );
    expect(screen.getByText('Mixed manufacturer')).toHaveClass(
      'segmentBadge-mixed',
    );
    expect(screen.getByText('Vegan focus unclear')).toHaveClass(
      'segmentBadge-unclear',
    );
  });

  it('renders nothing without a segment', () => {
    const { container } = render(<SegmentBadge segment={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
