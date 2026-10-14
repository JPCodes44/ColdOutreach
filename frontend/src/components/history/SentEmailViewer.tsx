import { formatTime } from './status';
import type { SentEmailViewerProps } from './types';

/** Read-only view of the exact stored subject, text, and HTML that was sent. */
export function SentEmailViewer({ email, onClose }: SentEmailViewerProps) {
  return (
    <div className="historyOverlay" role="presentation" onClick={onClose}>
      <div
        className="historyViewer"
        role="dialog"
        aria-modal="true"
        aria-label="Sent email"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="historyViewerHeader">
          <h2 className="historyCardTitle">
            {email ? email.subject : 'Loading…'}
          </h2>
          <button className="historyAction" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {email === null ? (
          <p className="historyEmpty">This email could not be found.</p>
        ) : null}
        {email ? (
          <div className="historyViewerBody">
            <p className="historyMeta">
              {email.companyName} · to {email.intendedTo}
              {email.actualTo !== email.intendedTo
                ? ` (delivered to ${email.actualTo})`
                : ''}{' '}
              · {formatTime(email.sentAt)}
            </p>
            <iframe
              className="historyFrame"
              title="Sent HTML email"
              sandbox=""
              srcDoc={email.html}
            />
            <h3 className="historySectionLabel">Plain-text version</h3>
            <pre className="historyText">{email.text}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
