import type { RunStage } from '../campaigns/types';
import type { RunProgressProps } from './types';

const STEPS: { stage: RunStage; label: string }[] = [
  { stage: 'retrieving', label: 'Reviewing website' },
  { stage: 'analyzing', label: 'Finding opportunities' },
  { stage: 'composing', label: 'Writing email' },
  { stage: 'rendering', label: 'Rendering' },
];

/** Stepper for an in-flight pipeline run. */
export function RunProgress({ stage }: RunProgressProps) {
  const current = STEPS.findIndex((step) => step.stage === stage);
  return (
    <section
      className="reviewCard reviewProgress"
      aria-label="Pipeline progress"
      aria-live="polite"
    >
      <p className="reviewCardTitle">
        Generating draft… no email will be sent.
      </p>
      <ol className="reviewSteps">
        {STEPS.map((step, index) => {
          const state =
            index < current ? 'done' : index === current ? 'active' : 'pending';
          return (
            <li
              key={step.stage}
              className={`reviewStep reviewStep-${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {step.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
