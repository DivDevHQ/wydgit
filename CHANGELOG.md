# Changelog

All notable changes to Wydgit are documented in this file.

Wydgit is currently in early alpha development. Until 1.0, milestones may include
breaking architectural changes.

## Unreleased

## 0.2.0-alpha.11 — 0.2-K
### WydBASIC Compiler Foundation

- Added a separate hand-written tokenizer, located AST/parser and semantic compiler
  for the first WydStitch dialect; output is frozen, validated canonical `sewn/0.1`.
- Implemented case-insensitive keywords/identifiers, DIM with types/inference,
  assignment/SET, scalar/array/object literals, strict structured expressions,
  IF/ELSE/ELSEIF, bounded FOR EACH, RETURN/STOP and allowlisted member/method calls.
- Added structured source-location diagnostics, name/type checking, deterministic
  lowering and explicit rejection of unsupported syntax and dangerous members.
- Integrated exclusive `run`/`workflow`/`wydBasic` event/action registration;
  HTTP source compiles before dispatch and reuses SEWN without authority changes.
- Proved real HTTP Page/Submit → WydStore → request-local replacement/rendering,
  denial/isolation/concurrency, SEWN structure/execution equivalence and WydClient
  Ready/Change through existing facades and the existing SEAM execution boundary.
- Added no interpreter, generated JavaScript, host escape, dependency or alternate
  runtime. Advanced platform/App to `0.2.0-alpha.11`; library versions unchanged.
  Added `docs/wydbasic.md` and updated SEWN/event documentation.
- Deferred procedures, modules/source events, async syntax, unbounded loops,
  classes/imports, array indexing, nested service expressions and DIM inside loops.
  Branch declarations remain branch-local for source name checking; static types
  do not replace SEWN's runtime checks.
- Verified `npm test` and `npm run check`; manual browser verification not performed.

## 0.2.0-alpha.10 — 0.2-J
### SEWN Foundation + Safe Execution Engine

- Added closed `sewn/0.1` JSON grammar/validation and a runtime-neutral sequential
  executor with literals, variables, member reads, structured expressions, branches,
  bounded for-each loops, return/stop and controlled facade calls.
- Added portable workflow handler/action records to existing event dispatch and
  caller-preserving canonical library service dispatch; reused scoped Page mutation,
  Session authorization and safe HTTP/client contexts without capability union.
- Enforced program/value size, expression/statement depth, steps, variables, loops,
  service-call and deadline bounds with sanitized errors and reduced context limits.
- Added hostile schema/prototype/type, scope/stale handle, concurrent isolation,
  determinism and limit tests; real HTTP SEWN form → WydStore → local success
  replacement coverage plus a simple WydClient Ready workflow.
- Advanced platform/App to `0.2.0-alpha.10`; workspace package versions unchanged.
  Added `docs/sewn.md` and updated event/SEAM documentation.
- Deferred source compilers including WydBASIC, procedures, durable workflows,
  debugger, SEWN file responses/status assignment and full client feature parity.
  Service timeouts do not roll back in-flight provider operations.
- Verified `npm test` and `npm run check`; manual browser verification not performed.


---

## 0.2.0-alpha.9 — 0.2-I
### Express → Hono Transport Decoupling

- Removed Express and its middleware/dependency tree; added pinned `hono` and
  `@hono/node-server` as private HTTP transport dependencies.
- Introduced a replaceable adapter with plain kernel request data and a narrow
  output port; no Hono/native host objects enter ordinary Wydgit contexts.
- Preserved 0.2-H Page/Event/Session/REQUEST/RESPONSE behavior, CSRF/SEAM boundaries,
  response commitment, Markdown/file streaming, cookies and cleanup semantics.
- Moved generated/static CSS and allowlisted runtime routes behind the adapter,
  retaining content types, cache policy, conditional delivery and HEAD handling;
  denied hidden files, traversal and symlink escapes outside approved roots.
- Retained locked CSP/nosniff policy and decoded 32 KB form bounds, including
  compressed/chunked bodies; malformed character bytes now fail closed.
- Added graceful listener/Server Stop integration and startup-error cleanup.
  The trusted host retains listen/locals; Express middleware/router APIs are removed.
- Added real TCP transport regressions and SIGINT/SIGTERM subprocess tests;
  verified the full `npm test` suite and `npm run check`. Manual browser verification
  remains unavailable without a connected browser.
- Advanced platform/App metadata to `0.2.0-alpha.9`; workspace library APIs,
  versions and minimum platform compatibility ranges remain unchanged.
  Documented the boundary/replacement strategy; no other runtime adapter added.

---

## 0.2.0-alpha.8 — 0.2-H
### Event, Lifecycle, Request/Response Foundation

