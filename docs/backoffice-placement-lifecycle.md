# Trusted BackOffice placement and replacement — 0.3-J increment 2

The [implemented third increment](backoffice-scoped-policy-and-store-authorization.md)
adds optional host-resolved `identity` to `acquirePackageExecution`, with unchanged
receipt grants and generation fencing. Protected operations revalidate current
site policy. Its site-level Gate/store checks supersede the corresponding deferrals
at this alpha.17 checkpoint; UI, wider domains and live drain remain deferred.

Implemented in Wydgine/platform 0.3.0-alpha.17; WydClient 0.1.0-alpha.11
contains the shared lifetime guard. This extends the
[execution foundation](execution-context-foundation.md) and preserves the
[founding architecture](FOUNDING-ARCHITECTURE.md). BackOffice is an execution
context, not an administrator role, capability grant, or implemented interface.

## Trusted host contract

Native hosts import `wydgine/trusted/packages` (repository compatibility:
`wydgine/packages/index.js`). No operation is registered as a package service,
SEWN operation, HTTP endpoint, browser/session permission or manifest field.
Host modules, local roots and cooperating maintenance writers remain trusted.

Initial installation accepts optional trusted candidate
`serverPlacement: {app: canonicalAppId, context: 'BackOffice'}` through the existing
installer/package-operation API. The manifest remains closed; its prototype and
instance execution declarations restrict compatibility without authorizing placement.
Omitted host placement preserves the existing public FrontEnd installation profile.

Existing installations use:

```js
const plan = await planExecutionPlacement({
  root, package: 'acme/admin', installation: acceptedReceiptId,
  revision: acceptedCatalogRevision, app: canonicalAppId,
  action: 'place', context: 'BackOffice', installationContext
});
// Inspect the frozen plan and use its original in-process identity.
await applyPackageOperation(plan);
```

`executionPlacement(request)` combines planning and application. Actions are
`place`, `replace`, `relocate`, and `retire`. Requests must identify the exact
canonical App, installed package receipt and catalog revision. Friendly names,
matching prototypes, shared workers and membership in multiple Apps contribute
no authority. Package/publisher provenance, attachment ownership, complete Page
subtrees, inherited prototype and instance restrictions, bindings, storage mappings
and the dependency graph are validated before publication. A placement applies to
one installation's existing managed instance footprint and its approved Page
attachments; arbitrary detached objects or changed footprints are unsupported.

The independently issued live host context must have `package:null`, exact App,
`packages.lifecycle.manage` and `packages.placement.manage`. Relocation additionally
requires `packages.placement.relocate`; replacement cannot change context.
Installation/object changes still require existing edit capabilities and exact
visible/editable scopes. These host capabilities have no package runtime provider.
Gate roles, HTTP identity, BackOffice labels and package approvals cannot mint them.
A later Gate policy adapter must independently verify policy before invoking this
boundary. No account/host membership or administrative context is activated.

`acquirePackageExecution({root, package, installation, generation, app, self,
installationContext})` issues a fresh guarded binding only for the exact active
placement and managed instance. The host must explicitly select the accepted
generation; queued old requests cannot silently select a replacement. Grants come
from the installation's exact host-approved receipt, never from the replaced
execution or the host administrative caller. Existing service-level ownership,
capabilities and scopes still apply. Raw contexts/registries remain host-only.
The public HTTP adapter refuses BackOffice and retired placement even when an
installed Page/action is directly requested; there is no administrative transport.

## Transitions and retained state

| Operation | Validation and result |
| --- | --- |
| Initial placement | Exact installed ownership and context compatibility; publish one active generation. Trusted initial installation can stage both definitions and placement together. |
| Same-context replacement | Privately validate the existing footprint and approved authority; publish a fresh generation. A retired placement can explicitly be replaced in its same context to restore availability. |
| Package update/upgrade | Existing staged package lifecycle and migrations; preserve footprint/data, placement context and exact approved grants/mappings; reject weakened inherited restrictions. New receipt and generation receive fresh validation. No implicit authority expansion, even with a newly requested permission. |
| Relocation | Separate host capability, different supported context, full inherited/instance compatibility; fresh generation, unchanged grants and ownership. |
| Retirement | Fresh generation marked `retired`; retain definitions, instance trees, authored values, records, history and dependencies. Execution acquisition and HTTP fail. |
| Removal/reinstall | Existing retained uninstall and dependency protections. Reinstall requires fresh host placement approval, validates retained instances and creates fresh installation authority. Shared/protected dependencies remain protected. |
| Manual migration | Existing retire/stage/references/migrate/cancel effects protocol. Retirement persists a lifetime fence, including legacy FrontEnd installations. Cancellation permits fresh source execution without reviving cached pre-retirement authority. |

The accepted catalog is `wydgit-installed/0.3` whenever placement or retirement
fences exist. Older engines reject this schema rather than ignoring authority
metadata. Legacy 0.1/0.2 catalogs remain readable. Placement records contain exact
`app`, `context`, UUID `generation`, and `active`/`retired` status, mirrored in the
installation receipt. Manual retirement also records a mirrored lifetime generation
for legacy installations. Receipt resource hashes, identity, ownership and recovery
reservations retain their existing checks; changing placement does not rewrite
accepted package artifacts or make a new storage owner.

## Lifetime and in-flight work

Installed public executions and explicitly acquired administrative executions share
SEAM's opaque lifetime fence with derived contexts, callbacks, budgets, object
handles and cached services. Every protected context check observes the accepted
catalog and recovery barriers. A local filesystem metadata stamp avoids repeatedly
parsing unchanged catalogs; inode/size/mtime/ctime or barrier changes trigger full
validation immediately, with no polling interval or cache grace period. A changed
receipt, generation, ownership, pending manual workflow, retirement, missing catalog
or unresolved operation fails closed and permanently ends that execution lifetime.
Unrelated completed package changes can preserve an unchanged installation binding.

