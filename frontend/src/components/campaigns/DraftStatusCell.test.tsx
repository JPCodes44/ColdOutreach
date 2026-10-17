import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftStatusCell } from './DraftStatusCell';
import { pipelineRow } from './testRows';

describe('DraftStatusCell', () => {
  it.each([
    [true, 'Website review'],
    [false, 'Company research only'],
  ] as const)(
    'labels the draft mode when website review is %s',
    (websiteReviewEnabled, label) => {
      render(
        <DraftStatusCell
          company={pipelineRow({ draftState: 'ready', websiteReviewEnabled })}
        />,
      );
      expect(screen.getByText('Ready for review')).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('does not assign a mode before a company has run', () => {
    render(
      <DraftStatusCell company={pipelineRow({ websiteReviewEnabled: null })} />,
    );
    expect(screen.queryByText('Website review')).toBeNull();
    expect(screen.queryByText('Company research only')).toBeNull();
  });

  it('shows the running stage', () => {
    render(
      <DraftStatusCell
        company={pipelineRow({ draftState: 'running', stage: 'composing' })}
      />,
    );
    expect(screen.getByText('Generating · composing')).toBeInTheDocument();
  });

  it('shows a failure reason inline and on hover', () => {
    const { container } = render(
      <DraftStatusCell
        company={pipelineRow({
          draftState: 'failed',
          lastError: 'acme.test responded with HTTP 503.',
        })}
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(
      screen.getByText('acme.test responded with HTTP 503.'),
    ).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute(
      'title',
      'acme.test responded with HTTP 503.',
    );
  });
});
