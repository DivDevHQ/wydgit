# Reviewed package policy reconciliation — 0.3-J foundation increment 4

**B3 architecture ratification (2026-10-21):** the Project owner approved
[DEC-01 Page entry/bindings and DEC-02 action resource maxima](backoffice-page-and-action-contracts.md).
B3 adds read-only preflight/contract validation only. Historical implementation
checkpoints below retain their dates; production action dispatch remains receipt-wide
until reviewed migration and the later enforcing increment. No new Page HTTP entry
or caller/resource authority is activated by this ratification.

The [modular BackOffice action framework](backoffice-action-framework.md) supplies
installed site-scoped actions. The [alpha.21 HTTP adapter and generic shell](backoffice-http-and-ui.md)
make those actions available in a browser while preserving independent Gate/SEAM
and lifecycle checks. Full administrative coverage, AccountAdmin and HostAdmin remain deferred.

Implemented backend contract in platform/Wydgine/WydHosting **0.3.0-alpha.19**.
WydClient stays alpha.11, Gate alpha.5, Store alpha.4. No administration UI,
HTTP endpoint, portable service or SEWN operation is introduced.

## Three independent contracts

1. **Package requirements** are the immutable accepted manifest, resources,
   dependencies and requested permissions. They request authority; they grant none.
2. **Host-approved policy** is the installation's approved grant subset plus the
   trusted operational authorization rules of its existing, exclusively owned
   mapped stores. It has its own increasing `policyRevision`; absent means zero.
3. **Effective authority** is further constrained at execution by inherited
   context restrictions, placement, lifetime, SEAM, exact resource ownership and
   current Gate policy. A reviewed grant is never proof of membership or permission.

Reconciliation changes only (2). Requirements, package artifacts, installation ID,
package revision, instance footprint, placement context, store mappings, ownership,
records, revisions, tombstones, history and dependency bindings remain unchanged.
Any ownership/mapping/schema/dependency/placement migration requires its separate
trusted workflow; unknown or extra request fields reject. AccountAdmin/HostAdmin
remain unavailable. Nothing modifies Gate users, memberships, roles or permissions.
Introducing a permission name never assigns that permission to existing users.

## Native host API

Import from `wydgine/trusted/packages`; repository compatibility exports are in
`wydgine/packages/index.js`. Every stage requires a live, independently issued
server `ExecutionContext` with the exact canonical App, `package:null`,
`installation:null`, **both** `packages.lifecycle.manage` and
`packages.policy.manage`. These capabilities have no ordinary package provider.
FrontEnd/BackOffice labels, App ownership, Gate administrator role and Session
permissions cannot create either grant. A native host remains responsible for
independent operator authorization before constructing that context.

```js
const plan = await planPackagePolicy({
  root, app, package: packageId, installation: receipt.id,
  revision: catalog.revision,
  packageRevision: receipt.revision, // package install/update revision
  policyRevision: entry.policyRevision ?? 0,
  policy: {
    grants: proposedPermissions, // capabilities/traversal/visible/editable/scopes
    stores: [{store: 'app-data', authorization: proposedStoreAuthorization}]
  },
  installationContext: policyOperator
});
// Inspect the entire frozen plan. Only its original in-process identity approves.
const approval = await approvePackagePolicy(plan, {
  installationContext: policyReviewer,
  allowExpansion: true // required explicitly when plan.expanded; native host only
});
const request = {
  root, app: plan.app, package: plan.package, installation: plan.installation,
  revision: approval.revision, packageRevision: plan.packageRevision,
  policyRevision: plan.policyRevision, approval: approval.id,
  planHash: plan.sha256, installationContext: policyOperator
};
await applyPackagePolicy(request);
// Alternatively, before application: await cancelPackagePolicy(request);
```

`inspectPackagePolicy` is synchronous and read-only; the four changing/planning
functions are asynchronous. After a lost approval acknowledgement or ordinary
restart, retrieve its durable binding with:

```js
const inspection = inspectPackagePolicy({
  root, app, package: packageId, installation: receipt.id,
  installationContext: policyOperator
});
const approval = inspection.approval; // pending exact plan + approved catalog revision
```