- Added schema-validated contextual events, parameterless trusted handler bridges,
  deterministic FIFO dispatch, cancellation/default rules and execution bounds.
- Integrated App Start/Stop and post-commit WydGate Session lifecycle notifications,
  with authoritative expiry and idempotent revocation/terminal transitions.
- Routed HTTP Pages through resolved Sessions, isolated request-local trees,
  deterministic lifecycle traversal, mutation snapshots and reverse cleanup ledgers.
- Added semantic Form/Field validation and registered POST actions with Session-bound
  anti-forgery checks and explicit capability-controlled persistence.
- Added safe REQUEST/RESPONSE facades, terminal Markdown/file responses, scoped
  headers/cookies and a narrow host-approved streaming file-resource adapter.
- Added WydClient Mount/Ready/Unmount and native-to-semantic event adaptation without
  native event/DOM exposure or automatic server authority.
- Disabled raw HTML Markdown tokens while retaining the existing trusted sanitizer;
  host CSP, reserved credential cookies and file typing remain protected.
- Added integrated HTTP, Gate, client adapter, lifecycle and hostile-input tests.
  Browser visual verification remains unavailable in the supplied environment.
- Advanced platform to `0.2.0-alpha.8` and WydGate to `0.1.0-alpha.3`; retained the
  existing Gate storage schema. No language compiler, durable event queue, WydFiles
  package, auth-cookie issuance endpoint or distributed coordination was added.

---

## 0.2.0-alpha.7 — 0.2-G
### WydGate Sessions + Roles/Groups/Permissions

- Added opaque, server-side sessions with digest-only token storage, absolute
  expiry, login/logout and administrative revocation through WydStore.
- Disabling users and changing passwords atomically revoke their sessions;
  login rechecks account and credential state during optimistic commit retries.
- Added immutable roles/groups, explicit membership and additive direct/inherited
  permissions with deterministic evaluation and immediate removal on fresh resolution.
- Added separate minimal user profiles and distinct administration capabilities.
- Added frozen session-derived ExecutionContext identity metadata for trusted host
  construction; domain permissions never grant SEAM capabilities or scopes.
- Shared JSON/SQLite tests cover sessions, authorization, concurrency, isolation
  and profile separation; the demo remains unchanged with Gate disabled.
- Advanced platform to `0.2.0-alpha.7` and WydGate to `0.1.0-alpha.2`.
- Changed the private Gate directory schema to `wydgate.local/0.2`. Existing stores
  fail closed and require an explicit future migration; no automatic reset occurs.
- Retained the bounded single-record model and whole-directory history. Browser
  transport, federation, MFA, nested groups and deny rules remain deferred.

---

## 0.2.0-alpha.6 — 0.2-F
### WydGate Core + Local Identity/Auth

- Added independently versioned canonical library `@wydgit/gate@0.1.0-alpha.1`.
- Added immutable user IDs, normalized unique usernames, display-name updates,
  disabled accounts and local password authentication without sessions.
- Added Argon2id password hashing, bounded hashing work and authorized password
  changes; credentials never appear in portable identity results.
- Added portable library dependencies, dependency-first registration and explicit
  host-approved private service bindings without granting application authority.
- Persisted WydGate through WydStore services using an isolated, atomic identity
  directory, with shared JSON/SQLite tests for uniqueness and authentication.
- Enforced distinct Gate capabilities and App scopes; ordinary storage grants do
  not expose the Gate-owned credential directory.
- Limited the initial directory to 256 users; WydStore history retains previous
  credential versions privately. Sessions, federation and password reset remain deferred.
- Updated platform metadata to `0.2.0-alpha.6`; WydStore remains `0.1.0-alpha.2`.

---

## 0.2.0-alpha.5 — 0.2-E
### WydStore SQLite Adapter + Provider Contract Hardening

- Added SQLite as the second WydStore provider.
- Added `better-sqlite3` as a private implementation dependency of `@wydgit/store`.
- Added an explicit internal WydStore adapter contract.
- Added shared provider-conformance tests executed against both JSON and SQLite.
- Preserved one portable WydStore API regardless of storage provider.
- Added fixed, private SQLite schema for metadata, current records, and history.
- Added transactional optimistic-concurrency checks for SQLite updates and deletes.
- Added tombstone and record-history semantics matching the JSON provider.
- Added deterministic provider-neutral query behavior.
- Added host-safe SQLite path and file validation.
- Added sanitized SQLite/driver error handling.
- Added support for JSON and SQLite logical stores in the same WydStore instance.
- Preserved provider-neutral SEAM capabilities and store/collection scopes.
- Updated platform version to `0.2.0-alpha.5`.
- Updated WydStore to `0.1.0-alpha.2`.

---

