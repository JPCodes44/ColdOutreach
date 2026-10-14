# Repository Guidelines

## Project Structure & Module Organization

This Bun workspace contains `common/` (shared TypeScript utilities), `backend/`
(Convex schema, functions, and generated bindings), and `frontend/` (React/Vite).
The Convex project is `jp-mak/coldoutreach`; never deploy changes to EmailStrat.
Keep credentials in Convex's server environment. Local `.env.local` files and
`backend/convex/_generated/` must remain untracked. Only the public deployment
URL belongs in frontend environment variables.

## Build, Test, and Development Commands

- `bun install --frozen-lockfile`: install dependencies.
- `bun run setup:backend`: build common and deploy/generate Convex bindings.
- `bun run app`: build common, then start backend and frontend.
- `bun run test`: shared and frontend tests.
- `bun run typecheck`: shared and frontend type checks.
- `bun run --cwd backend typecheck`: backend type check after code generation.
- `bun run build`: shared and frontend production build.
- `bun run lint`: repository lint.

Run Convex CLI commands from `backend/`. Do not add dependencies without also
updating the lockfile and documenting their purpose. Before pushing, scan both
full Git history and staged files for secrets, and inspect the browser bundle.

## Coding Style & Naming Conventions

Match the language and framework conventions introduced by the first implementation. Use descriptive names for workflow steps, agents, and integrations. Prefer names that explain intent, for example `resume_tailor`, `job_source_client`, or `cover_letter_workflow`.

Keep configuration explicit and avoid hidden global state. Use environment variables for secrets and document required names in `README.md`; never commit real credentials.

## Testing Guidelines

Add tests with any production code. Place tests in `tests/` and name them after the behavior being verified, such as `test_resume_tailor.py` or `job-source-client.test.ts`. Cover parsing, prompt assembly, external API boundaries, and error handling. Mock network calls and provider APIs by default so tests are deterministic.

## Commit & Pull Request Guidelines

Existing commits use short, imperative messages, for example `Rename project in README` and `Initial commit`. Continue that style: concise subject lines that describe the change.

Pull requests should include a clear summary, testing performed, and any setup or configuration changes. Link related issues when available. For UI or generated-document changes, include screenshots or representative output samples.

## Agent-Specific Instructions

Keep edits scoped to the requested task. Before adding new frameworks, inspect the existing repository state and choose the smallest toolchain that supports the workflow. Update this file whenever project structure, commands, or conventions change.