Inspection requires the same independent authority and exact installation selection;
it returns current requested/approved grants and revisions, plus pending approval
for that installation or `null`. It does not mint approval. `policy.stores:[]` preserves every store
operation policy. Each listed store replaces its complete operational policy;
`authorization:null` explicitly removes the optional policy, retaining ordinary
SEAM/scope/ownership checks. Rules use existing `wydstore.authorization/1` validation.
A store must belong to this exact App/publisher/package/principal and optional
installation, all its collections must be mapped by this installation, and no
other installed/retained package or private library binding may reference it.
Private canonical-library and shared stores refuse with `PACKAGE.OWNERSHIP`.

`packageRevision` is the accepted receipt's installation/update revision, separate
from the current catalog revision. The plan also pins the package version and
SHA-256 of its accepted manifest/resources. Receipt ID, full source catalog hash,
base/configuration fingerprint, current/proposed policy revisions and exact
canonical App are independently bound. Friendly names select none of them.

Plans expose requested and current/proposed approved grants; added/removed grant
sets; concrete storage/library scopes; before/after store rules, owners and
collections; authority classification; unchanged context/dependency summaries;
no-migration and retained-data statements; source revisions and a canonical hash.
Object grant containment uses existing literal trailing-prefix rules. Planning is
read-only, deterministic for the same accepted state/input, and bounded to 64 KiB
of review evidence plus existing lifecycle work/time/state limits.

## Review and expansion

Approval is a deliberate native host action on an original frozen plan, with
fresh independently checked lifecycle/policy authority. A copied/modified JSON
plan, arbitrary Boolean, package-supplied principal or context label cannot approve.
`allowExpansion` is meaningful only inside that authenticated native boundary.
It is not a portable authorization assertion. Reductions and equivalent changes
also require approval and exact revisions.

Grant subsets must remain within current package-declared requirements. Expanded
capabilities, object/traversal/prototype/library or logical collection scopes are
classified by set containment. A new allowed store operation, wider context list,
public access replacing a permission, removal of an existing operation policy, or
change to a different permission is conservatively expanded. Permission implication
is never inferred from roles or current assignments. Added resolved library
scope evidence is conservatively expanded; changed accepted library versions
require a separate dependency workflow.

Updates of reconciled installations preserve their exact approved subset even
when a newer manifest requests more authority. They cannot approve those requests.
Reconcile against the accepted new declarations afterward to approve additions.
A legacy exact-grant update which changes grants still rejects; an equivalent
reconciliation first establishes the separate policy contract. Requirements that
remove an existing grant must be preceded by reviewed narrowing. Updates cannot
silently restore grants removed by reconciliation, including retained reinstall.
Context relocation continues to require the separate placement lifecycle and its
capabilities; policy requests cannot weaken prototype/instance restrictions.

## State, audit and fencing

| Boundary | Durable state and availability |
| --- | --- |
| Plan | No writes; loss of process/plan leaves source unchanged. Replan after restart. |
| Approve | Existing catalog journal atomically publishes one `policyReconciliation` approval; catalog revision increases, active policy stays unchanged. |
| Pending review | Entire App unavailable; package install/update/uninstall, manual replacement, placement and competing policy plans refuse. |
| Apply | Rebuild and compare the exact reviewed effects, checkpoint source/target configuration and catalog, stage configuration, then publish the catalog commit. |
| Committed | Pending approval removed, policy/catalog revisions increased, outcome recorded, fresh execution generation required, then writer barriers cleaned. |
| Cancel | Existing effects workflow removes only pending review; source policy unchanged, catalog revision and lifetime fence advance, cancellation recorded. |

Catalog **`wydgit-installed/0.4`** prevents older engines ignoring pending approval,
policy revisions or audit metadata. Catalogs 0.1–0.3 remain readable; there is no
bulk migration. The approved plan, UUID, reviewer and approval time persist in the
catalog, so apply after an ordinary process restart needs no in-memory token.
Apply/cancel requests contain exact revision/approval/hash bindings; a committed or
cancelled approval cannot be replayed. Concurrent operations share the existing
exclusive package lock and fingerprints; one approved policy can commit at a time.

