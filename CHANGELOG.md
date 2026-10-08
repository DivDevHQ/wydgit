# Changelog

All notable changes to Wydgit are documented in this file.

Wydgit is currently in early alpha development. Until 1.0, milestones may include
breaking architectural changes.

## Unreleased

No unreleased milestone changes yet.

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
