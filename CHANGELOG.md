## 0.2.0-alpha.17 — 0.2-Q
### Default Form Presentation + Theme Modes

- Default vertical Forms and consistent semantic field/control and Submit styling.
- Separate system/light/dark theme mode contract with CSS-native system preference handling.
- Semantic skin control tokens, default light/dark palettes, and backward-compatible partial skin fallbacks.
- Preserve label/group semantics, invalid-message associations, disabled controls and visible focus.
- Guestbook requires no package-specific styling or package changes.

# Changelog

All notable changes to Wydgit are documented in this file.

Wydgit is currently in early alpha development. Until 1.0, milestones may include
breaking architectural changes.

## Unreleased

## 0.2.0-alpha.16 — 0.2-P
### Native Local Package Installation + Activation

- Added closed declarative local package manifests, read-only installation plans,
  explicit host approvals/storage mappings and durable installation receipts.
- Composed core and cataloged package prototypes in the existing registry; compiled
  WydBASIC and canonically attached Section templates through authorized insertChild.
- Published catalog, embedded resources and accepted App together using stale-state
  checks, an exclusive local lock and a single fsynced temporary/replace operation.
  Core prototype files remain distinct; host infrastructure changes require separate
  operator approval.
- Activated declared Page lifecycle bindings and semantic POST actions under normal
  startup, with actual Session identity and exact approved grants. No package JS,
  runtime package scanning, package-controlled provisioning or permission union is
  introduced.
- Guestbook now constructs and inserts dynamic request-local entry drafts instead
  of twenty persistent placeholders, with explicit construction capability/scope
  approval. The CLI builds operator policy interactively when `--approval` is absent,
  with separate permission and final apply confirmations.
- Extended the trusted interactive installer with explicit authority/infrastructure
  approval, canonical installed WydStore enablement, operator-selected JSON/SQLite
  provisioning, host-owned storage mappings and discovered placement choices.
  Complete prospective validation precedes mutation; staged config/catalog apply
  rolls back caught failures and blocks startup on interrupted recovery state.
  Explicit non-interactive policy mode remains supported; no downloads are added.
- Added restricted trailing-wildcard object grants for visible/editable; exact
  matches remain intact, with no general glob/regex support. Guestbook grants use
  guestbook-entry-* instead of enumerating a finite set of entry IDs.
- Added portable argument-free NewId() → sewn/0.3 newId String intrinsic; IDs carry
  no authority and retain ordinary construction/storage/edit checks.
- Migrated Guestbook to manifest/prototypes/template/WydBASIC resources; removed its
  privileged installer, context/UUID hook, special server and optional JS adapter.
- Documented local catalog snapshot/drift rules and one principal per Page; remote
  packages, upgrades/uninstall, migrations, multiple instances, automatic ID rewriting
  and automatic WydClient bootstrap/transport remain deferred.
- Advanced platform/lockfile/App metadata to 0.2.0-alpha.16; independent library
  contracts and versions remain unchanged.
- Verification: full `npm test` (268 passing tests), `npm run check` and
  `git diff --check`; terminal JSON/SQLite installs from disabled WydStore,
  final-decline/no-write checks and normal-host POST/restart persistence exercised
  in isolated patched-baseline copies. Legacy Guestbook dependency search has no matches.

## 0.2.0-alpha.15 — 0.2-O
### Remove Legacy Form fields Slot

- Removed `Form.fields`; Form continues to inherit Section, with normal containment
  as the sole structural model. Recursive descendant field semantics remain unchanged.
- Nested Forms remain forbidden through hydration, mutations and draft construction.
  Old slot content fails as an unknown slot; no migration compatibility is retained
  because no external content depends on this pre-release shape.
- Updated Form/event fixtures, rejection regressions, docs and platform/lockfile/App
  metadata to `0.2.0-alpha.15`; independently versioned libraries are unchanged.

## 0.2.0-alpha.14 — 0.2-N
### Portable Form Wydgit + Semantic Field Primitives

- Form now inherits Section and owns recursive descendant Fields through ordinary
  containment; nested Forms and duplicate field names are rejected by canonical
  hydration/mutation and draft subtree validation. Legacy fields slots remain valid.
- Added TextInput, PasswordInput, TextArea, Checkbox, RadioGroup, CheckboxGroup and
  Select under Field, with semantic labels, typed values, enabled/visible state,
  text placeholders and nullable character limits, and shared safe option groups.
- Added inherited WydBASIC Bind/Values/Validate/IsValid/Clear methods through normal
  prototype dispatch and a closed, bounded, scoped kernel binding. Binding changes
  values only; clear empties values while preserving configuration and layout.
- Shared renderer-neutral rules validate required/type/cardinality/option/length
  semantics on Page and WydClient. Web POST maps to typed values before validation
  and Submit, retaining ordinary invalid values and request isolation.
- PasswordInput values are redacted from generic collection, scoped properties,
  default exports, diagnostics, client Change payloads and web redisplay. Trusted
  internal edits preserve sensitive request state; no secret-management system added.
- Web mapping adds accessible labels, group legends, validation association,
  placeholders, limits, disabled state, secure entry and single/multiple selection.
  Core semantics contain no HTTP/Node/DOM/HTML control configuration.
