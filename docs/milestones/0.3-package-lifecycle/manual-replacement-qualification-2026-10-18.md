# Manual replacement qualification — 2026-10-18

Starting state: clean `develop/0.3` at `659e29e`, following `3f801a3`.
Node v24.21.0. This increment extends the existing developer interpreter, planner,
writer lock, checkpoint and adapter recovery protocol. The
[implemented contract](manual-replacement-contract.md) is authoritative.

The bounded manual workflow is implemented. This record does **not** qualify all
of package-management beta or automatic orchestration. The matrix distinguishes
local stopped-App evidence from remaining release/expanded-coverage gates.

## Demonstrated end-to-end flow

`test/manual-replacements.test.js` runs the following on **JSON and SQLite**:

1. Install `acme/a` 1.0.0 with three managed instances (`pkg-a`, `pkg-item`,
   `pkg-item2`), customize the root's setting, retain a site-authored content child,
   create/update/delete a record and retain its complete history/tombstone.
2. Retire in place. Assert byte-identical accepted App serialization, unchanged
   package/installation receipts and definitions, data and dependency graph. Both
   repository execution loading and activation remain gated throughout pending work.
3. Stage `acme/a` 2.0.0 with an exact approved declaration, embedded artifact
   snapshots, full reference inventory and data fingerprints. Accepted App references
   and stores still equal the source. Migration without reference selection refuses.
4. Supply the exact preview mappings through `references`. `pkg-a`'s planned
   prototype becomes `acme/replacement`; the immutable ID and parent/slot stay fixed.
   The other managed instances and site child stay in place. The published App
   still has its source bindings at this boundary.
5. Explicitly migrate. Run the lossless `text` → `body` transform and semantic
   validation on staged current/historical data, validate the complete App/graph,
   then publish using the existing effects commit point. Activate with the same
   instance IDs, owner setting and authored child. History versions remain 1/2/3,
   with original values transformed and the tombstone retained. Source receipt,
   selected step hashes and accepted target receipt remain inspectable.
6. Checked rollback restores the prepared, quarantined source at a higher revision;
   explicit cancellation reactivates it. Newer content/configuration prevents stale
   rollback. Cancellation can also discard any uncommitted candidate even after
   its local artifact directory has been deleted, preserving new source records.

The host sequence used by these tests is:

```js
const base = {
  schema: 'wydgit.manual-replacement-request/1', root,
  package: 'acme/a', installationContext: approvedHostContext
};
await manualReplacement({...base, action: 'retire'});
const candidate = {...base, candidates: [approvedReplacement], developerMigrations};
await manualReplacement({...candidate, action: 'stage'});
const {pending} = inspectManualReplacement(base);
await manualReplacement({...candidate, action: 'references',
  references: pending.preview.references});
await manualReplacement({...candidate, action: 'migrate'});
```

The host supplies authentic context and exact candidate/step approvals separately
from package data. Automatic orchestration is not exposed by this example.
Actual 1.0.0 and 1.1.0 starting receipts, direct and adjacent paths, unchanged-schema
no-op previews and equivalence with the ordinary approved migration preview are
also exercised. Fixtures with two stores test partial adapter publication while
the App remains blocked. Shared/transitive automatic dependencies survive source
edge removal and subsequent unrelated uninstall, and cannot be changed/pruned
through their accepted recovery reservations.

## MIG-01 through MIG-15