The catalog retains the latest 32 applied/cancelled review records, including full
reviewed plan, reviewer and applying native caller. Existing immutable private
checkpoints preserve source policy and approval evidence. Journals still describe
the latest operation, not an unlimited audit archive or signed nonrepudiation log.
Native host modules and local catalogs/configuration remain trusted; hashes detect
inconsistency, not a malicious administrator who controls all trusted files.

Apply/cancel renew lifetime generations; existing guarded contexts, derived
contexts, callbacks, object handles, cached services and drafts cannot regain old
authority. Placement context/status is preserved; a fresh same-context generation
does not relocate or activate a retired installation. Reconciled receipts also checksum their exact grants, concrete scopes, mappings,
policy revision and immutable installation/site identities; editing mirrored grants
without valid integrity evidence fails `PACKAGE.DRIFT`. Config-file changes also
invalidate the installed-execution metadata guard. Restart with fresh registries
before execution: operational policy is immutable inside a loaded registry. Native
hosts must close old raw registries and must not bind fresh contexts into them.

## Stopped-App and recovery guarantees

Approval, application, cancellation and policy recovery require a stopped App.
Same-process App creation/initialization and HTTP admission hold execution leases;
maintenance refuses while any such owner is running or draining. Maintenance holds
a local reservation against startup. HTTP teardown waits for admitted request work
to settle before releasing that lease. Existing multi-App direct admission/drain
continues to apply. Raw native library callers must separately drain and close
resources; they do not become tracked App execution merely by importing a library.

**Other processes must be stopped and drained by the trusted host/operator.**
There is no OS-level App lock, process discovery, distributed lease, hot policy
cutover or native cancellation guarantee. The existing filesystem writer lock
serializes cooperating lifecycle writers across processes; it does not prove all
execution processes are stopped. Already admitted external/native effects cannot
be undone by a fence. Do not apply if draining cannot complete.

Approval uses the existing synced catalog transaction. Its interrupted writer is
reconciled after exit by `recoverPackageOperation({root,installationContext})`:
before publication source survives, after publication pending approval survives.
The existing catalog recovery marker requires manual inspection if that small
recovery itself is killed; this increment does not invent missing recovery evidence.

Approval preflights both apply and cancellation checkpoints, including 2 KiB of
headroom for a different bounded audit caller. Oversized source/target combinations
refuse before reserving the App. Native audit principals are bounded to 1 KiB.

Apply/cancel reuse `package-effects.json` and checksum-bound 0600
`package-checkpoint-<uuid>.json`, under the existing 4 MiB combined ceiling.
`recoverPackageEffects({root,installationContext})` compensates precommit staging;
`direction:'resume'` may complete the exact approved target. After catalog commit,
recovery always finishes that target and rejects rollback. Interrupted effects
recovery is restartable; repeated terminal recovery validates exact evidence and
is idempotent. Missing/corrupt/foreign evidence or newer files refuse and retain
barriers. Recovery of policy operations also requires both policy/lifecycle grants.

A handled staging failure restores the exact previously approved source and pending
approval; retry only after successful compensation/recovery, using that still-current
approval. Publication with lost acknowledgement reports `PACKAGE.RECOVERY`, never
uncommitted success. Committed policy rollback through `rollbackPackageEffects` is
unsupported: any reverse change needs a fresh reviewed plan, including explicit
expansion approval. This prevents committed narrowing from being silently undone.
Older update checkpoints cannot replace newer policy because exact state/config
checks fail stale. Precommit compensation restores source policy because no target
policy has committed; it cannot undo an already committed narrowing.

The catalog is the local commit point. Configuration and catalog may individually
be old/new while execution is blocked. This is recoverable compensating consistency,
not cross-resource/process/database atomicity. JSON/SQLite records are not rewritten
by policy reconciliation; no data migration, purge or ownership transition occurs.
Tests qualify ordinary process termination and local fsync/rename behavior. Hardware
power loss, network filesystems and hostile native writers remain unqualified.
Checkpoint plaintext configuration/content needs authoritative-data protection.

Direct accepted configuration edits still fail **`PACKAGE.DRIFT`** at startup,
planning, review, apply and installed execution guards. Reconciliation starts from
valid accepted state; it does not bless a drifted file or rewrite acceptance hashes
on detection. Restore exact accepted configuration before proposing a change.

## Acceptance coverage and qualification

