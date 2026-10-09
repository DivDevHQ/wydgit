# Repository agent instructions

## Read before editing

- Treat `docs/DEVELOPMENT.md` as committed repository-wide engineering policy.
- Read `docs/FOUNDING-ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`, and the
  milestone/API documents relevant to the task before changing behavior.
- Inspect `git status`, the current branch, and recent history. Work on the active
  development branch, preserve unrelated local changes, and do not rewrite history.
- Do not modify downstream/reference projects. Do not commit, push, tag, publish,
  release, or deploy unless the user explicitly requests that action.

## Project map

- `app.js` composes Wydgine; `server.js` validates/starts the host and handles signals.
- `wydgine/` contains rendering, repository loading, object-model/mutation, SEAM,
  library dispatch, events, Page/Session execution, and safe HTTP facades.
- `wydgine/http/transport/hono.js` is the replaceable Node HTTP host adapter.
- `wydclient/` owns client lifecycle, semantic host-event adaptation and presentation.
- `packages/wydstore` and `packages/wydgate` are independently versioned canonical
  npm workspace libraries; `packages/test-library` is a non-production fixture.
- `content/`, `prototypes/`, and `public/css/` hold the demo and presentation assets.
- `test/` uses Node's built-in test runner; shared fixtures live in `test-support/`.

## Architecture and security

- Preserve KISS/KICK and use existing abstractions before adding parallel systems.
- Wydgine owns server execution/transport; WydClient owns client adaptation;
  SEAM owns authority. Identity and application permissions do not grant capabilities.
- Keep canonical state and ordinary Wydgit code semantic and renderer-independent.
  Never expose raw Node, DOM, filesystem, process, SQL, arbitrary package access,
  Hono contexts, native requests/responses, sockets, or middleware through facades.
- Keep Hono imports and host responsibilities inside the transport adapter.
  Preserve safe REQUEST/RESPONSE/EVENT, request-local Page isolation, lifecycle
  ordering/cleanup, CSRF, cookie scopes, protected headers, and file restrictions.
- Keep public APIs small. Do not add unrequested language, session, event, renderer,
  persistence, transport, or runtime features during a narrow milestone.

## Commands and dependencies

- Use Node.js >=22.12.0 and npm, as declared in `package.json` and `.npmrc`.
- Install from the committed lockfile with `npm ci`; use npm workspace identities
  rather than relative paths into package implementation code.
- Preserve engine-strict, engine requirements, and the pinned approved native
  install-script policy in `package.json`. Add only task-required dependencies.
- Run `npm test` and `npm run check` after final edits. Retain real TCP coverage
  for HTTP work; sandboxed listeners may require execution approval.
- `npm start` runs the host; `npm run dev` enables Node watch mode.

## Versions and delivery

- Keep root `package.json`, root lockfile metadata, `content/app.json` revision,
  and intentional current-version tests/docs synchronized when bumping the platform.
- Bump workspace library versions only when their own contracts change. Preserve
  historical milestone versions and valid minimum platform compatibility ranges.
- Update `CHANGELOG.md` and affected documentation to describe actual behavior,
  compatibility implications, tests run, and remaining limitations.
- Before reporting completion, inspect status, full diff, diff statistics, and
  `git diff --check`. Ensure no unrelated files, secrets, test databases, or artifacts
  remain. Distinguish automated HTTP verification from manual browser verification.
- Leave changes uncommitted for review unless explicitly instructed otherwise.