| Gate | Local evidence | Remaining boundary |
| --- | --- | --- |
| MIG-01 | Distinct checkpointed retirement preserves in-place App/instances, receipts, data/history and dependency graph; execution is blocked. Existing uninstall regressions remain. | No live quarantine shell or already-running-server stop mechanism. |
| MIG-02 | `RETIRED`, `STAGED`, `REFERENCES_PREPARED` survive restart/process death. Unselected references stay parked; candidate artifacts/request are embedded. Catalog 0.2 fails closed on older runtimes. | No automatic expiry, automatic artifact replay or simultaneous workflows. |
| MIG-03 | Exact complete managed-ID mappings; three managed instances, customized root and authored child; prototype transition only publishes after validation. Foreign/mismatched mapping refuses. Full canonical tree/binding/storage inventory is bound. | No ownership transfer or semantic rewriting of opaque user references. |
| MIG-04 | Fixed footprint/placement, direct inheritance at every edge, explicit split/merge, opaque-reference and site-owned-adoption refusals. | Changed footprints and structural transformations remain intentionally unsupported. |
| MIG-05 | Rename/default engine, semantic validators, occupied-destination and invalid-schema regressions; manual customization, history/revisions/tombstones on both adapters. | No additional domain vocabulary beyond bounded lossless operations. |
| MIG-06 | Manual direct/adjacent paths and actual 1.1.0 source/schema; existing unsupported-source, missing/cyclic/ambiguous path and intermediate-state refusals retained. | No promise of support for every historical release or customization. |
| MIG-07 | Manual lineage, graph and resulting adapter hash match ordinary approved migration planning; same authentic host/step capabilities. | Automatic orchestration is deliberately deferred; the full automatic/manual gate remains partial. |
| MIG-08 | Complete graph/reverse constraints reuse existing tests; shared/transitive automatic packages and source reservations survive retirement/activation/unrelated cleanup. | New dependencies must be provisioned before retirement. Reservation release has no qualified cleanup API. |
| MIG-09 | Host/App/package capability checks, forged/replayed plans, accessor/malformed request refusal, exact approvals; original scopes/hash/native-escape tests retained. | Local artifact integrity is not a signing/distribution trust protocol. |
| MIG-10 | Existing declaration/work/time/bytes/history/step bounds retained; manual reference scans share the ledger. Cancellation in every phase compensates before commit; postcommit cancellation stays accepted. | Cooperative trusted-adapter bounds, no OS preemption or resumable chunking. |
| MIG-11 | Real SIGKILL in every manual durable phase; both selected step boundaries; store/config/catalog/compensation/recovery/cleanup and native JSON/SQLite boundaries; two-store store-0/store-1/config/catalog cases. | No exhaustive arbitrary fault interleavings, hardware/power-loss or network-filesystem qualification. |
| MIG-12 | Competing manual/uninstall operations and stale plans/source data/artifacts refuse. Untouched stores are fingerprinted. Original ownership, installation-bound and corrupt-evidence regressions retained. | Cooperating stopped single-host writers only; no distributed coordination. |
| MIG-13 | Exact committed manual rollback returns a higher-revision quarantined source. New content or host configuration makes rollback stale. | No arbitrary historical rollback; newer operations invalidate the old accepted boundary. |
| MIG-14 | Consumed plans refuse replay; private-step death leaves source unchanged; reconciliation succeeds with artifacts deleted; tampered previews/checkpoints refuse. Recovery itself is interrupted and resumed. | Explicit host reapproval/replanning required; no automatic retry or staging ownership adoption. |
| MIG-15 | Destructive/manual requests refuse, checkpoints stay 0600 and retained; existing purge/unrelated-resource protections retained. Source dependencies remain reserved. | Destructive abandonment, secure erasure, backup expiry, checkpoint policy and reservation release remain unqualified. |

## Verification

| Command / scope | Result |
| --- | --- |
| `npm test` | **1327/1327 passed**, zero failed/cancelled/skipped. |
| Focused lifecycle/security command in evidence | **417/417 passed**, zero failed/cancelled/skipped. |
| New manual cases within both runs | **128/128 passed**: 64 JSON, 64 SQLite. Includes 52 crash cases with 54 real SIGKILL process terminations. |
| `npm run check` | Passed: 3 complete Pages, 42 internal links, unique anchors. |
| `git diff --check` | Passed. |

Final commands and totals are recorded in the accompanying
[machine-readable evidence](../../../test-support/manual-replacement-evidence-2026-10-18.json).
All tests use disposable stopped Apps and ordinary-user local data. Full regression
and focused lifecycle/security checks retain existing assertions and resource
ceilings. Initial development iterations identified a rollback allowlist omission,
request-field optionality/import mistakes, reserved-key hashing of canonical Page
input, and test normalization of empty slots/JSON object prototypes. These were
corrected without relaxing ownership, scope, migration or resource assertions.

The initial isolated sandbox probe failed at its file entry without usable leaf
output; subsequent non-isolated focused probes and approved ordinary local-IPC
runs supply the actual leaf-test evidence. That failed attempt is not a passing
qualification run or an attribution of every historical sandbox failure.

Runtime versions remain Wydgine **0.3.0-alpha.15**, WydClient **0.1.0-alpha.9**,
WydStore **0.1.0-alpha.3**. New contracts are manual request/plan/inspection version
1, catalog **0.2**, and developer declaration version **2**. No dependency,
lockfile, runtime manifest or immutable browser artifact change is intended.

## Remaining beta blockers

The full original MIG matrix remains partial where it asks for automatic
orchestration or broader release qualification. There is no reservation-release
cleanup, destructive abandonment, checkpoint expiry/secure erasure, arbitrary
migration hook, compiled-artifact migration, changed ownership/provider,
installation-bound rebinding, changed footprint, live upgrade or distributed
writer protocol. An invalid source or unknown recovery evidence stays blocked;
cancellation is not force reconciliation. Embedded artifacts and repeated previews
consume the unchanged 4 MiB combined checkpoint bound and may refuse large Apps.

Historical intermittent HTTP `SEWN.LIMIT` reliability remains independently
unresolved; these changes do not claim to fix or attribute it. Existing 0.3 I,
I0–I5.6 and J assignments remain unchanged. Managed WydHosting qualification and
the Debian VM experiment remain deferred to 0.4 under Decision 0003, preserving
all six security obligations. No production data, push, merge, tag, release,
deployment, privileged command or downstream project is involved.
