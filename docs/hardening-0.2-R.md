# 0.2-R hardening and prerelease audit

Target: **0.2.0-alpha.18**. This milestone changes defensive checks, tests,
dependencies and documentation; it adds no application feature or schema version.
Canonical WydStore remains 0.1.0-alpha.2 and WydGate 0.1.0-alpha.3.

## Defects corrected

- Restricted object grants now require `foo-*`; `foo*` could previously match
  unrelated IDs such as `foobar`. Exact IDs are unchanged. Only visible/editable
  object grants use this matcher; capabilities and resource scopes remain exact.
- A leftover installation lock now blocks repository loading and host initialization
  before libraries/providers initialize. Competing applies return `PACKAGE.BUSY`.
  Dangling recovery/catalog symlinks are detected rather than treated as absent.
- Config fingerprints are rechecked after the last pre-replacement hook. A stale
  config change at that boundary is preserved, while new provider data rolls back.
- Catalog metadata is compared with receipt grants, placement, IDs, libraries,
  mappings and bindings, in addition to existing embedded-resource hash checks.
  Invalid catalog entries and malformed manifest/catalog JSON fail structurally.
- The centralized 1024-package defensive safety ceiling is checked during planning, before unusable state can
  publish. Existing template/resource/source/execution bounds remain unchanged.
- Explicit unattended policy must have the documented fields. `null` is invalid
  policy rather than an interactive cancellation. Interactive `--apply` still
  requires authority, infrastructure and final confirmations; EOF aborts.
- Runtime storage locations cannot use engine, client, library, script, test or
  documentation directories, or a site root with symlink ancestors.
- Removed unused `turndown` and `turndown-plugin-gfm` development dependencies.
  No dependency upgrades or canonical library contract changes were required.

## Defect regression recheck

The precommit recheck found that package-count enforcement had a runtime fix but
no direct regression at the then-existing 32-package boundary. That coverage gap was
closed; the ceiling is now centralized as `LIMITS.packages = 1024`, a defensive
implementation bound rather than a supported-capacity target. It also expanded receipt metadata mutations, rejected policy shapes
and wildcard constructor/policy checks. The later ceiling correction also moves planning enforcement ahead of candidate processing.

| Defect | Root cause | Exact fix and fail-closed result | Regression test |
| --- | --- | --- | --- |
| Overly broad wildcard grants | Removing any trailing `*` and validating its prefix allowed `foo*` to match `foobar`. | `validObjectGrant` in `wydgine/seam/context.js` requires `-*` and a valid nonempty prefix. Invalid context grants reject with `SEAM.CONTEXT`; package grants reject with `PACKAGE.MANIFEST`. | `test/object-grants.test.js`: “object grants preserve exact matches and accept only literal nonempty trailing prefixes”; malformed patterns also cross context and package policy validation. |
| Ignored installation locks | Loading/initialization checked the infrastructure journal but ignored `.package-install.lock`. | Shared `checkInstallationRecovery` in `wydgine/packages/state.js` runs in repository loading and at the start of `initializeHost`, returning `PACKAGE.RECOVERY` before providers initialize. Apply retains exclusive lock acquisition and returns `PACKAGE.BUSY`. | `test/packages.test.js`: “simultaneous install attempts fail with structured busy and publish exactly one accepted state” and “malformed catalogs and receipt metadata drift fail closed” (leftover lock at both startup boundaries). |
| Dangling recovery links | `existsSync` follows links and reports a dangling link as absent. | Presence checks use `lstatSync` with `throwIfNoEntry:false`. Lock/journal links block with `PACKAGE.RECOVERY`; a linked catalog fails safe reading with `PACKAGE.PATH`. | `test/packages.test.js`: “dangling recovery and catalog symlinks cannot be mistaken for absent state”. |
| Stale config replacement | The last hook could change config after the stale check and before rename, discarding the operator edit. | `applyPackageInstall` rechecks both fingerprints after `beforeConfigReplace`. `PACKAGE.STALE` preserves the operator edit and rolls back new infrastructure/staging. | `test/package-infrastructure.test.js`: “config change immediately before replacement fails stale without overwriting the operator change”. |
| Receipt drift | Receipt package/version and resource hashes were checked, but mirrored acceptance metadata was not compared. | `readInstalledState` compares publisher, instance, instance IDs, installable, placement, libraries, approved grants, storage mappings and bindings; mismatches fail with `PACKAGE.CATALOG`. Existing hash checks still return `PACKAGE.DRIFT`. | `test/packages.test.js`: “malformed catalogs and receipt metadata drift fail closed”; all newly compared fields have mutations. |
| Malformed policy handling | Explicit `null` reached the interactive cancellation branch; extra fields were silently ignored. | `runInstaller` checks the closed operator-policy field set before cancellation/planning. Invalid shapes return `PACKAGE.POLICY`; malformed JSON/missing files reject and the CLI converts native errors to structured failure. No accepted state is written. | `test/install-package-cli.test.js`: “malformed and nonexistent unattended policy fail before writing accepted state” (syntax, null, missing/extra fields, arrays/scalars and missing file). |
| Late package-count enforcement | Only catalog reading enforced the count bound, allowing planning to publish unusable state. | `LIMITS.packages` sets a defensive ceiling of 1024. Planning checks it before candidate processing (`PACKAGE.LIMIT`); catalog loading rejects counts above it (`PACKAGE.CATALOG`). | `test/packages.test.js`: “package safety ceiling permits more than 32 and rejects planning at 1024 before candidate work or writes”; 33 real installs succeed, synthetic validated metadata covers 1024/1025 catalog boundaries, and a nonexistent candidate proves early planning rejection without writes. |

