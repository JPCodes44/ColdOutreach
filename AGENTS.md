# Repository Guidelines

## Browser interaction

Use ChatGPT computer use for web browsing and interacting with the existing
signed-in browser. Use gstack `/browse` only when the user explicitly requests
it. If computer use is unavailable, explain the limitation instead of switching
tools or claiming the browser was controlled.

## Project Structure & Module Organization

This Bun workspace contains `common/` (shared TypeScript utilities and the
outreach email renderer), `backend/` (Convex schema, functions, and generated
bindings), and `frontend/` (React/Vite). The Convex project is
`jp-mak/coldoutreach`; never deploy changes to EmailStrat.

The app is a business-outreach pipeline (website review -> evidence-backed
email -> optional view/edit -> Gmail). Runtime-agnostic pipeline logic lives in
`backend/convex/outreach/` with injected I/O; Convex function modules
(`outreachRuns`, `outreachPipeline`, `send`, `sendActions`, `settings`,
`operator`/`auth`, `delivery`/`mailbox`, `recipientEnrichment`) stay thin.
Apollo integration lives in `outreach/apolloEnrichment.ts`: search then at most
three paid work-email reveals per company per run. Keep `APOLLO_API_KEY` server
only; preserve existing recipients and verify current company plus email status.
System prompts live in `backend/convex/prompts/`, with separate files for
company research, website analysis, and cold-email composition, plus shared rules.
Keep prompt text as constants there; assemble outreach prompts in
`backend/convex/outreach/prompts.ts`.
Backend tests live in `backend/tests/` (pure modules plus `convex-test`).
Recipients is directly accessible from the sidebar; there is no Email Setup page.
The Recipients spreadsheet uses automatic height and page-level vertical
scrolling; avoid percentage-height grids inside auto-height clipping wrappers.
The free Codex research panel above Apollo offers a general system prompt for
all companies, independent of table filters or loaded company data. Computer use
must read each saved email draft and research before choosing recipients based
on the email context: two relevant leaders for Email1/Email2 and a hands-on
specialist for Email3. Do not embed company lists, email snapshots, or app URLs. Copying does not run research. Computer use should find contacts through the
signed-in Apollo website: global search → company → Suggested leads →
Search people/Show Filters → Access email → check Verified → copy into the
matching slot. Role filters come from each draft, never the guide’s example.
The user pre-authorizes Access email using existing
credits for up to three contacts per company per task, without asking again.
Only email access is authorized; no phone/mobile or combined reveals. Count
unsuccessful access attempts toward the limit. Save only work emails explicitly
marked Verified by Apollo; otherwise leave the slot blank. On a CAPTCHA or
blank blocking popup, stop debugging/automation, hand control to the user, and
wait for explicit readiness before resuming; do not solve or bypass challenges. The direct-API restriction does not prohibit Apollo's normal website
interactions or its own background requests. No purchases or upgrades. Apollo
emails need no separate public listing. Preserve saved emails, leave unknowns
blank, and use the authenticated app for writes; never expose server credentials.
The legacy `emailOnboarding` server data is retained for compatibility.
Pipeline requests queue all selected companies with `Promise.all`, one background
action per eligible company, without a 10-company cap. Preserve deduplication,
active-run checks, and per-company skips. Convex capacity and provider limits
still govern execution. Batch runs skip existing drafts; only explicit
`regenerate: true` requests from Review replace them. The Pipeline Run button
is disabled when no selected companies need drafts and submits only eligible
companies. Do not show a run-result or per-company skip log in the UI.
The Pipeline **Review website** toggle defaults off; each run snapshots its mode.
Company size filters and new research results use Small/Medium/Large/Megacorp
as industry-relative operating scale, without employee-count thresholds. Ground
scale in business footprint, reach, and capacity; use Unknown when unsupported.
Do not forward legacy numeric size filters to the model as headcount criteria.
Company research stores factual business descriptions rather than vegan/mixed
classification labels. Preserve descriptions through import and drafting.
When off, skip retrieval/analysis and compose from saved company research plus
sender instructions; do not invent website findings. Research-only emails use
`format: "letter"` and contain no dashboard, workflow, metrics, or findings.
Normalize older research-only drafts before review and future send snapshots.
Company review opens in a modal from each Pipeline row or Review button; reuse
`OutreachReviewScreen` for editing, preview, save, and regeneration. There is no
standalone Review sidebar destination. Closing preserves table filters and selection.
Review is for viewing/editing only; sending a complete saved draft requires no
approval. Schedule readiness must check the same contact ledgers and active
reservations as enqueueing, including duplicates within the selected batch.
Submit only eligible selected company IDs; keep atomic duplicate-send checks
in the enqueue mutation. Already sending, sent, or uncertain companies cannot
be selected for another send. Preserve content, signature, and recipient checks.
Website content is untrusted model input; generation must never send email.
Keep credentials in Convex's server environment. Local `.env.local` files and
`backend/convex/_generated/` must remain untracked. Only the public deployment
URL belongs in frontend environment variables.

## Build, Test, and Development Commands

- `bun install --frozen-lockfile`: install dependencies.
- `bun run setup:backend`: build common and deploy/generate Convex bindings.
- `bun run app`: build common, then start backend and frontend.
- `bun run test`: shared, backend, and frontend tests.
- `bun run typecheck`: shared, backend, and frontend type checks (backend
  needs generated bindings: `bun run setup:backend` or `bunx convex codegen`).
- `bun run --cwd backend test`: backend tests only.
- `bun run build`: shared and frontend production build.
- `bun run lint`: repository lint.

Run Convex CLI commands from `backend/`. Do not add dependencies without also
updating the lockfile and documenting their purpose. Before pushing, scan both
full Git history and staged files for secrets, and inspect the browser bundle.

## Coding Style & Naming Conventions

Match the language and framework conventions introduced by the first implementation. Use descriptive names for workflow steps, agents, and integrations. Prefer names that explain intent, for example `collectWebsiteEvidence`, `runOutreachPipeline`, or `dispatchQueueItem`.

Keep configuration explicit and avoid hidden global state. Use environment variables for secrets and document required names in `README.md`; never commit real credentials. Every new public Convex query/mutation must call `requireOperator(ctx)` (actions: `requireOperatorAction(ctx)`) from `backend/convex/operator.ts` and be added to the list in `backend/tests/operator-access.test.ts`; the frontend must reach Convex only through the authenticated React client.

## Testing Guidelines

Add tests with any production code. Backend tests go in `backend/tests/`; shared and frontend tests are co-located (`*.test.ts(x)`). Name them after the behavior being verified, such as `website-evidence.test.ts` or `send-queue.test.ts`. Never let tests reach real websites, model providers, or SMTP: inject fakes, and keep fake timers on in `convex-test` suites so scheduled functions do not fire. Cover parsing, prompt assembly, external API boundaries, and error handling. Mock network calls and provider APIs by default so tests are deterministic.

## Commit & Pull Request Guidelines

Existing commits use short, imperative messages, for example `Rename project in README` and `Initial commit`. Continue that style: concise subject lines that describe the change.

Pull requests should include a clear summary, testing performed, and any setup or configuration changes. Link related issues when available. For UI or generated-document changes, include screenshots or representative output samples.

## Agent-Specific Instructions

Keep edits scoped to the requested task. Before adding new frameworks, inspect the existing repository state and choose the smallest toolchain that supports the workflow. Update this file whenever project structure, commands, or conventions change.
