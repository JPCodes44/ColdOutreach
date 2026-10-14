import { targetStatus } from './data';
import type { TargetEntityRowProps } from './types';

/** One selected company with its contact count and readiness. */
export function TargetEntityRow({
  entity,
  selected,
  onToggleSelected,
}: TargetEntityRowProps) {
  const status = targetStatus(entity);
  return (
    <article className="scheduleEntity">
      <input
        className="scheduleEntityCheckbox"
        type="checkbox"
        checked={selected}
        aria-label={`Select ${entity.name} for unscheduling`}
        onChange={() => onToggleSelected?.(entity.id)}
      />
      <span className="scheduleEntityAvatar">{entity.initial}</span>
      <span className="scheduleEntityText">
        <span className="scheduleEntityName">{entity.name}</span>
        <span className="scheduleEntityMeta">
          {entity.segment} • {entity.contacts} Contact
          {entity.contacts === 1 ? '' : 's'}
        </span>
      </span>
      <span className={`scheduleStatusChip ${status.className}`}>
        {status.label}
      </span>
    </article>
  );
}
