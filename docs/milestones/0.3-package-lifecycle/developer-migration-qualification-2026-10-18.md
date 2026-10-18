# Developer migration declaration increment qualification — 2026-10-18

Starting point: clean `develop/0.3` at planning commit
`227f3afaf4b8d7b9757d7e4164864678679e4095`, Node v24.21.0.
Contract commit: `3f801a3`. This record accompanies the implementation commit.
The [original plan](developer-defined-migrations.md) remains authoritative; the
[increment contract](developer-migration-contract.md) records the narrower API.
**The complete mission and package-management beta are not qualified.**

## Implemented behavior and decisions

`planPackageOperation` now accepts separately versioned `developerMigrations`
for the installed primary package's `update`/`upgrade`. The existing
`applyPackageOperation` and `packageOperation` publish it through the established
effects machinery. Pure host helpers inspect artifact identities, hash JSON and
validate declarations. Package manifests and the old host migration format remain
unchanged. No general SEWN migration service or native hook is introduced.

Every selected step binds exact source/target versions and artifact hashes,
logic/validator hashes, per-step host approval and actual host capabilities.
Logical collection names resolve through installed receipts; instance predicates
and property transforms remain confined to managed IDs and existing edit scopes.
Renames/defaults and four read-only predicate kinds run against private staged
values, including historical content. IDs, revisions, history and tombstones are
preserved. Full intermediate schema, binding, graph and hydration checks precede
the next edge. Frozen plans expose path, approvals, limits, usage and lineage.
Apply checks local artifacts and source catalog/config/store freshness.

Paths are always explicitly selected. Supported-source declarations establish
graph reachability; runtime validation qualifies the actual selected source state,
not every possible historical customization. Tests cover 1.0.0 → 2.0.0,
1.0.0 → 1.1.0 → 2.0.0 and a 1.1.0 starting receipt. Each storage transition
retains the existing one-schema-version increment rule. No shortest-path heuristic,
path fallback, automatic download or assertion of support for all older versions
is added. Intermediate grants, bindings and library requirements must equal the
separately approved final candidate's. Compiled static/interface artifacts refuse.

Counts accumulate across transformations and validator scans. Existing work/time,
record-byte and 4 MiB aggregate checkpoint ceilings are unchanged. Declaration
limits additionally bound records, history, cumulative input/output bytes, mapping
visits, selected steps and staging bytes. Receipt/catalog lineage binds accepted
step IDs and hashes; changing an observed step ID's contents refuses.

## Acceptance matrix: tested portions and remaining gates

The new file adds **113 tests**, with JSON and SQLite cases for all applicable
increment behavior. The full original regression suite remains enabled. The table
does not convert partial evidence into completion of a full MIG scenario.

| Gate | Evidence in this increment | Still required for the original gate |
| --- | --- | --- |
| MIG-01 | Existing uninstall/retention regressions retained. | Distinct retire-in-place operation, reservations, quarantine and recovery evidence. |
| MIG-02 | Restart/recovery validates accepted before/after images. | Durable retired/staged/pending workflow; unchecked adoption behavior. |
| MIG-03 | Fixed IDs and properties preserved; foreign instance predicates refuse. | Explicit complete reference inventory and one-to-one adoption API. |
| MIG-04 | Prototype/footprint changes refuse in developer contract. | Comprehensive unknown-reference, split/merge and manual adoption fixtures. |
| MIG-05 | Lossless rename/default, owner property preservation, history/tombstone preservation, semantic failure and occupied destination refusal on both adapters. | Broader multi-instance/manual-workflow fixtures and domain operations beyond the declared vocabulary. |
| MIG-06 | Exact direct/adjacent paths, two installed starting versions, missing edge/source, cycles, duplicate edges, intermediate schema/hydration failure and missing explicit selection refuse. | Equivalent manual outcomes, broader legacy schema fixtures and complete support-matrix qualification. |
| MIG-07 | Existing incompatible-upgrade intent and separately approved target grants remain enforced. | Manual retirement/stage/adopt composition and manual/automatic equivalence. |
| MIG-08 | Missing dependencies/reverse dependents veto activation; existing graph/protection tests retained. | Retired/recovery dependency reservations and approved cleanup proof. |
| MIG-09 | Forged plan/context, wrong App/package, absent capabilities, approval union/escalation and foreign scopes refuse. Accessors/pollution/native hooks refuse. | Full pending-workflow replay and cross-step/App fixtures. |
| MIG-10 | Records/history/bytes/mappings/steps/staging/work/time bounds terminate; cancellation after store mutation compensates; reused cancelled ledger remains terminal. | All manual phases and remaining postcommit/nested migration-specific fault cases. |
| MIG-11 | SIGKILL at checkpoint PLANNED, store/config/catalog publication and compensation on both adapters; source or target verified. Existing native/cleanup recovery regressions retained. | Retire/candidate/each staged-step crash fixtures and exhaustive new-workflow boundaries. |
| MIG-12 | Stale source writes/artifacts refuse; existing competing writer, ownership, installation-bound and corrupt-evidence tests retained. | Competing retire/migrate/uninstall/purge manual-workflow tests. |
| MIG-13 | Exact committed rollback restores original content/config and increases revision; newer user writes refuse stale. | Full manual-workflow configuration/ownership drift matrix. |
| MIG-14 | Explicit resume uses fixed after-images even after local artifact deletion; checkpoint/receipt tampering and changed observed step IDs refuse. Consumed plans cannot replay. | Durable manual-stage ownership, retry and expiry protocols. |
| MIG-15 | Raw JavaScript/destructive/inverse hooks refuse; recovery checkpoints tested 0600 and retained. Existing unrelated-file/purge regressions retained. | Manual-workflow disguised purge/abandonment fixtures and retention policy. |

