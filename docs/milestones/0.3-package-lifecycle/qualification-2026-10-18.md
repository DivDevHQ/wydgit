# Package lifecycle continuation qualification — 2026-10-18

Starting point: clean `develop/0.3`, `69820ac`. Node v24.21.0. Work continues the
existing lifecycle foundation; I/I0–I5.6/J assignments and Decision 0003 remain
unchanged. All effects exercised here belong to disposable local test fixtures.
No production data, real infrastructure provisioning, VM, privileged command, push,
merge, tag, release or deployment was used.

Local implementation commits:

- `eb98ff3` — checkpointed provisioning, migrations, physical purge and adversarial recovery tests.
- `e9769ec` — trusted settled-I/O Page diagnostics and controlled HTTP attribution.

## Implemented contracts and their boundaries

| Gate | Qualified local behavior | Remaining boundary |
| --- | --- | --- |
| Recoverable provisioning | Durable before/after config/catalog/adapter checkpoints; private provider staging; operation-owned directories; grants, App instances and navigation activate through catalog commit; failed compensation retains barriers. | Old unversioned infrastructure records lack ownership evidence and remain manual; unknown/new data is preserved. |
| Versioned schema/data | Exact ordered package-version chain; incrementing schema versions; lossless renames/defaults; all history, revisions and tombstones validated on JSON/SQLite; checkpoint-based retry. | No destructive transforms, arbitrary code/SQL, changed ownership/provider, storage removal or installation-bound identity transition. |
| Incompatible instance definitions | Explicit managed-ID property/prototype transitions; final hydration; site settings preserved; same footprint and placement. | Arbitrary instance graph changes and customized resources that cannot satisfy the candidate schema refuse. |
| Committed upgrade rollback | New checkpointed operation restores a completed update/upgrade only if catalog/config/affected stores remain exact; revision increases. | Newer content/configuration makes rollback stale; arbitrary historical or uncheckpointed rollback is unsupported. |
| Physical purge | Explicit package-specific content approval; full persisted owner/schema validation; all collections mapped; installed/retained/library references protected; JSON/SQLite active files and config mappings removed recoverably. | Private recovery copies remain; secure erasure, backup expiry/deletion and shared canonical-library resource purge are not implemented. |
| SEWN attribution | Unchanged shared Page ledger; trusted phase/authorization/service/dispatch timing after I/O settles; first resource timeMs versus cancellation guard proven in controlled probes. | Historical intermittent Contact/drain full-suite failure remains unreproduced and unresolved. |
| Storage/deployment durability | Ordinary-user process-death and deterministic failure tests on local fixtures. | No hardware/power-loss, network-filesystem, live-upgrade, distributed-writer or managed-hosting qualification. |

The [implemented contract](../../package-lifecycle.md) defines the approved API,
checkpoint sizes, host-only migration grammar, compensation and purge semantics.
Wydgine remains 0.3.0-alpha.15, WydClient 0.1.0-alpha.9 and WydStore
0.1.0-alpha.3. No dependency or immutable browser artifact changed. The new
`@wydgit/store/trusted/lifecycle` host export carries `wydstore.lifecycle/1` and is
loaded lazily from the App installation; it is not a canonical SEAM service.

## Crash and consistency evidence

The 83 additional root cases cover the new contracts. The provisioning tests kill writers at PLANNED, directory publication,
APPLYING, private schema initialization, private store staging, per-store
publication, host-config publication, catalog publication and compensation.
They also kill an elected recovery writer and its final cleanup, then retry;
concurrent reclaimers are rejected without stealing the active recovery marker.
An initially missing directory created by someone else after planning is neither
adopted nor deleted.

Migration and purge tests kill before effects, after a store, after config,
after catalog and during compensation, on both adapters. Additional SIGKILL
probes stop **inside** SQLite CREATE TABLE and replacement transactions, and
between JSON temporary-file fsync and live-file rename. SQLite native rollback
and the durable adapter checkpoint restore complete record/history documents;
JSON recovery removes only its exact operation-specific temporary file. Unknown
host files survive. Precommit operations default to compensation; explicit resume
uses recorded after-images. Postcommit recovery finishes the accepted operation.

Checkpoints and journals are synced before resource changes. Native atomicity
covers each adapter; multiple resources can be old/new while the App is blocked.
The catalog rename is the commit point, not an assertion of cross-store atomicity.
A recovery result requires validation of actual adapter content, not just a
consistent catalog. Source changes or unknown ownership retain barriers.

