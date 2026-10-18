# Stopped-App manual replacement contract

The [BackOffice lifecycle increment](../../backoffice-placement-lifecycle.md)
advances manual retirement to catalog 0.3 and adds durable lifetime generations.
Source artifacts, data and installation identity remain preserved; retirement
metadata changes, and cancellation/committed rollback cannot revive an old execution.
The original 0.2 checkpoint description below is superseded on these points.

Implemented on `develop/0.3`, continuing `3f801a3` / `659e29e`.
This is the bounded manual successor to the [migration plan](developer-defined-migrations.md)
and [declaration contract](developer-migration-contract.md). Automatic orchestration
and a graphical interface are not implemented. See the
[qualification evidence](manual-replacement-qualification-2026-10-18.md) for limits.

Trusted engine exports:

- `planManualReplacement(request, {atStage}?)`: read-only, frozen
  `wydgit.manual-replacement-plan/1`, consumed through `applyPackageOperation`.
- `manualReplacement(request)`: plan and apply through the same publisher.
- `inspectManualReplacement({root, installationContext})`: authenticated
  `wydgit.manual-replacement-inspection/1`, with `pending` and accepted `history`.

The closed `wydgit.manual-replacement-request/1` requires `schema`, `root`,
`action`, `package` and `installationContext`. Optional fields are `candidates`,
`developerMigrations`, `references`, `budget`, `signal`, `parentBudget` and
`verifiedPackages`. Contexts must be authentic, host-only, App-matched and hold
`packages.lifecycle.manage` and `object.instances.edit`. Every selected developer
step still needs exact per-step approval and the host's actual capabilities and
object scopes. Persisted previews never authorize an operation. Package dispatch,
SEWN and third-party code receive none of these operations or host handles.

The host must stop the entire App before beginning and keep its existing writers
stopped. Loading an execution repository or activating a previously loaded model
refuses `PACKAGE.PENDING` throughout retirement/staging/preparation. As with existing
lifecycle operations, this is a cooperating local stopped-host contract, not a
mechanism to stop an already running server or coordinate multiple servers.

| Action | Preconditions and durable result |
| --- | --- |
| `retire` | Installed exact package; no pending workflow. Validate source graph, hydration, bindings and storage ownership. Checkpoint the catalog, configuration and every mapped store. Preserve source entries, receipts, IDs, App serialization, resources and dependency graph in place. Publish `RETIRED` with operation UUID, source receipt/catalog/App hashes. Never detach, prune or delete. |
| `stage` | `RETIRED`; one approved candidate with the same package/publisher and an increasing version, plus `developerMigrations`. Validate the complete proposed upgrade privately. Publish `STAGED` with embedded exact final/intermediate artifacts, developer request, approvals hash, selected lineage, reference inventory, source/target graphs, data fingerprints and target App hash. Accepted data and bindings stay at the source. |
| `references` | `STAGED` or `REFERENCES_PREPARED`; repeat the exact candidate/request and supply the complete preview's `references` array. Recompute and compare the entire preview. Publish only `REFERENCES_PREPARED`; no live reference changes. |
| `migrate` | `REFERENCES_PREPARED`; repeat exact candidate/request and current host approvals. Recompute approved transforms on private source copies, compare the durable preview, validate all intermediates and the final App/graph/bindings/data. Publish target data/configuration/catalog through existing effects. Record the source receipt, preview, target receipt and recovery dependency reservations in history. Activation becomes possible only after reconciliation/cleanup. |
| `cancel` | Any accepted pending phase, with no unresolved resource operation. No candidate, reference or developer fields. Revalidate and checkpoint the current source, remove pending quarantine and restore source availability without replaying or undoing transforms. New source records remain intact. |

Retire/cancel reject migration payloads. Stage/migrate reject a `references` field;
selection is a distinct operation. Without reference preparation the instances stay
parked indefinitely, including when the candidate uses identical prototype IDs.
There is no implicit adoption, duplicate provisioning, expiry or background retry.

All manual phases advance the catalog revision. Retirement advances its schema to
`wydgit-installed/0.2`; current loaders still accept legacy `0.1` catalogs. Older
loaders reject `0.2` rather than ignoring quarantine or recovery reservations.
Legacy/native installs preserve `0.2` and replacement history. Embedded source
receipts and artifacts remain intact; target installation receipts are new and
link back to the source through migration and replacement lineage. Physical
installation-bound storage transitions still refuse.

## Reference and transformation boundaries