During the earlier seven-defect recheck, each targeted regression passed and failed after
restoring only that defect's old behavior in a disposable repository copy. This
is executable guard-removal verification, not a claim that the entire old release
was rerun. Conceptually the old behavior admits the invalid grant/state/policy,
overwrites the stale edit, or returns a 33rd plan, contradicting the test's denial
assertions. The working checkout's runtime files were never reverted.

None of these seven items remains partially fixed within the documented private
local-host model. Receipts are consistency evidence, not signatures; coordinated
host-file tampering and privileged filesystem races are outside that model.

## Audit coverage and evidence

The review covered the object/prototype/mutation model, SEAM contexts, execution
and service bindings, package manifest/plan/apply/catalog/activation, trusted CLI
provisioning, JSON/SQLite adapters, Gate identity/session/authorization, portable
Forms, Hono input/output/file boundary, Markdown and skin validation, workspace
manifests and current documentation. Historical milestone/changelog records are
preserved. README, Forms, SEWN randomness wording, wildcard rules, package recovery
and current version references were corrected.

Existing regression suites exercise containment/inheritance/method authority,
construction/draft consumption, stale handles, bounded execution, password
redaction, Gate session revocation and fresh permission aggregation, all semantic
fields, escaped/sanitized rendering, transport traversal and malformed input,
CSRF, response commitment and graceful shutdown. New tests add:

- 2,000 seeded hostile source strings through both WydBASIC entry points, plus
  huge source, deep nesting, long member/binary chains and unterminated strings;
- negative dangerous-key, oversized and deeply nested programs for all three SEWN
  schemas;
- EOF at each installer prompt, malformed/missing policy, unsafe paths, receipt
  drift, dangling recovery state, stale config and simultaneous install contention;
- concurrent duplicate creation and distinct package physical-store isolation
  on both providers, plus concurrent Gate login/revocation without lost updates;
- SQLite process termination inside an uncommitted native transaction, followed
  by reopening accepted state/history and successfully writing again;
- real interactive readline input from disabled WydStore, JSON and SQLite
  provisioning on Contact, invalid and simultaneous valid HTTP submissions,
  dynamic safe Markdown entries, restart persistence, deliberate fixture cleanup
  and final reloads of all three base Pages.

Provider conformance compares externally visible query results across JSON and
SQLite and tests lifecycle, no-op/CAS, history/tombstones, lexical ordering,
validation, ownership and scopes. Provider quotas differ by design: JSON bounds
its entire document; SQLite has independent database/record/history/result bounds.
SQLite uses DELETE journaling, not WAL. Sidecar link rejection and genuine
multi-process conflict/busy behavior remain covered by the existing suite.

No package-specific Guestbook behavior appears in `wydgine`, `wydclient`, `packages`,
`scripts` or `public`. No TODO/FIXME/HACK marker remains in tracked source. Canonical
contracts keep their existing names: `wydgit/0.2`, `wydgit-package/0.1`,
`wydgit-install-plan/0.1`, `wydgit-install-receipt/0.1`, `wydgit-installed/0.1`,
`wydgit.requirements/0.1`, `sewn/0.1`, `sewn/0.2`, and `sewn/0.3`.

## Verification and remaining acceptance

The baseline suite passed 271 tests. Initial milestone verification passed 287 tests
(16 added), with two consecutive full runs and an independent clean-snapshot run.
The defect recheck adds the missing package-count regression and passes 288 tests
(17 added in total), plus all seven focused guard-removal checks above. Content
checks verify 3 Pages and 42 internal links; diff whitespace and workspace linking
checks pass. npm audit reports zero advisories. Clean-install validation uses an isolated snapshot of
tracked files plus this milestone's new files, with no `.git`, agent configuration,
node_modules, installed catalog or runtime data copied from the working checkout.
It runs its own `npm ci`, full suite, content check and `npm start`.

Automated HTTP and semantic/CSS assertions are not visual browser acceptance.
The available UI inventory reported no browsers; creating an in-app browser
reported `Browser is not available: iab`. Brian still needs to inspect Home,
About and Contact at mobile width, forced light/dark and OS system preference,
focus/disabled/invalid Form readability, print output, and both Guestbook provider
flows in a browser followed by cleanup/reload. The prerelease visual gate remains
open until those checks pass. No public release, tag, publication or security
certification is implied by the version bump.

## Operational limits

Alpha quality; no uninstall, upgrade, storage migrations, remote registry,
signatures, automatic package dependency installation, WydClient automatic
bootstrap/transport, admin console or CMS. One package principal per Page and one
installation per fixed-ID template. Canonical libraries are workspace packages,
not independently published general-purpose packages.

Host-approved directories must remain private from untrusted OS writers. Local
installation locks and fingerprints are not distributed transactions, and fsync
plus rename does not promise directory-entry survival through power loss. A SEWN
deadline cannot undo a service call already started. Recovery remains explicit
operator restoration/inspection as described in [packages.md](packages.md).
The fixture cleanup tests restore disposable host state; they do not implement
uninstall. External security review remains necessary before broad safety claims.
