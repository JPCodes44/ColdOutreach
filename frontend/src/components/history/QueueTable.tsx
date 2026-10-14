import { useState } from 'react';
import { QueueRowItem } from './QueueRowItem';
import { matchesFilter, queueFilters } from './status';
import type { QueueFilter, QueueTableProps } from './types';

/** Filterable list of every queued, attempted, and resolved send. */
export function QueueTable({ rows, onCancel, onResolve }: QueueTableProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const visible = (rows ?? []).filter((row) => matchesFilter(row, filter));
  return (
    <section className="historyCard" aria-labelledby="history-queue-title">
      <div className="historyCardHeader">
        <h2 id="history-queue-title" className="historyCardTitle">
          Queue &amp; attempts
        </h2>
        <div
          className="historyFilters"
          role="group"
          aria-label="Filter queue by status"
        >
          {queueFilters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                filter === option.value
                  ? 'historyFilter historyFilterActive'
                  : 'historyFilter'
              }
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {rows === undefined ? (
        <p className="historyEmpty">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="historyEmpty">No sends match this filter.</p>
      ) : (
        <ul className="historyList">
          {visible.map((row) => (
            <QueueRowItem
              key={row.id}
              row={row}
              onCancel={onCancel}
              onResolve={onResolve}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
