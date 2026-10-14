import { Icon } from '../outreach/Common';
import type { RunErrorProps } from './types';

/** The latest run failed; the previous draft (if any) is untouched. */
export function RunError({ error, hasDraft }: RunErrorProps) {
  return (
    <section className="reviewCard reviewError" role="alert">
      <p className="reviewCardTitle">
        <Icon name="error" size={18} />
        The latest run failed
      </p>
      <p>{error}</p>
      <p className="reviewMuted">
        {hasDraft
          ? 'Your previous draft below was kept unchanged.'
          : 'No draft was saved. Fix the issue (or try again) and rerun the pipeline.'}
      </p>
    </section>
  );
}