- Added ProfileForm object/draft/mutation/rule/Page/source/client/renderer tests and
  forms documentation; preserved existing schemas, content, methods and libraries.
- Advanced platform/lockfile/App/current metadata to 0.2.0-alpha.14; WydStore,
  WydGate and unrelated package versions remain unchanged.
- Verification: full `npm test` (229 tests), `npm run check`, and `git diff --check`.
- Deferred Guestbook to 0.2-O, native renderers, advanced validators, Reset,
  automatic persistence and client tree attachment. Manual browser QA not performed.

## 0.2.0-alpha.13 — 0.2-M
### Prototype Methods + WydBASIC Object Construction

- Added prototype-owned portable behavior compiled from explicit WydBASIC source
  declarations, using the existing prototype hierarchy rather than language classes.
  Methods inherit and dynamically dispatch most-derived overrides; explicit override
  declarations require identical kind/parameter/result signatures.
- Added closed `sewn/0.3` method statement/function expression and construction
  expression operations. Preserved `sewn/0.1`, `sewn/0.2`, body/module/event source,
  descriptor Insert/Replace and behavior-free prototype compatibility.
- Reused SEWN typed ByVal frames, completion rules, opaque references, combined
  call/depth/live-local/step/service/deadline budgets; added setup cycle rejection
  and active-call defense across dynamic receivers. Me binds the receiver while
  the caller's exact SEAM context/service authority remains unchanged.
- Added explicit-ID `NEW "publisher/prototype"("id")` and invocation-scoped bounded
  transient drafts with inherited defaults, validated Set and nested draft Insert.
  Explicit construction capability/prototype scopes grant no canonical edit rights.
  Existing atomic containment mutation consumes drafts only after successful
  attachment; consumed aliases are stale. No detached canonical heap, persistence,
  portable JS, fabricated relationships or authority grants were introduced.
- Added explicit base/derived message-panel source definitions, inherited/overridden
  behavior and renderer projection of primitive subtypes. Page/real HTTP Submit
  proves NEW → draft → portable methods → validated containment → local rendering,
  request isolation and denial. WydClient supports read-only prototype dispatch;
  its current adapter does not implement canonical tree attachment.
- Added independent hand-authored SEWN dispatch/construction/security/bounds tests,
  WydBASIC compiler/module/client/Page/HTTP tests and real WydStore caller-authority
  denial. Updated object, mutation, SEAM, SEWN and WydBASIC docs.
- Advanced platform/lockfile/App/current metadata to `0.2.0-alpha.13`; WydStore,
  WydGate and unrelated workspace versions remain unchanged.
- Verification: full `npm test`, `npm run check` and `git diff --check`;
  manual browser visual verification not performed.
- Deferred BASE calls, access modifiers, multiple inheritance/interfaces/mixins,
  overloads/static members, full nominal typing, reflection/dynamic names, closures,
  slot sugar, remote/package discovery, implicit IDs and automatic persistence.

## 0.2.0-alpha.12 — 0.2-L
### WydBASIC Procedures + Event Modules

- Added closed canonical `sewn/0.2` procedure declarations, SUB calls, FUNCTION
  expressions and sequential service expressions; preserved `sewn/0.1` grammar,
  execution and existing handler-body/run/workflow/wydBasic registrations.
- SEWN owns typed ByVal parameters, isolated local frames, explicit return signals,
  fail-closed FUNCTION completion and shared step/loop/service/deadline budgets.
  Added call-count/depth/parameter limits and aggregate live-variable bounds;
  static call graphs reject direct/indirect recursion before execution.
- Added located WydBASIC SUB/FUNCTION, CALL, RETURN and parameterless EVENT parsing,
  case-insensitive static procedure resolution, kind/arity/type diagnostics,
  duplicate-name/event checks and compile-time obvious missing-result detection.
- Added separate compileModule and exclusive wydBasicModule registration, expanded
  into validated SEWN workflows at setup for Pages, server lifecycle and WydClient.
  Registry-backed event normalization rejects unknown/ambiguous names. Completed
  the explicit browser-safe runtime module allowlist and tested its import closure. HTTP action
  modules supply only behavior; routing, validation, CSRF and capability policy remain
  in host metadata and the existing pipeline.
- Preserved the exact caller ExecutionContext and scoped/stale Wydgit handles through
  nested calls. No JavaScript generation, WydBASIC interpreter, native access,
  reflective invocation, closure or authority union was introduced.
- Added independent hand-authored SEWN procedure tests (no compiler import), source
  diagnostics/runtime tests, Page/client/server event integration and real HTTP
  EVENT Submit → FUNCTION/SUB → WydStore → request-local replacement → rendered
  success, including denial, CSRF, deterministic compilation and request isolation.
- Advanced platform/lockfile/App/current-version metadata to `0.2.0-alpha.12`;
  WydStore, WydGate and other workspace versions remain unchanged. Updated SEWN,
  WydBASIC, event and current-version documentation.
- Deferred recursion, ByRef/Optional/ParamArray/defaults/overloads, nested procedures,
  classes/NEW/inheritance, lambdas/closures, async/parallelism, cross-file imports,
  debugger/formatter/LSP, additional control-flow syntax and DIM inside FOR EACH.
- Verification: focused procedure/compiler/HTTP tests; full `npm test`,
  `npm run check` and `git diff --check`. Manual browser verification not performed.

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
