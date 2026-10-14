import type { ReactNode } from 'react';

/** Icon color theme for the success icon badge. */
export type ModalTone = 'primary' | 'tertiary';

/** Color of a modal card's top accent strip. */
export type ModalAccent = 'primary' | 'tertiary' | 'error' | 'amber';

/** Card background treatment (white by default, or a tinted error surface). */
export type ModalSurface = 'default' | 'error';

/** Tone of the simple (non-haloed) alert icon. */
export type ModalIconVariant = 'warning' | 'danger' | 'error' | 'info';

export interface ModalOverlayProps {
  /** Accessible label describing the dialog. */
  ariaLabel: string;
  /** Fired on backdrop click or the Escape key. */
  onDismiss: () => void;
  /**
   * Dialog width: `sm` (440px, default), `lg` (640px, preview modals), or `xl`
   * (1120px, the email-draft carousel).
   */
  size?: 'sm' | 'lg' | 'xl';
  children: ReactNode;
}

export interface ModalHeaderProps {
  /** Material Symbols glyph for the square header icon. */
  icon: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export interface ModalCardProps {
  /** Optional colored accent strip across the top edge. */
  accent?: ModalAccent;
  /** Card surface; `error` tints the whole card (warning modals). */
  surface?: ModalSurface;
  children: ReactNode;
}

export interface ModalIconBadgeProps {
  /** Material Symbols glyph for the central icon. */
  icon: string;
  tone: ModalTone;
  /** Render a small check sub-badge at the bottom-right. */
  withCheck?: boolean;
}

export interface ModalIconProps {
  /** Material Symbols glyph for the central icon. */
  icon: string;
  variant: ModalIconVariant;
}

export type ModalButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ModalButtonProps {
  label: string;
  variant: ModalButtonVariant;
  onClick?: () => void;
  /** Optional trailing Material Symbols glyph. */
  trailingIcon?: string;
}

export interface ModalActionsProps {
  layout?: 'row' | 'column';
  children: ReactNode;
}

export interface QualityMeterProps {
  label: string;
  /** Right-aligned qualitative value, e.g. "Excellent". */
  value: string;
  /** Filled segment count. */
  filled: number;
  total?: number;
}

export interface CompanyDiscoverySuccessModalProps {
  /** Number of newly discovered companies. */
  count: number;
  onDismiss: () => void;
  onViewCompanies: () => void;
}

export interface ImportWarningModalProps {
  /** Number of selected companies that were all already in the pipeline. */
  count: number;
  onDismiss: () => void;
  onViewPipeline?: () => void;
}

export interface DeleteConfirmationModalProps {
  /** Number of companies pending deletion. */
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface EmptySelectionModalProps {
  /** Body copy; defaults to a generic "select at least one" message. */
  message?: string;
  onDismiss: () => void;
}

/** One email draft shown as a card in the review carousel. */
export interface EmailDraft {
  id: string;
  /** Recipient address. */
  to: string;
  subject: string;
  /** Body paragraphs, rendered in order. */
  body: string[];
}

export interface EmailDraftCarouselModalProps {
  drafts: EmailDraft[];
  /** Index of the draft currently centered/active. */
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Optional actions; each button renders only when its handler is given. */
  onDiscard?: (id: string) => void;
  onEdit?: (id: string) => void;
  /** Acknowledge the preview (does not send). */
  onApprove?: (id: string) => void;
}
