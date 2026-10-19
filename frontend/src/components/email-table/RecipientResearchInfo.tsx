import { useState } from 'react';
import { RECIPIENT_RESEARCH_SYSTEM_PROMPT } from './recipientResearchPrompt';

/** General computer-use instructions that apply to every company's email. */
export function RecipientResearchInfo() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = RECIPIENT_RESEARCH_SYSTEM_PROMPT;

  const copyPrompt = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(true);
      setShowPrompt(true);
    }
  };

  return (
    <section
      className="emailResearchInfo"
      aria-label="Free email research with Codex"
    >
      <h2>Free email research with Codex</h2>
      <p>
        Copy this general system prompt into Codex. Computer use reads each
        company's saved email draft, finds relevant people and work emails
        through the signed-in Apollo website, and fills their matching recipient
        slots.
      </p>
      <p>
        Follow the guided clicks: Apollo global search → company → Suggested
        leads → Search people / Show Filters → Access email → check Verified →
        copy into the matching slot. Role searches come from each draft.
      </p>
      <ul>
        <li>
          <strong>Email1:</strong> the most relevant senior decision-maker.
        </li>
        <li>
          <strong>Email2:</strong> a different decision-maker or department
          leader who fits the email.
        </li>
        <li>
          <strong>Email3:</strong> a hands-on specialist closest to the work
          discussed.
        </li>
      </ul>
      <div className="emailResearchActions">
        <button
          type="button"
          className="emailEnrichmentFill"
          onClick={() => void copyPrompt()}
        >
          Copy Codex prompt
        </button>
      </div>
      <p>
        The same prompt works for all companies; it contains no company list.
        Existing addresses stay in place and unknown emails stay blank. Apollo
        Access email is pre-authorized using existing credits for up to three
        contacts per company, without asking again. Save only emails Apollo
        marks Verified. No phone reveals, direct API calls, purchases, or
        upgrades. Copying does not start research.
      </p>
      {copied && (
        <p role="status">Prompt copied. Paste it into Codex to start.</p>
      )}
      {copyError && (
        <p role="alert">
          Clipboard access failed. Copy the prompt below instead.
        </p>
      )}
      <details
        open={showPrompt}
        onToggle={(event) => setShowPrompt(event.currentTarget.open)}
      >
        <summary>View Codex prompt</summary>
        <textarea
          className="emailResearchPrompt"
          aria-label="Codex research prompt"
          rows={12}
          value={prompt}
          readOnly
          onFocus={(event) => event.target.select()}
        />
      </details>
    </section>
  );
}
