# Gmail outreach pipeline

## Intent and scope

Refactor ColdOutreach from job applications into business outreach using the
user's supplied formula: review their website, identify lead-capture problems,
show a proposed solution, show dashboard/reporting, and start a conversation.
The user must be able to select a company, generate and review a complete email,
and send it through Gmail with durable sent history. Niche and custom system
instructions must be editable without code changes. No video pipeline.

Keep the existing React/Vite/Bun/Convex stack and the isolated
`jp-mak/coldoutreach` project. Never change EmailStrat's deployment.

## User flow

1. Discover/import companies using the existing company list, or select a saved
   company with a website. Retain manually entered recipient addresses.
2. Open Settings to save niche, service/offer description, sender display name
   and signature, and custom email instructions. Provide neutral defaults for
   lead-response automation rather than assuming healthcare. Credentials remain
   in Convex environment variables; Settings never displays or accepts secrets.
3. Select a company and run the pipeline. Show progress and actionable failures.
4. Review website evidence, identified opportunities, proposed workflow,
   illustrative dashboard, subject, and the complete email. Allow editing the
   subject and body before approving it for sending.
5. Explicitly send now or schedule the reviewed draft. Review/generation never
   sends mail. Show queued, sent, failed, and delivery-uncertain states in history.

## Automated generation

The following are proposed implementation decisions, not additional user requests:

- Retrieve the company's public website content, including a small bounded set
  of relevant contact/service pages. Record URLs and retrieval times. Keep
  timeouts, size limits, and a clear failure state; never invent a website audit
  when retrieval fails. Reject private/local addresses and unsafe redirects if
  direct fetching is used. The builder may choose supported provider URL
  grounding instead, retaining evidence and failure requirements.
- Extract visible contact methods, calls to action, forms, and business context.
  Distinguish observed facts from hypotheses. Static pages cannot establish
  actual response times, conversion losses, or internal CRM behavior.
- Produce a structured opportunity analysis and a proposed lead-response
  workflow tailored to the configured niche and offer. Website text is untrusted
  evidence, never instructions to the model or permission to invoke tools.
- Produce an email-safe HTML dashboard concept with metric labels and example
  lead stages. Mark it prominently as an illustrative proposal, not measured
  performance or an installed system. No invented uplift or real-looking results.
  This is an inline email mockup, not a separately deployed dashboard product.
- Compose a concise email with a website-specific observation, evidence-backed
  opportunity, proposed solution, the dashboard concept, and a low-pressure
  question that starts a conversation. No job-seeking or meeting demand by default.
- Render the reviewed content into both HTML and plain text. Escape model and
  user content; do not accept arbitrary generated HTML, scripts, or remote pixels.
  The plain-text alternative conveys the same findings and dashboard proposal.

Persist structured outputs and a settings snapshot/version for each run. A new
settings version affects future generations only. A failed regeneration must
not overwrite the last usable draft; prevent stale concurrent results from
replacing a newer run. Keep single-company operation first-class; existing
multi-selection can run the same bounded pipeline per company.

## Data and sending

Preserve company/contact records, prior sent history, and the existing isolated
database. Add settings, run/output, and immutable send-content fields as needed.
Use additive schema migration first; legacy résumé fields may temporarily remain
optional for existing documents, but are never generated, displayed, or attached.
Legacy job-application drafts must be marked obsolete and cannot be sent through
the new flow. Do not silently delete historical records or rewrite Git history.
Inspect pending legacy sends before rollout; prevent legacy draft dispatch and
surface them as requiring regeneration rather than silently sending them.

Queue a snapshot of approved subject, text, HTML, and recipient. Editing settings
or regenerating a draft must not change a queued email. Enforce recipient validity,
ready-draft requirements, and duplicate queue prevention in the backend.

Only Gmail SMTP acceptance marks a message sent. Keep a separate reservation for
queued recipients and release it appropriately on cancellation or definite failure.
Preserve sent subject/body, recipient, company, timestamp, and provider message
ID even if the active company or draft is removed. Claim work before dispatch to
avoid concurrent processing; ambiguous SMTP outcomes need review rather than
automatic resend. SMTP acceptance does not prove inbox delivery or opening.
Keep the test-recipient redirect, recording actual and intended recipients distinctly.

## Remove and retain

Remove résumé source/profile data, LaTeX/PDF compilation, résumé UI and attachments,
job-seeking prompts and language, and unused template-builder or mock-job features.
Retain company discovery/list, recipient editing, draft review, scheduling,
Gmail transport, usage tracking relevant to generation, and durable sent history.
Replace the placeholder Settings behavior with saved configuration. Remove unused
exports/components/tests only after checking their consumers.

The inherited lack of end-user authentication remains a documented limitation;
this scope does not claim to make the app a public multi-user service. Do not
expose environment values through settings, prompts, logs, errors, or bundles.

## Acceptance and verification

- A saved company produces a complete reviewable email containing all five
  formula elements, with no résumé or job-application content.
- Changing niche/instructions in Settings changes the next generation without
  editing code, while preserving old drafts and scheduled content.
- Retrieval failures, malformed model output, missing credentials, and provider
  errors show safe failures without fabricated evidence or leaking secrets.
- HTML and text are safe, equivalent, and include clearly labeled mock reporting.
- Sending the reviewed draft uses Gmail; queued/failed attempts are not counted
  as successful sends. Sent history survives pipeline cleanup.
- Test these behaviors with mocked provider/SMTP boundaries; run all relevant
  tests, frontend/backend type checks, build, lint, and browser review.
- A live generation may use a small number of provider calls. No external
  prospect email is sent during implementation testing. A self-addressed smoke
  email may be used within the user's earlier test authorization and labeled as a test.
- Before commit/push, scan full Git history, staged files, and the built frontend
  for secrets, including exact comparisons against configured credential values
  without displaying or persisting them.

## Delivery

Implement and validate locally, deploy only to ColdOutreach, and commit/push the
verified changes under the existing session authorization. Report test results,
any migrations performed, and limitations honestly. No video work or unsolicited
outreach is included.
