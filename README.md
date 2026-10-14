# ColdOutreach

A business-outreach workspace: discover companies, review each prospect's real
website, generate an evidence-backed outreach email with an illustrative
reporting concept, review and approve it, and send it through Gmail with
durable sent history. Built with TypeScript, React/Vite, Bun, and Convex.

Every generated email follows the same formula:

1. A specific observation from the prospect's actual website.
2. An evidence-backed lead-capture opportunity (observations are kept separate
   from hypotheses; nothing is invented).
3. A proposed solution tied to your configured offer.
4. A clearly labeled **illustrative** dashboard/reporting concept (labels and
   example stages only, no values or results).
5. A low-pressure question that starts a conversation.

| Workspace   | Package                | Responsibility                                                        |
| ----------- | ---------------------- | --------------------------------------------------------------------- |
| `common/`   | `@emailstrat/common`   | Shared utilities, outreach email content types, safe HTML/text render |
| `backend/`  | `@emailstrat/backend`  | Convex schema, website review pipeline, send queue, Gmail dispatch    |
| `frontend/` | `@emailstrat/frontend` | React + Vite app                                                      |

The workspace package names remain `@emailstrat/*` for import compatibility.

## Using the app

1. **Settings** — save your niche, offer/service description, sender display
   name, signature, and any custom email instructions. Each save creates a new
   version that applies to future pipeline runs only; existing drafts and queued
   emails never change. Credentials are never entered or shown here.
2. **Companies** — discover companies (Gemini with Google Search grounding,
   steered by your saved niche/offer) and import them into the pipeline.
3. **Pipeline** — select one or more companies (up to 10 at a time) and run the
   pipeline. It retrieves the company's homepage and up to three relevant
   same-site pages (contact, booking, quote, services), extracts contact methods,
   forms, calls to action, and chat/booking widgets as numbered evidence, then
   analyzes and composes the email. Progress is shown per stage. Generating a
   draft never sends email.
4. **Review** — inspect sources (with retrieval times), observed facts vs.
   hypotheses, the proposed workflow, and the dashboard concept. Edit the
   subject, opening, closing, and signature, preview the HTML and plain-text
   versions, then **Approve**. Any later edit withdraws approval.
5. **Recipients** — enter up to three recipient addresses per company.
6. **Send** → **Schedule** — choose approved companies, pick a time (or
   immediately) and delivery method. Scheduling stores an immutable snapshot of
   the approved subject, text, and HTML for each recipient.
7. **History** — follow queued, sending, sent, failed, canceled, and
   uncertain sends; cancel queued sends; resolve uncertain ones; open the exact
   content of any sent email.

### Sending semantics

- A message is marked **sent** only after Gmail's SMTP server accepts it. That
  proves acceptance, not inbox delivery or opening.
- Each queue row is atomically claimed before Gmail is contacted, so a row is
  dispatched at most once even if its scheduled function runs twice.
- Definite failures (rejections, authentication or configuration errors,
  connection failures before message data) are marked **failed** and release the
  recipient so it can be deliberately re-queued.
- If the connection breaks while or after message data is sent, the outcome is
  **uncertain**: it is never retried automatically. Check the Gmail Sent folder,
  then mark it "sent" or "not sent" in History.
- Active rows (queued, sending, uncertain) reserve their recipient and company;
  the backend rejects duplicates. Accepted sends are recorded in the
  `emailedRecipients`/`emailedCompanies` ledgers and in `sentEmails`, which keeps
  subject, text, HTML, intended and actual recipient, timestamp, and Gmail
  message ID even after the company, draft, or queue rows are removed.
- `GMAIL_REDIRECT_TO` redirects every send to a test inbox, labels it with the
  intended recipient, and records intended and actual recipients separately.

### Website review safeguards

- Only public `http(s)` hosts on standard ports are fetched. Hostnames are
  resolved and private, loopback, link-local, and reserved addresses are
  rejected, including on every redirect hop. Requests have timeouts, a response
  size cap, a redirect limit, and HTML-only content checks.
- If the homepage cannot be retrieved (or is an empty JavaScript shell), the run
  fails with a clear reason; no audit is invented. A failed run never replaces
  the last usable draft, and an older run can never overwrite a newer draft.
- Website text is passed to the model only as delimited, untrusted data.
- Every observation and opportunity must cite existing evidence IDs. Items that
  do not, and any unhedged figures, loss claims, or claims about invisible
  back-office processes (acknowledgements, follow-up, response speed, CRM), are
  rejected; the composer gets one retry with feedback before the run fails.
- Email HTML is generated only from escaped text in a fixed, table-based layout
  with inline styles: no model-supplied HTML, links, scripts, or images.

## Prerequisites

