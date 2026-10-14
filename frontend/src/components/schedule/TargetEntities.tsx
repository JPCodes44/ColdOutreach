import { Icon } from '../outreach/Common';
import { TargetEntityRow } from './TargetEntityRow';
import type { TargetEntitiesProps } from './types';

/** Selected companies, with bulk unscheduling of queued sends. */
export function TargetEntities({
  entities,
  selectedIds = new Set(),
  onToggleSelected,
  onToggleAll,
  onUnschedule,
  unscheduling = false,
  canUnschedule = false,
}: TargetEntitiesProps) {
  const allSelected =
    entities.length > 0 && entities.every((e) => selectedIds.has(e.id));
  const someSelected =
    entities.some((e) => selectedIds.has(e.id)) && !allSelected;
  return (
    <section className="scheduleCard">
      <div className="scheduleCardHeader scheduleCardHeaderRow">
        <span className="scheduleCardHeading">
          <input
            className="scheduleEntityCheckbox"
            type="checkbox"
            checked={allSelected}
            ref={(node) => {
              if (node !== null) node.indeterminate = someSelected;
            }}
            aria-label="Select all target entities for unscheduling"
            disabled={entities.length === 0}
            onChange={() => onToggleAll?.()}
          />
          <span className="scheduleCardTitleGroup">
            <Icon name="groups" size={20} />
            <h2 className="scheduleCardTitle">Target Entities</h2>
          </span>
        </span>
        <span className="scheduleTargetActions">
          <button
            className="scheduleUnscheduleButton"
            type="button"
            onClick={onUnschedule}
            disabled={!canUnschedule || unscheduling}
          >
            {unscheduling
              ? 'Unscheduling...'
              : `Unschedule selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </button>
        </span>
      </div>
      <div className="scheduleEntityList">
        {entities.length === 0 ? (
          <div className="scheduleEntityEmpty">No selected companies.</div>
        ) : (
          entities.map((entity) => (
            <TargetEntityRow
              key={entity.id}
              entity={entity}
              selected={selectedIds.has(entity.id)}
              onToggleSelected={onToggleSelected}
            />
          ))
        )}
      </div>
    </section>
  );
}
