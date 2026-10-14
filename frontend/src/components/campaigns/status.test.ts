import { describe, expect, it } from 'vitest';
import { draftStatusLabel, matchesFilter } from './status';
import { pipelineRow } from './testRows';

describe('pipeline status helpers', () => {
  it('appends the live stage while a run is in progress', () => {
    expect(
      draftStatusLabel(
        pipelineRow({ draftState: 'running', stage: 'analyzing' }),
      ),
    ).toBe('Generating · analyzing');
    expect(draftStatusLabel(pipelineRow({ draftState: 'legacy' }))).toBe(
      'Legacy draft – regenerate',
    );
  });

  it('groups never-run and legacy companies under "Needs run"', () => {
    expect(matchesFilter('none', 'needs-run')).toBe(true);
    expect(matchesFilter('legacy', 'needs-run')).toBe(true);
    expect(matchesFilter('ready', 'needs-run')).toBe(false);
    expect(matchesFilter('approved', 'approved')).toBe(true);
    expect(matchesFilter('failed', 'all')).toBe(true);
  });
});
