import { ModalOverlay } from './ModalOverlay';
import { ModalCard } from './ModalCard';
import { ModalIcon } from './ModalIcon';
import { ModalActions } from './ModalActions';
import { ModalButton } from './ModalButton';
import type { DeleteConfirmationModalProps } from './types';

/** Destructive confirmation before removing companies and their drafts. */
export function DeleteConfirmationModal({
  count,
  target = 'companies',
  onCancel,
  onConfirm,
}: DeleteConfirmationModalProps) {
  const noun = count === 1 ? 'company' : 'companies';
  const draftsOnly = target === 'drafts';
  return (
    <ModalOverlay ariaLabel="Confirm delete" onDismiss={onCancel}>
      <ModalCard>
        <div className="modalContent">
          <ModalIcon icon="delete" variant="danger" />
          <h2 className="modalTitleSm">
            {draftsOnly
              ? `Delete drafts for ${count} ${noun}?`
              : `Delete ${count} ${noun}?`}
          </h2>
          <p className="modalBody">
            {draftsOnly
              ? 'This removes generated drafts for the selected companies. Companies, research, recipients, and sent email history are kept. This can’t be undone.'
              : `This removes the selected ${noun}, their generated drafts, and run history. Sent email history is kept. This can't be undone.`}
          </p>
          <ModalActions layout="row">
            <ModalButton
              label="Cancel"
              variant="secondary"
              onClick={onCancel}
            />
            <ModalButton
              label={draftsOnly ? 'Delete drafts' : 'Delete'}
              variant="danger"
              onClick={onConfirm}
            />
          </ModalActions>
        </div>
      </ModalCard>
    </ModalOverlay>
  );
}
