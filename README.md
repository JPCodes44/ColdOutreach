# ColdOutreach

A cold outreach workspace for prospect research, personalized email generation,
and scheduled outreach, built with TypeScript, React, and Convex.

Build email templates from typed blocks (text, image, button, divider), validate
them, and render them to HTML. The repo is split into three workspaces:

| Workspace   | Package                | Responsibility                                            |
| ----------- | ---------------------- | --------------------------------------------------------- |
| `common/`   | `@emailstrat/common`   | Shared domain types + utilities (validate, render, fetch) |
| `backend/`  | `@emailstrat/backend`  | Convex backend (schema + template CRUD functions)         |
| `frontend/` | `@emailstrat/frontend` | React + Vite app (File Tree component + styling system)   |

## Prerequisites

- [Bun](https://bun.sh) `>= 1.2` — package manager and task runner.

## Install

Bun reads the npm-style `workspaces` field in the root `package.json`, so a single
install at the root wires up all three packages:

```bash
bun install
```

## Develop

```bash
bun run app            # start the web app
bun run dev:backend    # start Convex (see note below)
```

### Isolated ColdOutreach backend

ColdOutreach uses its own Convex project, separate from EmailStrat:

- Project: `jp-mak/coldoutreach`
- Development deployment: `tremendous-beagle-451` (Canada Central)
- Dashboard: https://dashboard.convex.dev/t/jp-mak/coldoutreach

All tables, generated files in Convex storage, usage records, and scheduled
functions use this deployment. No original database records or scheduled sends
are imported. The URL and deployment name are public identifiers, not secrets.
The workspace package names remain `@emailstrat/*` for import compatibility.

For an authorized collaborator using this deployment:

```bash
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
bun run setup:backend
bun run app
```

`setup:backend` builds the shared package before generating and deploying the
Convex functions. Run Convex commands from `backend/`, never the repository root.
The local `.env.local` files and generated Convex code are excluded from Git.
For your own separate deployment, build `common/`, then run
`bunx convex dev --configure new --dev-deployment cloud --once` from `backend/`
and set `frontend/.env.local` to the resulting `CONVEX_URL`.

### Server-side integration settings

Set these in the **ColdOutreach** Convex dashboard's environment settings:

| Variable                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `GEMINI_API_KEY`        | Company research and subject generation            |
| `GEMINI_API_KEY_PAID`   | Optional paid Gemini fallback                      |
| `OPENAI_API_KEY`        | Email/resume generation and subject fallback       |
| `GMAIL_USER`            | Gmail sending account                              |
| `GMAIL_APP_PASSWORD`    | Gmail app password (requires 2-Step Verification)  |
| `GMAIL_FROM`            | Optional allowed sender display name               |
| `GMAIL_REDIRECT_TO`     | Optional test inbox for redirecting scheduled mail |
| `GEMINI_RESEARCH_MODEL` | Optional research model override                   |
| `GEMINI_SUBJECT_MODEL`  | Optional subject model override                    |

Never put provider keys, Gmail passwords, or Convex deploy keys in `VITE_*`
variables: Vite embeds those variables in the browser bundle. The frontend needs
only `VITE_CONVEX_URL`. Use the dashboard or the CLI's interactive
`bunx convex env set NAME` prompt, rather than putting secrets in shell commands.
Do not copy credentials automatically from another project.

No emails are sent merely by provisioning the backend. Use `GMAIL_REDIRECT_TO`
for send testing before scheduling real outreach.

### Security boundaries and checks

This inherited app currently has no user authentication or per-user authorization
on its public Convex functions. Treat it as a single-user development tool;
add authentication and authorization before deploying it for business users or
storing sensitive customer information. Keeping API keys server-side does not
prevent anonymous callers from invoking public functions.

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
bun run test           # common (vitest) + frontend (vitest + RTL)
bun run lint           # ESLint across the repo (bans `any`)
bun run format         # Prettier write
bun run format:check   # Prettier check (CI)
bun run typecheck      # common + frontend type checks
bun run build          # build common, then frontend
```

Run a single package's tasks with `--cwd`, e.g.:

```bash
bun run --cwd common test
bun run --cwd frontend test:watch
```

## Layout

```
common/   shared types + utils (built to dist/, consumed via @emailstrat/common)
backend/  convex/ schema.ts + templates.ts (CRUD)
frontend/ src/ — theme.ts, components/outreach/styles.css, components/jobs/styles.css
```

## Frontend conventions

The frontend keeps component styling in folder-local stylesheets:

- React components should use semantic class names rather than inline
  `style={{}}` objects.
- Styles for a component family live in that folder, for example
  `frontend/src/components/outreach/styles.css` and
  `frontend/src/components/jobs/styles.css`.
- Components are small (≤80 lines) and single-responsibility.
- Props are typed via interfaces in `*.types.ts`; `any` is banned.
- Every component has a co-located `*.test.tsx` (React Testing Library).
