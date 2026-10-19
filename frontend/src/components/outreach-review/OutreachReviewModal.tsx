import { useEffect, useRef } from 'react';
import { ModalOverlay } from '../modals/ModalOverlay';
import { Icon } from '../outreach/Common';
import { OutreachReviewScreen } from './OutreachReviewScreen';

interface Props {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

/** The complete company review, opened over the pipeline table. */
export function OutreachReviewModal({
  companyId,
  companyName,
  onClose,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <ModalOverlay
      size="xl"
      ariaLabel={`Review ${companyName}`}
      onDismiss={onClose}
    >
      <div
        ref={panel}
        className="pipelineReviewModal"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], iframe, summary, [tabindex="0"]',
          );
          const first = controls?.[0];
          const last = controls?.[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="pipelineReviewModalToolbar">
          <button
            ref={closeButton}
            type="button"
            className="reviewSecondaryButton"
            onClick={onClose}
            aria-label="Close review"
          >
            <Icon name="close" size={18} />
            Close
          </button>
        </div>
        <div className="pipelineReviewModalContent">
          <OutreachReviewScreen key={companyId} companyId={companyId} />
        </div>
      </div>
    </ModalOverlay>
  );
}