Adversarial cases include busy/stale operations, migration/uninstall races,
cancellation after storage mutation, shared parent charges, forged ownership,
symlink/hardlink stores, occupied rename destinations, malformed/unrelated/oversized
migration approvals, attempted destructive/raw hooks, foreign instances,
unmapped collections and mismatched content authorization. Earlier seeded DAG,
shared/transitive dependency, reverse-constraint, protected-package, malformed
manifest and forged-receipt regressions remain enabled.

## Executed validation

All following runs completed on the final implementation. The
[compact machine-readable evidence](../../../test-support/package-lifecycle-evidence-2026-10-18.json)
retains full command strings, zero-failure/cancellation/skip counts, raw-log SHA-256
values and the six sanitized controlled HTTP meter traces.

| Command | Actual result |
| --- | --- |
| `npm test` | **1,086/1,086 pass**, zero failed/cancelled/skipped; normal process isolation/concurrency and unchanged client immutable-artifact guard |
| Focused command below | **176/176 pass**, zero failed/cancelled/skipped |
| `node --test test-support/http-budget-probe.mjs` | **6/6 pass**, zero failed/cancelled/skipped |
| `node --test test/package-migrations.test.js test/package-boundaries.test.js test-support/http-budget-probe.mjs` | **35/35 pass**, including accepted-configuration receipt fingerprints and the six HTTP probes |
| `npm run check` | Passed: 3 complete Pages, 42 internal links and unique anchors |
| `git diff --check` / staged whitespace check | Passed |

```sh
node --test test/packages.test.js test/package-lifecycle.test.js test/package-infrastructure.test.js test/package-provisioning-recovery.test.js test/package-migrations.test.js test/package-physical-purge.test.js test/package-effects-adversarial.test.js test/package-boundaries.test.js test/sewn-shared-budget.test.js
```

Two earlier complete root confirmations passed 1,084/1,084 before final review
added the two installation-bound store refusal regressions. The final 1,086-case
run includes those guards: even an unchanged schema cannot silently issue a new
installation identity against bound storage. New migration receipts bind to the
accepted post-migration configuration fingerprint. No new data is discarded when
a rollback plan has become stale.

On the final standalone controlled probes, the first exhausted resource is
`timeMs` with the unchanged 1,000 ms Page ceiling for both precommit waits, the
JSON submitted-commit wait and the held Page.Load. Awaited service/dispatch spans
and action/load phases are retained. Both connection-loss traces identify first
resource `guard`, preserving the distinction between cancellation and timeout.
These are deliberate reproductions; none attributes the old intermittent failure.

The initial full continuation run completed **1,077 pass / 1 fail of 1,078**.
The single failure was the architecture boundary regression caused by importing
WydStore internals through relative paths. It was fixed with a lazy, versioned
trusted package export; the boundary assertion was preserved. Early native-probe
iterations also caught an unsynchronized named filesystem mock and a newly precise
ownership error assertion. Those probes were corrected, with 3/3 targeted passes.
The original hardening fixture cleanup was extended to remove its exact new checkpoint/journal during deliberate base-site restoration; its assertions remain intact. No assertion, budget, concurrency policy or security boundary was weakened.

Recorded intermediate passes: 14/14 original provisioning, 72/72 original
provisioning/lifecycle, 89/89 focused lifecycle/HTTP/shared-budget/probes,
75/75 new lifecycle/adversarial, 77/77 lifecycle plus package boundaries and
93/93 broader lifecycle/boundary/provisioning tests before the final native probes.
Temporary raw logs live in `/tmp/wydgit-*.log`; these paths are not durable evidence.
This committed record retains the commands, outcomes and qualification scope.

## Release decision

**The commissioned production milestone remains incomplete.** The implemented
bounded paths support complex local 0.3 package development on disposable stopped
Apps, with tested JSON/SQLite retention, migration, rollback and purge. They are
not a general production lifecycle readiness claim. Historical HTTP resource
reliability and the unsupported safety/retention/environment cases in the matrix
remain explicit blockers. A broader destructive migration or secure-erasure
promise needs a separate reviewed contract; passing tests do not authorize one.
Managed WydHosting stays deferred to 0.4 with all six obligations intact.
