/** Delivery cadence for the queued outreach. */
export type DeliveryMethod = 'immediate' | 'batch';

/** A selectable delivery-method card. */
export interface DeliveryOption {
  id: DeliveryMethod;
  iconName: string;
  title: string;
  description: string;
}

/** A company selected for submission (from `send:getScheduleSummary`). */
export interface TargetEntity {
  id: string;
  name: string;
  /** Single-letter avatar glyph. */
  initial: string;
  segment: string;
  contacts: number;
  status?: string;
  draftState?: string;
  /** Complete content and recipients, with no prior contact or active-send conflicts. */
  ready?: boolean;
  notReadyReason?: string | null;
}

/** Aggregate counters shown in the dispatch summary panel. */
export interface DispatchSummary {
  totalCompanies: number;
  readyDrafts: number;
  totalEmailsQueued: number;
}

export interface ScheduleSummary extends DispatchSummary {
  entities: TargetEntity[];
}

/** An option in a `<select>` field. */
export interface SelectOption {
  value: string;
  label: string;
}

export interface ScheduleSubmissionScreenProps {
  /** Companies checked on the Send screen, to be queued. */
  companyIds?: string[];
  /** Returns to the Send screen (Back link and Cancel). */
  onBack?: () => void;
}

export interface ScheduleHeaderProps {
  onBack?: () => void;
  /** Queues the saved snapshots for the chosen schedule. */
  onSchedule?: () => void;
  /** True while the enqueue mutation is in flight. */
  scheduling?: boolean;
  /** False when the selection cannot be scheduled. */
  canSchedule?: boolean;
}

export interface SchedulingOptionsProps {
  date: string;
  onDateChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  timezone: string;
  onTimezoneChange: (value: string) => void;
  method: DeliveryMethod;
  onMethodChange: (value: DeliveryMethod) => void;
}

export interface DeliveryOptionCardProps {
  option: DeliveryOption;
  selected: boolean;
  onSelect: (value: DeliveryMethod) => void;
}

export interface TargetEntitiesProps {
  entities: TargetEntity[];
  selectedIds?: ReadonlySet<string>;
  onToggleSelected?: (companyId: string) => void;
  onToggleAll?: () => void;
  onUnschedule?: () => void;
  unscheduling?: boolean;
  canUnschedule?: boolean;
}

export interface TargetEntityRowProps {
  entity: TargetEntity;
  selected: boolean;
  onToggleSelected?: (companyId: string) => void;
}

export interface DispatchSummaryProps {
  summary: DispatchSummary;
}

export interface ScheduleSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}
