import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowDashboard } from './WorkflowDashboard';
import { reviewFixture } from './testReview';

describe('WorkflowDashboard', () => {
  it('labels the dashboard as illustrative with blank metric values', () => {
    const { content } = reviewFixture().draft!;
    render(
      <WorkflowDashboard
        workflow={content.workflow}
        dashboard={content.dashboard}
      />,
    );
    expect(screen.getByText('Illustrative — example only')).toBeInTheDocument();
    expect(screen.getByText(/not measured results/)).toBeInTheDocument();
    expect(screen.getByLabelText('No value (example)')).toHaveTextContent('—');
    expect(screen.getByText('A short inquiry form.')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Example lead stages' }),
    ).toHaveTextContent('NewContacted');
  });
});
