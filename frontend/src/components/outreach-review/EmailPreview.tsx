import { useMemo, useState } from 'react';
import {
  renderOutreachHtml,
  renderOutreachText,
  sanitizeSubject,
} from '@emailstrat/common';
import type { EmailPreviewProps } from './types';

/** HTML (sandboxed, scriptless) and plain-text previews of the current edits. */
export function EmailPreview({ content }: EmailPreviewProps) {
  const [tab, setTab] = useState<'html' | 'text'>('html');
  const html = useMemo(() => renderOutreachHtml(content), [content]);
  const text = useMemo(() => renderOutreachText(content), [content]);
  return (
    <section className="reviewCard reviewPreview" aria-label="Email preview">
      <div className="reviewTabs" role="tablist" aria-label="Preview format">
        {(['html', 'text'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`reviewTab ${tab === value ? 'reviewTabActive' : ''}`}
            onClick={() => setTab(value)}
          >
            {value === 'html' ? 'HTML' : 'Plain text'}
          </button>
        ))}
      </div>
      <p className="reviewPreviewSubject">
        <span className="reviewMuted">Subject:</span>{' '}
        {sanitizeSubject(content.subject)}
      </p>
      {tab === 'html' ? (
        <iframe
          className="reviewPreviewFrame"
          title="HTML email preview"
          sandbox=""
          srcDoc={html}
        />
      ) : (
        <pre className="reviewPreviewText">{text}</pre>
      )}
    </section>
  );
}