No ordinary package logic receives SQL, filesystem paths, shell, modules, a host
execution context, raw adapters or foreign handles. Physical publication stays
inside trusted WydStore lifecycle exports. Recovery never executes developer
logic: crash fixtures delete the supplied artifacts before reconciliation.

## Executed checks

All qualification uses disposable stopped Apps, ordinary user privileges and local
JSON/SQLite data. No production data, deployment, push, merge, tag, release,
privileged command or downstream project was used. Root tests need ordinary local
socket/IPC support; approved runs outside the tool sandbox supplied that support.

| Command | Result |
| --- | --- |
| `npm test` | **1199/1199 passed**, zero failed/cancelled/skipped. Includes immutable browser-artifact, package, security, SEAM/SEWN and resource-budget tests. |
| Focused command below | **289/289 passed**, zero failed/cancelled/skipped; includes all 113 new cases. |
| `npm run check` | Passed: 3 complete Pages, 42 internal links, unique anchors. |
| `git diff --check` and staged whitespace check | Passed. |

```sh
node --test --test-reporter=tap test/developer-migrations.test.js test/packages.test.js test/package-lifecycle.test.js test/package-infrastructure.test.js test/package-provisioning-recovery.test.js test/package-migrations.test.js test/package-physical-purge.test.js test/package-effects-adversarial.test.js test/package-boundaries.test.js test/sewn-shared-budget.test.js
```

The [machine-readable evidence](../../../test-support/developer-migration-evidence-2026-10-18.json)
retains commands, counts and raw-log hashes. Initial iterations caught a reserved
key in the internal footprint comparison and four overly broad/incorrect refusal
fixtures; the comparison and fixtures were corrected, with precise assertions.
The final tests preserve the original assertions and ceilings.

The initial sandboxed `npm test` reported 73 passing/29 failing **file entries**;
isolated child output was suppressed, so those are not leaf test counts. Existing
minimal diagnostic probes independently reproduced an empty child stdout and Unix
`listen EPERM` in that sandbox. These are recorded as failed attempts, not passing
qualification or attribution of every failure. The normal full run passed
1173/1173 before the last 26 tests were added, and 1199/1199 afterward.

## Remaining release boundaries

Retire-in-place, durable replacement staging, complete canonical reference
inventory/adoption, manual Migrate Data, automatic composition of those operations,
and full MIG-01–MIG-15 acceptance remain required. This increment deliberately
refuses prototype rebinding, changed footprints, compiled artifact transitions,
installation-bound storage, ownership/provider transfers, destructive transforms,
external effects and general migration programs. Checkpoint expiry/secure erasure,
large resumable migrations, live/distributed writers, hardware/power-loss and network
filesystems remain separate contracts and qualification work.

Wydgine stays **0.3.0-alpha.15**, WydClient **0.1.0-alpha.9**, WydStore
**0.1.0-alpha.3**; no manifest/lockfile/dependency/browser-artifact change is needed
for this incomplete workstream increment. The separate historical HTTP reliability
blocker remains open. I/I0–I5.6/J assignments and WydHosting's Decision 0003 0.4
deferral, including all six security obligations, remain unchanged.
