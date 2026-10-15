import { displaySource } from '@emailstrat/common';
import { OpportunityList } from './OpportunityList';
import type { EvidencePanelProps } from './types';

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** What was retrieved, what was observed, and what is only hypothesized. */
export function EvidencePanel({ evidence, analysis }: EvidencePanelProps) {
  const sourceFor = (ids: string[]) =>
    evidence.facts.find((fact) => fact.id === ids[0])?.sourceUrl ?? '';
  return (
    <section className="reviewCard" aria-label="Website evidence">
      <h2 className="reviewCardTitle">Website evidence</h2>
      {analysis.businessSummary ? (
        <p className="reviewMuted">{analysis.businessSummary}</p>
      ) : null}
      <h3 className="reviewSubTitle">Pages reviewed</h3>
      <ul className="reviewList">
        {evidence.sources.map((source) => (
          <li key={source.url}>
            <span className="reviewMono">{displaySource(source.url)}</span>
            {source.title ? ` — ${source.title}` : ''}
            <span className="reviewMuted">
              {' '}
              · retrieved {formatTime(source.fetchedAt)}
              {source.rendered === true ? ' · rendered in a browser' : ''}
            </span>
          </li>
        ))}
        {evidence.skipped.map((page) => (
          <li key={page.url} className="reviewMuted">
            Skipped {displaySource(page.url)}: {page.reason}
          </li>
        ))}
      </ul>
      <h3 className="reviewSubTitle">Observations</h3>
      <ul className="reviewList">
        {analysis.observations.map((observation) => (
          <li key={observation.text}>
            <span className="reviewTag reviewTag-observed">Observed</span>{' '}
            {observation.text}{' '}
            <span className="reviewMuted">
              ({observation.evidenceIds.join(', ')} ·{' '}
              {displaySource(sourceFor(observation.evidenceIds))})
            </span>
          </li>
        ))}
      </ul>
      <OpportunityList opportunities={analysis.opportunities} />
      <details className="reviewDetails">
        <summary>All {evidence.facts.length} evidence facts</summary>
        <ul className="reviewList">
          {evidence.facts.map((fact) => (
            <li key={fact.id}>
              <strong>{fact.id}</strong> {fact.text}{' '}
              <span className="reviewMuted">
                ({displaySource(fact.sourceUrl)})
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