- [Bun](https://bun.sh) `>= 1.2` — package manager and task runner.

## Install and run

```bash
bun install --frozen-lockfile
bun run setup:backend   # build common, generate bindings, deploy functions
bun run app             # start backend and frontend
```

### Isolated ColdOutreach backend

ColdOutreach uses its own Convex project, separate from EmailStrat:

- Project: `jp-mak/coldoutreach`
- Development deployment: `tremendous-beagle-451` (Canada Central)
- Dashboard: https://dashboard.convex.dev/t/jp-mak/coldoutreach

The URL and deployment name are public identifiers, not secrets. For an
authorized collaborator using this deployment:

```bash
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
bun run setup:backend
bun run app
```

Run Convex commands from `backend/`, never the repository root. The local
`.env.local` files and generated Convex code are excluded from Git. For your own
separate deployment, build `common/`, then run
`bunx convex dev --configure new --dev-deployment cloud --once` from `backend/`
and set `frontend/.env.local` to the resulting `CONVEX_URL`.

### Server-side integration settings

Set these in the **ColdOutreach** Convex dashboard's environment settings:

| Variable                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY`        | Website analysis and email composition               |
| `OPENAI_OUTREACH_MODEL` | Optional model override (default `gpt-4o-mini`)      |
| `GEMINI_API_KEY`        | Company discovery (Google Search grounding)          |
| `GEMINI_API_KEY_PAID`   | Optional paid Gemini fallback                        |
| `GEMINI_RESEARCH_MODEL` | Optional discovery model override                    |
| `GMAIL_USER`            | Gmail sending account                                |
| `GMAIL_APP_PASSWORD`    | Gmail app password (requires 2-Step Verification)    |
| `GMAIL_FROM`            | Optional sender display name                         |
| `GMAIL_REDIRECT_TO`     | Optional test inbox that receives every send instead |

Never put provider keys, Gmail passwords, or Convex deploy keys in `VITE_*`
variables: Vite embeds those variables in the browser bundle. The frontend needs
only `VITE_CONVEX_URL`. Use the dashboard or the CLI's interactive
`bunx convex env set NAME` prompt rather than putting secrets in shell commands.

### Self-test send

To check rendering in a real inbox without contacting a prospect, send a
labeled copy of a company's current draft to the configured `GMAIL_USER` only:

```bash
cd backend
bunx convex run sendActions:sendSelfTest '{"companyId":"example.com"}'
```

Self-tests are marked as tests in History and excluded from the contact ledgers.

### Data migration

The refactor is additive. Legacy job-application artifacts remain readable in
the `artifacts` table (résumé fields optional) but are never generated,
displayed, attached, or sent. Before rollout on a deployment with older data:

```bash
cd backend
bunx convex run migrations:legacyInventory      # count legacy artifacts and pending legacy sends
bunx convex run migrations:retireLegacyJobData  # mark artifacts obsolete, block legacy sends
```

Independently of the migration, the dispatcher refuses any queue row without an
approved snapshot and marks it `legacy-blocked`, so legacy drafts cannot be sent.

### Security boundaries and checks

This app has **no user authentication or per-user authorization** on its public
Convex functions. Treat it as a single-operator development tool; anyone who
knows the deployment URL can call its functions (including queueing sends for
approved drafts). Add authentication and authorization before deploying it for
business users or multiple users, or storing sensitive customer information.
Keeping API keys server-side does not prevent anonymous callers from invoking
public functions. Settings reject values that look like credentials.

Before pushing, scan the complete Git history with Gitleaks and scan an export
of the staged files separately:

```bash
gitleaks git --redact --log-opts="--all" .
staged_dir=$(mktemp -d)
git checkout-index --all --prefix="$staged_dir/"
gitleaks dir --redact "$staged_dir"
```

Also scan `frontend/dist` after building and check that local environment files
remain ignored. Secret scanners detect known patterns; a clean scan is not a
proof that every possible secret or security issue is absent. If a real secret
is found in history, revoke it before considering history cleanup.

## Quality checks

```bash
bun run test           # common + backend (vitest, convex-test) + frontend (vitest + RTL)
bun run lint           # ESLint across the repo (bans `any`)
bun run format         # Prettier write
bun run format:check   # Prettier check (CI)
bun run typecheck      # common + backend + frontend type checks
bun run build          # build common, then frontend
```

Backend type checks and tests need the generated Convex bindings
(`backend/convex/_generated/`); run `bun run setup:backend` or
`cd backend && bunx convex codegen` once after cloning. Backend tests mock all
network, model, and SMTP boundaries; scheduled functions never fire on their own.

Run a single package's tasks with `--cwd`, e.g.:

```bash
bun run --cwd backend test
bun run --cwd frontend test:watch
```

## Layout

```
common/src/        utils + outreachEmail (content types, escaped HTML/text, claim checks)
backend/convex/    schema, settings, outreachRuns (+ outreachPipeline action),
                   send (queue/ledgers/history) + sendActions (Gmail), companies,
                   emails, migrations, usageDb
backend/convex/outreach/  runtime-agnostic pipeline modules: websiteEvidence,
                   prompts, modelOutput, pipeline, dispatch, smtpOutcome, settingsModel
backend/tests/     backend tests (pure modules + convex-test integration)
frontend/src/      React app; components/<feature>/ with folder-local styles.css
```

## Frontend conventions

- React components use semantic class names rather than inline `style={{}}`.
- Styles for a component family live in that folder's `styles.css`.
- Components are small (≤80 lines where practical) and single-responsibility.
- Props are typed in the folder's `types.ts`; `any` is banned.
- Every component has a co-located `*.test.tsx` (React Testing Library).
