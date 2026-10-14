import type { NavItem } from '../outreach/types';

/** Primary sidebar destinations, in workflow order. */
export const navItems: NavItem[] = [
  { id: 'companies', label: 'Companies', iconName: 'business' },
  { id: 'campaigns', label: 'Pipeline', iconName: 'account_tree' },
  { id: 'review', label: 'Review', iconName: 'rate_review' },
  { id: 'email-table', label: 'Recipients', iconName: 'contacts' },
  { id: 'drafts', label: 'Send', iconName: 'outgoing_mail' },
  { id: 'schedule', label: 'Schedule', iconName: 'calendar_today' },
  { id: 'history', label: 'History', iconName: 'history' },
  { id: 'settings', label: 'Settings', iconName: 'settings' },
];
