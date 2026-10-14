import { DASHBOARD_DISCLAIMER } from '@emailstrat/common';
import type { WorkflowDashboardProps } from './types';

/** Proposed lead-response workflow and the illustrative dashboard mockup. */
export function WorkflowDashboard({
  workflow,
  dashboard,
}: WorkflowDashboardProps) {
  return (
    <section className="reviewCard" aria-label="Proposed solution">
      <h2 className="reviewCardTitle">Proposed lead-response workflow</h2>
      <ol className="reviewList">
        {workflow.map((step) => (
          <li key={step.name}>
            <strong>{step.name}:</strong> {step.description}
          </li>
        ))}
      </ol>
      <div className="reviewDashboard">
        <p className="reviewDashboardLabel">Illustrative — example only</p>
        <p className="reviewOpportunityTitle">{dashboard.title}</p>
        <p className="reviewMuted">{DASHBOARD_DISCLAIMER}</p>
        {dashboard.stages.length > 0 ? (
          <ol className="reviewStages" aria-label="Example lead stages">
            {dashboard.stages.map((stage) => (
              <li key={stage} className="reviewStage">
                {stage}
              </li>
            ))}
          </ol>
        ) : null}
        <dl className="reviewMetrics">
          {dashboard.metrics.map((metric) => (
            <div key={metric.label} className="reviewMetric">
              <dt>{metric.label}</dt>
              <dd>{metric.description}</dd>
              <dd className="reviewMetricValue" aria-label="No value (example)">
                —
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
