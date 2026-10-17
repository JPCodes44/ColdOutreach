import type { ReactNode } from 'react';

/* ---------------------------------------------------------------- domain */

/** A left-nav destination. */
export interface NavItem {
  id: string;
  label: string;
  /** Material Symbols icon name. */
  iconName: string;
}

/** Confidence-score presentation tone. */
export type ConfidenceTone = 'positive' | 'neutral';

/** Semantic tone for a status pill — selects its color theme. */
export type StatusTone = 'success' | 'danger' | 'neutral';

/** A discovered company row. */
export interface Company {
  id: string;
  name: string;
  domain: string;
  /** Single-letter avatar glyph. */
  initial: string;
  industry: string;
  description?: string;
  location: string;
  size: string;
  techStack: string[];
  /** Confidence percentage, 0–100. */
  confidence: number;
  confidenceTone: ConfidenceTone;
  /** Industry-preset label, e.g. "Exclusively vegan" / "Mixed manufacturer". */
  segment?: string;
}

/** An option in a filter `<select>`. */
export interface SelectOption {
  value: string;
  label: string;
}

/** A removable active-filter chip. */
export interface FilterChipModel {
  id: string;
  label: string;
}

/* -------------------------------------------------------------- atoms */

export interface IconProps {
  /** Material Symbols Outlined glyph name. */
  name: string;
  size?: number;
  fill?: boolean;
}

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  variant: ButtonVariant;
  children: ReactNode;
  iconName?: string;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
}

export interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
}

export interface SplitButtonProps {
  label: string;
  iconName: string;
  onClick?: () => void;
  onToggleMenu?: () => void;
}

export interface TechBadgeProps {
  label: string;
}

export interface ConfidenceBadgeProps {
  value: number;
  tone: ConfidenceTone;
}

export interface StatusPillProps {
  /** Color theme to apply. */
  tone: StatusTone;
  /** Pill contents — typically a short status label. */
  children: ReactNode;
}

export interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export interface CompanyAvatarProps {
  initial: string;
}

/* ------------------------------------------------------------ sidebar */

export interface SidebarBrandProps {
  title: string;
  subtitle: string;
}

export interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  onSelect: (id: string) => void;
}

export interface SidebarNavProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export interface SidebarProps {
  brand: SidebarBrandProps;
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/* ------------------------------------------------------------- header */

export interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export interface ScreenProps {
  /** Navigate to the Target Companies pipeline (from the discovery modal). */
  onViewCompanies?: () => void;
}

/* ------------------------------------------------------ filter console */

export interface FilterFieldProps {
  label: string;
  children: ReactNode;
}

export interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export interface FilterSelectProps {
  label: string;
  options: (SelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export interface FilterTechInputProps {
  value: string;
  onChange: (value: string) => void;
}

export interface FilterCompanyLimitInputProps {
  value: string;
  onChange: (value: string) => void;
}

export interface ActiveFiltersProps {
  chips: FilterChipModel[];
  onRemove: (id: string) => void;
}

export interface FilterActionsProps {
  onReset: () => void;
  onSearch: () => void;
  isSearching?: boolean;
}

export interface FilterConsoleProps {
  keywords: string;
  onKeywordsChange: (value: string) => void;
  techStack: string;
  onTechStackChange: (value: string) => void;
  industry: string;
  onIndustryChange: (value: string) => void;
  companySize: string;
  onCompanySizeChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  locationOptions: (SelectOption | string)[];
  region: string;
  onRegionChange: (value: string) => void;
  regionOptions: (SelectOption | string)[];
  city: string;
  onCityChange: (value: string) => void;
  cityOptions: (SelectOption | string)[];
  companyLimit: string;
  onCompanyLimitChange: (value: string) => void;
  chips: FilterChipModel[];
  onRemoveChip: (id: string) => void;
  onReset: () => void;
  onSearch: () => void;
  isSearching?: boolean;
}

/* -------------------------------------------------------------- results */

export interface ResultsHeaderProps {
  matches: number;
  selectedCount: number;
  onClearSelected: () => void;
}

export interface CompanyCellProps {
  company: Company;
}

export interface ResultsRowProps {
  company: Company;
  selected: boolean;
  onToggle: (id: string) => void;
}

export interface ResultsTableProps {
  companies: Company[];
  selectedIds: ReadonlySet<string>;
  allSelected: boolean;
  isLoading?: boolean;
  error?: string;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
}

export interface ResultsProps {
  companies: Company[];
  matches: number;
  selectedIds: ReadonlySet<string>;
  isLoading?: boolean;
  error?: string;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onClearSelected: () => void;
  onExport: () => void;
  onImport: () => void;
}

export interface BulkFooterProps {
  selectedCount: number;
  onExport: () => void;
  onImport: () => void;
}