## 0.2.0-alpha.4 — 0.2-D
### WydStore Core + JSON Adapter

- Added `@wydgit/store`, the first production canonical Wyd library.
- Established WydStore's adapter-neutral store → collection → record model.
- Added the initial JSON storage provider.
- Added typed collection schemas and record validation.
- Added immutable record identities.
- Added original/current/dirty record state.
- Added insert, update, no-op save, delete, get, query, and history operations.
- Added optimistic record concurrency using version numbers.
- Added tombstones and record history.
- Added deterministic equality filtering and ID ordering.
- Added logical store and collection scopes under SEAM.
- Added caller-context-preserving library service dispatch.
- Added ownership isolation by App, publisher, package, and store.
- Added safe JSON persistence using host-approved roots and hashed filenames.
- Added atomic temporary-file writes and local lock handling.
- Added extensive WydStore security and behavior tests.
- Updated platform version to `0.2.0-alpha.4`.
- Introduced WydStore `0.1.0-alpha.1`.

---

## 0.2.0-alpha.3 — 0.2-C
### Canonical Library Packaging + Runtime Loading

- Converted the repository into an npm workspace host.
- Established canonical Wyd libraries as independently versioned npm packages.
- Chose a monorepo development model while keeping package identity independent
  from Git repository location.
- Added explicit host library configuration in `wydgit.config.json`.
- Added portable library requirements in `content/requirements.json`.
- Separated installed, enabled, and required library states.
- Added canonical library manifests and runtime targets.
- Added explicit library loading without scanning `node_modules`.
- Added library trust classes for canonical and approved runtime extensions.
- Prevented ordinary Wydgit packages from masquerading as runtime libraries.
- Added library registry, capability availability, and service registration.
- Added semantic-version compatibility checking using `semver`.
- Added structured library-loading and registration errors.
- Added `@wydgit/test-library` as a non-production workspace fixture.
- Established the principle:

  **Libraries provide capabilities. SEAM grants authority.**

- Updated platform version to `0.2.0-alpha.3`.

---

## 0.2.0-alpha.2 — 0.2-B
### Canonical Schema Hardening + Controlled Mutation

- Hardened the canonical `wydgit/0.2` object envelope and validation rules.
- Added a dedicated schema module.
- Kept hydrated runtime objects immutable.
- Added explicit edit/mutation sessions.
- Added validated property updates and resets.
- Added child insertion, removal, replacement, moves, reordering, and cloning.
- Preserved object identity across structural moves.
- Added immutable-ID and clone-ID rules.
- Added atomic commit semantics producing new immutable runtime snapshots.
- Added mutation change sets reporting added, modified, moved, and removed IDs.
- Added mutation base revisions and an optimistic-concurrency hook.
- Added SEAM-aware mutation authorization using explicit visibility/edit scopes.
- Added structured mutation errors.
- Added hostile mutation and schema tests.
- Added `docs/mutation-model.md`.
- Updated package metadata from the original 0.1-era values.
- Updated platform version to `0.2.0-alpha.2`.

---

## 0.2-A
### First-Class Object Model + SEAM Foundation

This milestone preceded the rule requiring a package-version bump for every
development milestone.

- Replaced Site as the canonical root with App.
- Added first-class immutable Wydgit runtime objects.
- Added canonical `wydgit/0.2` JSON hydration and dehydration.
- Added deterministic serialization.
- Added single prototype inheritance.
- Added abstract prototypes.
- Added publisher-boundary rules for prototype inheritance.
- Added named ordered child slots with accepted types and cardinality.
- Added cycle, duplicate-ID, multiple-parent, and malformed-graph rejection.
- Added explicit prototype-pollution defenses.
- Added private parent/root/sibling relationship indexes.
- Added initial SEAM `ExecutionContext`.
- Added deny-by-default visibility, traversal, and capability behavior.
- Preserved caller authority across object traversal.
- Added initial confused-deputy protections.
- Added structured runtime errors.
- Migrated the existing Home/About/Contact demo onto the App object model.
- Added `docs/object-model.md` and `docs/seam.md`.
- Preserved the existing server-rendered site through a web-model compatibility
  projection.

---

## 0.1.0-alpha.1
### Initial Public Wydgit Baseline

- Established the first public Wydgit repository baseline.
- Added Node.js / Express Wydgine.
- Added JSON-based site/page/section/block composition.
- Added server-side HTML rendering.
- Added Markdown content rendering and sanitization.
- Added navigation and page routing.
- Added skins and scoped presentation rules.
- Added initial tests and content checks.
- Established the architectural direction toward:
  - first-class Wydgits
  - App as root
  - renderer independence
  - SEAM
  - SEWN
  - WydClient
  - canonical Wyd libraries
- Licensed the project under MPL-2.0.
