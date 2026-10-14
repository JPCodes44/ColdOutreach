# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ColdOutreach is a business-outreach pipeline (see `README.md`): review a
prospect's website, generate an evidence-backed email with an illustrative
dashboard concept, review/approve it, and send via Gmail with durable history.
It is a TypeScript monorepo with three Bun workspaces:

- `common/` (`@emailstrat/common`) — shared utilities plus `outreachEmail.ts` (content types, escaped HTML/text rendering, unsupported-claim checks).
- `backend/` (`@emailstrat/backend`) — Convex schema and functions; pure pipeline modules in `convex/outreach/`; tests in `backend/tests/`.
- `frontend/` (`@emailstrat/frontend`) — React + Vite app (Companies, Pipeline, Review, Recipients, Send, Schedule, History, Settings).

## Commands

Bun is the package manager and task runner (it reads the npm-style `workspaces` field). Run from repo root:

- `bun install --frozen-lockfile` — install all workspaces.
- `bun run setup:backend` — build common, generate Convex bindings, deploy to the ColdOutreach dev deployment.
- `bun run app` — start backend and frontend.
- `bun run test` — common + backend + frontend. `bun run lint`, `bun run format`, `bun run typecheck`, `bun run build`.
- Single package: `bun run --cwd <pkg> <script>` (e.g. `bun run --cwd backend test`).

## Backend / Convex caveat

`backend/convex/_generated/` is untracked; create it with `bun run setup:backend` (or `cd backend && bunx convex codegen`) before backend typecheck/tests. Only deploy to `jp-mak/coldoutreach` (`tremendous-beagle-451`), never EmailStrat. Secrets live only in Convex environment variables. The app has no end-user authentication.

## Frontend styling rules (enforced)

Use semantic class names in React components and keep styling in folder-local CSS files such as `src/components/outreach/styles.css` and `src/components/outreach-review/styles.css`. Avoid inline `style={{}}` objects in `src/components`. Components ≤80 lines where practical, single-responsibility, props typed in `*.types.ts`, `any` banned, each with a co-located `*.test.tsx`.

## Conventions (from AGENTS.md)

`AGENTS.md` is the canonical contributor guide; defer to it and keep it in sync with any structural or tooling changes. Key points:

- Keep provider/network I/O injected into the pure modules in `backend/convex/outreach/`; Convex actions wire real implementations.
- Name workflow steps, agents, and integrations for intent (e.g. `collectWebsiteEvidence`, `dispatchQueueItem`).
- Secrets go in environment variables, documented by name in `README.md`; never commit credentials.
- Tests accompany production code and mock network/provider calls by default for determinism.
- When adding dependencies, also commit the lockfile and note runtime requirements.
- Commits use short, imperative subject lines.