The dispatcher rechecks caller lifetime before provider entry and after asynchronous
completion. Old callbacks cannot borrow a privileged callee's context or construct
new package authority. A provider already admitted before a fence may have committed
a side effect; rejecting its result does not undo it.

**Maintenance is a stopped-App, drained-writer contract.** Stop new work and await
already admitted provider work within its existing execution/provider deadline
before invoking lifecycle mutation. If draining cannot complete, do not cut over.
This API does not implement host drain orchestration, enforce a cross-process
provider cancellation deadline, or preempt native code. It qualifies fencing at
protected boundaries, not atomic cancellation of in-flight external effects. Hosts
must not use it as a live replacement API. Enforced multi-worker drain/cancellation
requires additional infrastructure outside this increment.

## Recovery and rollback

Plans are private staging and expose no target execution. Losing a plan before
publication leaves the accepted source intact. Catalog publication reuses the
exclusive writer lock, checksummed journal, synced temporary catalog, atomic local
rename and directory synchronization. Stale revisions/fingerprints and conflicting
receipt or ownership metadata reject. The lock blocks execution during ambiguous
publication and cleanup; recovery must reconcile before acquiring fresh authority.

After writer exit, inspect and call existing `recoverPackageOperation`; effects
operations use `recoverPackageEffects` and its existing checkpoint/compensation
contract. Precommit recovery preserves source; postcommit recovery recognizes the
accepted target and completes cleanup. Retry only against the reconciled catalog.
An original plan is consumed before application; a committed request's old revision
fails. Repeated inspection/recovery cannot duplicate placements; catalog recovery
requires an outstanding lock and refuses a second recovery after cleanup.

Placement-only operations do not touch WydStore data. Updates with storage effects
retain existing private source checkpoints and exact before/after validation;
rollback refuses newer data/configuration and issues fresh lifetime generations
for restored installations rather than restoring old execution authority. No atomic transaction across catalog,
JSON/SQLite stores, processes or external services is claimed. Hardware power loss,
network filesystems, hostile native host writers and distributed leases remain
unqualified. Old live installations are not migrated by this change.

## Qualification and deferred work

`test/backoffice-placement.test.js` adds BOP-01–BOP-13 for authorization, canonical
site/receipt/revision checks, reserved context denial, public HTTP exclusion,
neutral/restricted prototypes, replacement, relocation, retirement, stale handles,
derived callbacks, cached services, manifest/instance restrictions, replacement/retirement crash boundaries, asynchronous provider authorization/completion,
committed rollback and cancellation fencing, JSON/SQLite record/history retention and shared dependency preservation.
Existing manual migration tests now use an independent host maintenance writer for
intentional source drift and explicitly reject stale retired package services.

| Acceptance case | Qualified subset / remaining boundary |
| --- | --- |
| CTX-05 | Trusted placement cannot come from package metadata, ordinary FrontEnd authority, another App or privileged callee. AccountAdmin/HostAdmin unavailable. |
| CTX-06 | Automatic installed-execution lifetime fencing on replacement/relocation/retirement and recovery barriers. Native in-flight cancellation/live drain orchestration deferred. |
| MIG-02 | Local catalog crash reconciliation and retained JSON/SQLite lifecycle regressions. General live migration, distributed writers and power-loss durability unqualified. |
| LIF-01 | Shared dependency vetoes, retained uninstall/reinstall and records/history preserved. Existing protected-package/reservation regressions retained. |
| ADM-01 | Host operation authorization and public HTTP denial only. Scoped live Gate policy, UI contributions and administration interface deferred. |

Full multi-tenant/domain-aware WydStore ownership remains the next storage boundary.
Current exact App/publisher/package/installation and collection checks are preserved;
context labels do not establish account/provider domains. Also deferred: BackOffice
UI, account/host activation, provisioning, privileged brokers, changed footprints,
automatic authority-policy expansion and live deployment. Managed WydHosting stays
in 0.4. The intermittent `SEWN.LIMIT` HTTP 500 issue remains open regardless of
subsequent passing runs. Test-run evidence is recorded below after verification.


Verification on 2026-10-18 (Node 24.21.0), starting from clean `develop/0.3`
commit `ab3dce8` (platform alpha.16, client alpha.10; reported baseline 1,337):

- Dedicated placement qualification: 21 passed, including six SIGKILL
  replacement/retirement boundaries, JSON/SQLite rollback and retention, and
  asynchronous authorization/completion fencing.
- Final focused context/placement/package/migration run: 116 passed.
- Focused manual/placement run: 142 passed before the last rollback/crash additions.
- Focused HTTP/hosting/media/placement regression run: 27 passed.
- Full suite before the last seven qualification additions: 1,351 passed.
- Expanded full suite: 1,358 passed, zero failures.
- `npm run check`: passed (three complete pages, 42 internal links and unique anchors).
- `git diff --check`: passed. Historical versioned client distributions unchanged.

The initial sandboxed full run reported 104 file-level tests, 75 passed and 29 failed,
including native Node subprocess failures; it is not a valid functional baseline.
An intermediate unrestricted run caught expected version assertions and stale-service
regressions, plus existing Contact/hosting HTTP 500s; these were investigated, not
hidden by larger budgets. Lifetime checks now use immediate filesystem metadata
invalidation and full validation on change. Subsequent focused HTTP and full-suite
runs passed. No execution limit, historical artifact or security check was weakened.
These results do not close `WYDGINE-0.3-HTTP-LIMIT` or qualify live replacement.