`test/policy-reconciliation.test.js` uses real JSON/SQLite stores and subprocess
SIGKILL/restart tests. Existing placement, Gate/store, manual migration, retention,
public-read/draft and lifecycle security regressions remain required.

| Mission cases | Evidence / qualified behavior |
| --- | --- |
| 1 | POL-01 deterministic read-only plan |
| 2 | POL-01 equivalent reviewed apply |
| 3–5 | POL-02 narrowing, explicit expansion, refused unapproved expansion |
| 6–9 | POL-03 package self-approval, FrontEnd/BackOffice and Gate role denial |
| 10–13 | POL-04 forged App/receipt, stale package/policy/catalog revisions |
| 14–15 | POL-04/05/19 copied/modified plan/hash, durable tampering and replay denial |
| 16 | POL-09 competing operations/racing startup; POL-23 real cross-process apply/cancel finishing during validation |
| 17–18 | POL-06 running/draining approval refusal; pending review/start exclusion |
| 19–20 | POL-04/20 context changes and reserved administrative contexts rejected |
| 21 | POL-10 handled staging failure restores exact valid source |
| 22–23 | POL-11/12/13/18 interrupted approval/publication, repeated/interrupted resume and compensation; corrupt evidence refusal |
| 24 | POL-07/12/17 old services, contexts/derivations, object handles and drafts fenced |
| 25 | POL-08 direct host-policy drift remains refused |
| 26–27 | POL-07/12/14 JSON/SQLite complete record/history checkpoint hashes preserved |
| 28 | POL-14 shared dependency veto and retained reinstall; POL-20 private binding veto |
| 29 | POL-03/04/15 exact site, root and independent receipt binding; existing scoped-policy site isolation suite |
| 30 | POL-07 public get/query, ordinary local draft and denied protected save; existing scoped-policy/lifecycle regression suite |
| Additional | POL-24 mirrored grant/scope drift refuses; POL-21 preapproval checkpoint ceiling; POL-22 real Gate users receive no new permission automatically; POL-16 widened upgrade declarations preserve reviewed subset; dependency-version drift, strict schema/ownership rules and checkpoint corruption refuse |

Deferred qualification: cross-process execution/drain enforcement, production data
or ownership migrations, shared-store policy changes, distributed/hot cutover,
unlimited audit retention, power-loss/storage hardware guarantees, administration
UI, AccountAdmin/HostAdmin and WydHosting 0.4 managed tenant qualification.

The initial unrestricted baseline had **1,384 passed / 2 failed / 1,386 total**:
Contact JSON concurrent HTTP and hosting operational startup returned HTTP 500.
The sandboxed attempt also had native subprocess failures and is invalid functional
evidence. Neither run closes the independently open
[SEWN.LIMIT reliability issue](milestones/0.3-reliability.md).
Additional completed verification:

- Dedicated reconciliation suite before the last race additions: 43 passed; includes
  both provider/Gate variants, durable approval inspection and checkpoint size refusal.
- Earlier package/placement/migration/site-policy regression run: 142 passed.
- Media/provider/authority-graph regression run: 28 passed. Intentional raw host-policy
  fixtures now first assert installed authority is fenced, then use independent native
  host callers; provider security and limit assertions remain unchanged.
- Launcher/HTTP lifecycle regression run after alpha.19 expectation updates: 23 passed.
- Second full integration run: 1,428 passed / 1 failed / 1,429 total. The sole failure
  is the existing JSON Contact concurrent `SEWN.LIMIT` HTTP 500 (timeMs exhaustion).
  Subsequent isolated Contact plus reconciliation run: 48 passed. This is not a fix
  or closure claim for that reliability issue.
- Complete suite after the cross-process race correction, before the last receipt
  integrity addition: **1,431 passed / zero failures**. The historical HTTP issue
  remains open regardless of this passing run.
- `npm run check`: three complete pages, 42 internal links, unique anchors.
- `npm ls --all --json`, whitespace checks and 146 relative Markdown file links
  across changed documents passed. Package dry-run includes the new trusted modules.
  Client/regex generation produced no tracked artifact changes; historical bytes
  remain unchanged.

The final commit's validation record reports the final complete suite after the
cross-process race and receipt-integrity corrections. No test budget, HTTP reliability implementation or
security assertion was weakened.