`references` is an ordered complete array of exact `{id, fromPrototype,
toPrototype}` entries for the source receipt's managed IDs. Package versions,
artifact identities, installation ownership and source state are bound by the
surrounding preview. Its inventory also records every App object's prototype and
parent/slot/index, package binding/delegation declarations, storage mappings and
managed placements. Instance IDs never change; canonical references to those IDs
therefore stay valid. All schema, binding, inheritance, parent/slot/cardinality,
collision and reverse-dependency checks still run through normal validation.

`wydgit.developer-migrations/1` retains its property-only contract.
`wydgit.developer-migrations/2` changes only the instance prototype rule: exact
publisher-qualified source and target prototypes may differ. It is admitted only
by manual planning; ordinary developer upgrades reject it. The request, hashes,
limits, lossless rename/default grammar, validator grammar and per-step authority
are unchanged. There is no new developer execution surface.

Mappings must be one-to-one at both prototype and instance level, keep the complete
managed footprint and all existing parent/slot/order relationships, and preserve
direct inheritance. Site-authored children and customized values must validate
under the candidate. Site-owned uses of a changed prototype refuse rather than
being silently adopted. Exact old-prototype values in opaque App properties block
adoption; the engine does not rewrite arbitrary JSON, text or URLs. Other definition
and behavior references must satisfy ordinary compilation/hydration/binding checks.
Empty slots added by normal hydration do not move objects.

Splits, merges, changed footprints, ownership transfers, provider changes,
installation-bound rebinding and arbitrary structural transformations refuse.
All source mapped stores, including untouched/no-op stores, are fingerprinted and
checkpointed. Current data, history, revisions and tombstones use the existing
restricted migration engine. Intermediate steps never activate. Stage and reference
preparation deliberately validate the full private migration preview; only an
explicit host operation recomputes it. Restart and recovery execute no declarations.

Dependencies must already be installed and compatible before retirement. Staging
accepts one replacement candidate; missing dependencies or reverse incompatibility
refuse. Source dependencies remain installed with unchanged reasons/protection.
Manual migration never prunes. Accepted source direct/transitive dependencies gain
artifact/receipt reservations. Subsequent cleanup skips them; uninstall or changed
artifacts return `PACKAGE.RESERVED`. No reservation-release/abandonment-of-source
cleanup contract exists yet; operators must retain this evidence and these packages.

## Publication, cancellation and recovery

All phases reuse `applyPackageOperation`, the writer lock, private immutable 0600
checkpoints, WydStore lifecycle barriers and effects recovery. There is no second
journal/transaction system. Every catalog phase checkpoints its complete before
and after images; aggregate checkpoint size stays 4 MiB. The normal shared work,
time, byte, history, record, step and mapping ceilings are unchanged. Manual
reference/inventory scans debit the same operation ledger. Artifacts are checked
again at apply. Stale source records, configuration, catalog or artifacts refuse.

Catalog publication remains the commit point. Stores/configuration can be at
different recorded boundaries while execution is blocked: this is compensating
consistency, not cross-store atomicity. `recoverPackageEffects` defaults to source
before commit and reconciles accepted target after commit. Its existing explicit
host `direction:'resume'` may publish checksum-bound after-images; it never reruns
migration logic. Artifacts can be absent during recovery. A process death during
private planning has no durable effects and leaves the last accepted pending phase.
The optional second-argument planning observer reports `MIGRATION_STEP_<index>`
only to trusted host/test code, outside the closed developer request.

Failed compensation, corruption, unknown ownership or incomplete cleanup retain
barriers/evidence. Cancel cannot bypass recovery or discard unknown resources.
Checked `rollbackPackageEffects` also accepts committed `manual-migrate`: it restores
the prepared, quarantined source at a higher revision only when catalog/configuration
and every store match. Newer content/configuration refuses stale rollback.
A subsequent explicit `cancel` can reactivate that verified source.

Supported cancellation abandons the candidate while retaining the source and all
private checkpoints. Destructive abandonment, checkpoint expiry, secure erasure,
reservation release and arbitrary force reconciliation remain unsupported. If
source validation fails, keep the App blocked with evidence for inspection.

Runtime package versions remain Wydgine 0.3.0-alpha.15, WydClient 0.1.0-alpha.9 and
WydStore 0.1.0-alpha.3; this increment versions serialized contracts instead of
claiming milestone completion. Historical HTTP `SEWN.LIMIT` reliability stays a
separate unresolved blocker. I/I0–I5.6/J assignments and Decision 0003's WydHosting
0.4 deferral, including all six obligations, are unchanged.
