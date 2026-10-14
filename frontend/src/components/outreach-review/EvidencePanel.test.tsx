import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidencePanel } from './EvidencePanel';
import { reviewFixture } from './testReview';

const { evidence, analysis } = reviewFixture();

describe('EvidencePanel', () => {
  it('lists reviewed and skipped pages, observations with sources, and all facts', () => {
    render(<EvidencePanel evidence={evidence!} analysis={analysis!} />);
    expect(screen.getByText('acme.test')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Skipped acme.test\/contact: acme.test responded with HTTP 404./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The homepage lists a phone number./),
    ).toBeInTheDocument();
    expect(screen.getByText('All 2 evidence facts')).toBeInTheDocument();
    expect(screen.getByText(/No HTML form was found/)).toBeInTheDocument();
  });
});
