import { ModalOverlay } from './ModalOverlay';
import { Icon } from '../outreach/Common';
import type { EmailDraft, EmailDraftCarouselModalProps } from './types';

interface EmailDraftCardProps {
  draft: EmailDraft;
  variant: 'active' | 'peek';
  /** "Reviewing 2 of 45" badge, shown on the active card only. */
  position?: string;
  onDiscard?: () => void;
  onEdit?: () => void;
  onApprove?: () => void;
}

/** Footer actions for the active card; each renders only when wired up. */
function EmailDraftActions({
  onDiscard,
  onEdit,
  onApprove,
}: Pick<EmailDraftCardProps, 'onDiscard' | 'onEdit' | 'onApprove'>) {
  return (
    <footer className="emailCardFooter">
      {onDiscard !== undefined ? (
        <button
          type="button"
          className="emailCardBtn emailCardBtn-discard"
          onClick={onDiscard}
        >
          <Icon name="delete" size={18} />
          Discard
        </button>
      ) : (
        <span />
      )}
      <div className="emailCardFooterRight">
        {onEdit !== undefined ? (
          <button
            type="button"
            className="emailCardBtn emailCardBtn-edit"
            onClick={onEdit}
          >
            <Icon name="edit" size={18} />
            Edit
          </button>
        ) : null}
        {onApprove !== undefined ? (
          <button
            type="button"
            className="emailCardBtn emailCardBtn-approve"
            onClick={onApprove}
          >
            <Icon name="check" size={18} />
            Looks good
          </button>
        ) : null}
      </div>
    </footer>
  );
}

/** A single email-draft card (the centered active one, or a dimmed peek). */
function EmailDraftCard({
  draft,
  variant,
  position,
  ...actions
}: EmailDraftCardProps) {
  return (
    <article
      className={`emailCard emailCard-${variant}`}
      aria-hidden={variant === 'peek'}
    >
      {position !== undefined ? (
        <span className="emailCardBadge">{position}</span>
      ) : null}
      <header className="emailCardHeader">
        <div className="emailCardField">
          <span className="emailCardLabel">To:</span>
          <span className="emailCardTo">{draft.to}</span>
        </div>
        <div className="emailCardField">
          <span className="emailCardLabel">Subject:</span>
          <span className="emailCardSubject">{draft.subject}</span>
        </div>
      </header>
      <div className="emailCardBody">
        {draft.body.map((paragraph, index) => (
          <p key={index} className="emailCardParagraph">
            {paragraph}
          </p>
        ))}
      </div>
      {variant === 'active' ? <EmailDraftActions {...actions} /> : null}
    </article>
  );
}

/** Horizontal carousel previewing one email per recipient. Never sends. */
export function EmailDraftCarouselModal({
  drafts,
  activeIndex,
  onPrev,
  onNext,
  onClose,
  onDiscard,
  onEdit,
  onApprove,
}: EmailDraftCarouselModalProps) {
  const active = drafts[activeIndex];
  if (active === undefined) return null;
  const prev = drafts[activeIndex - 1];
  const next = drafts[activeIndex + 1];

  return (
    <ModalOverlay size="xl" ariaLabel="Review email drafts" onDismiss={onClose}>
      <div className="emailCarousel">
        <button
          type="button"
          className="emailCarouselClose"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>
        <button
          type="button"
          className="emailCarouselNav emailCarouselNav-prev"
          aria-label="Previous draft"
          onClick={onPrev}
          disabled={activeIndex === 0}
        >
          <Icon name="chevron_left" size={24} />
        </button>
        <div className="emailCarouselTrack">
          {prev !== undefined ? (
            <EmailDraftCard draft={prev} variant="peek" />
          ) : (
            <div className="emailCardSpacer" aria-hidden="true" />
          )}
          <EmailDraftCard
            draft={active}
            variant="active"
            position={`Reviewing ${activeIndex + 1} of ${drafts.length}`}
            onDiscard={onDiscard && (() => onDiscard(active.id))}
            onEdit={onEdit && (() => onEdit(active.id))}
            onApprove={onApprove && (() => onApprove(active.id))}
          />
          {next !== undefined ? (
            <EmailDraftCard draft={next} variant="peek" />
          ) : (
            <div className="emailCardSpacer" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          className="emailCarouselNav emailCarouselNav-next"
          aria-label="Next draft"
          onClick={onNext}
          disabled={activeIndex === drafts.length - 1}
        >
          <Icon name="chevron_right" size={24} />
        </button>
      </div>
    </ModalOverlay>
  );
}
