# Trusted local package lifecycle

Status: implemented **bounded local catalog and checkpointed storage lifecycle**,
with release blockers below. This is not full production package lifecycle qualification. See the
[audit and qualification record](milestones/0.3-package-lifecycle/README.md).
The existing I hosting and J administration identifiers are unchanged.

The [developer-defined migration plan](milestones/0.3-package-lifecycle/developer-defined-migrations.md)
specifies a future retire-in-place, replacement-reference and Migrate Data
framework, including automatic upgrades through complete compatible paths.
It is planning only; the implemented host-approved lossless migration and
retained-uninstall contracts below remain unchanged.

## Host API and approvals

The native installer remains the package manager. Trusted host code imports
`planPackageOperation`, `applyPackageOperation`, `packageOperation`,
`createPackageBudget`, `inspectPackageOperation`, `recoverPackageOperation`,
`inspectPackageEffects`, `recoverPackageEffects` and `rollbackPackageEffects` from
`wydgine/packages/index.js` (repository compatibility path). No package-facing
service, HTTP administrative endpoint, automatic download, package scan, npm
installation or arbitrary cleanup hook is added.

```js
const plan = await planPackageOperation({
  root,
  action: 'install',
  package: 'acme/forum',
  installationContext, // host-issued, correct App, package:null
  candidates: [forumOptions, profilesOptions]
});
// Inspect the frozen plan before using the original in-process object.
const result = await applyPackageOperation(plan);
```

Each candidate uses the existing installer options: explicit local `packagePath`,
exact `approvals`, physical `storageMappings`, placement, and optional initial Page,
attachments/navigation/properties/static-library build context. Dependencies receive
separate exact approvals; neither a parent's permissions nor its installation reason
grants them authority. Candidate identity comes from the validated manifest, not the
inventory name. Source files are copied into the accepted catalog. Local server
packages retain the existing host-trusted local-source policy; this does not introduce
publisher signatures, a registry, or remote distribution trust.

New operations require a branded host ExecutionContext with
`packages.lifecycle.manage`, `package:null` and the exact App ID. Object changes
additionally use existing `object.instances.edit`, visibility and edit scope checks,
including descendants, parents and siblings. Roles and Session permissions grant
none of these capabilities. Ordinary package permission approval cannot activate
`packages.lifecycle.manage`: it has no package runtime provider. Existing single
install APIs retain their operator-edit contract and now also reject a package
principal as the installation context. No SEAM scope or runtime authority is unioned.

Use this API on a **stopped App**, under the same trusted local root/writer model as
the installer. A running host rejects catalog changes until restarted. There is no
hot-upgrade/drain orchestration or distributed writer lease in this API.

## Graph and installation reasons

The closed server manifest accepts optional `dependencies`, a map of complete
publisher-qualified package IDs to standard semver ranges. Prerelease versions
require an explicit matching prerelease series in the range; a stable range such
as `^1` does not silently admit them. This is separate from
`requires.libraries`, pinned static build libraries and pinned interfaces. Application dependencies are rejected for CLIENT authoring. Optional
package dependencies, multiple installed versions, dependency aliases and registry
selection are unsupported. Runtime libraries must already be host-enabled; their
ownership and infrastructure are never pruned as application packages.

The manager builds a graph from installed manifests, recomputes reverse edges,
checks every version constraint and rejects cycles, missing dependencies and duplicate
identities. A new dependency must have an explicitly supplied approved candidate.
Compatible installed dependencies are reused. Incompatible candidates are rejected
unless the complete proposed graph, including existing reverse dependents, is valid.
No reference count or first-installer ownership controls removal.

Every new receipt and catalog entry records `reason` (`explicit` or `automatic`),
`protected` and the dependency declaration. Legacy receipts without these fields
are treated as explicit installations. Receipt/catalog disagreement fails startup.
Reasons and protection survive updates and recovery. `promote` or a repeated
`install` of identical resources promotes an automatic package without reinstalling.
An update of an automatic package preserves its reason. Host `protectedPackages`
policy marks new selected packages; canonical publisher packages are also protected.
This is host policy; a package manifest cannot set or clear protection.

Removing a required package returns `PACKAGE.DEPENDENTS`. Uninstall first plans
removal of the primary package, then checks its reachable dependencies in reverse
topological order. Only automatic, unprotected packages with no remaining incoming
edge can be pruned. Explicit/protected nodes stop their own removal and consequently
retain their required descendants. Cleanup does not sweep unrelated automatic
packages. `prune:false` retains dependency installations. Updates that remove edges
use the same recursive cleanup. All removals in one plan publish together, so failed
cleanup cannot partially remove a shared dependency chain.

## Updates, upgrades and preservation

Actions are `install`, `update`, `upgrade`, `uninstall`, `promote` and `purge`.
A primary install does not silently update a different installed version. An
identical repeated install/update preserves the installation receipt. Updates must
advance the version within the previous version's semver caret range; incompatible
transitions (including 0.x minor changes) require explicit `upgrade`. Downgrades are
unsupported. A changed artifact under the same version is rejected.

Definitions, bindings and separately approved permissions can change. Existing
App-owned instance trees and properties are preserved, then hydrated/validated
against the new registry. New prototype defaults can fill missing values through
ordinary hydration. The instance footprint and placement must stay compatible;
renaming/removing instances and arbitrary transformations fail before publication.
Incompatible definitions need an explicit versioned migration as described below. Package templates never overwrite administrator settings
or authored content. Created Pages remain App-owned and are reused on reinstall.
Navigation removal only removes one exact original item; ambiguous/customized items
remain, with a plan warning.

### Versioned, lossless migrations

An unchanged schema still needs no migration. A changed schema requires explicit
host-approved `migrations` on `planPackageOperation`; ordinary package code cannot
supply or execute a migration hook. Each bounded `wydgit.package-migration/1`
approval names the exact package, source/target package versions, storage changes
and managed-instance changes. The supplied versions must form one ordered chain
from the installed version to the accepted candidate. Gaps, duplicates, unrelated
steps and unused approvals fail before publication. The dependency graph is
validated before any migration; reverse dependents can veto an upgrade.

Storage declarations may carry paired `schemaId` and positive integer
`schemaVersion`. Legacy unversioned collections start at version 1. Each storage
step advances exactly one schema version and specifies the resulting fields.
Only lossless field renames and defaults for missing values are supported:

```js
const migrations = [{
  schema: 'wydgit.package-migration/1', package: 'acme/book',
  from: '1.0.0', to: '2.0.0',
  storage: [{name: 'entries', from: 1, to: 2,
    fields: {body: {type: 'string', required: true}},
    operations: [{op: 'rename', from: 'message', to: 'body'}]}],
  instances: []
}];
```

Renames refuse an occupied destination; defaults never overwrite values. Current
records and every historical value are transformed and validated under the target
schema; record IDs, revisions, tombstones and history ordering are retained. The
private recovery checkpoint retains the original historical values and schemas.
The final schema must exactly match the candidate manifest and configured mapping.
Ownership, uniqueness, record-byte, work and aggregate checkpoint ceilings apply.
New stores/providers/ownership or unmapped collection removal are not migrations.

An instance step names an exact managed instance ID, its current and target
prototype, and the same bounded property operations. IDs, placements and the
managed footprint remain fixed. Normal candidate hydration validates the complete
result, including site additions. Explicit property/prototype transitions can
therefore support incompatible definitions without replacing owner customization.
Arbitrary restructuring, destructive operations, coercions, JavaScript/SQL, hooks
and installation-bound store identity transitions fail closed. They need separately
reviewed contracts; no irreversible transformation is currently supported.

Checkpointed upgrades can be undone with `rollbackPackageEffects` only while the
catalog, configuration and every affected store still match their committed
checkpoints. New content or configuration makes rollback fail stale before effects;
no newer data is discarded. Rollback is a fresh serialized operation with an
increasing catalog revision. It is not an unconditional downgrade or rollback of
an arbitrary older operation. Catalog-only operations without a checkpoint have
no committed rollback guarantee.

## Uninstall, retention and purge

Uninstall removes executable catalog entries and detaches their installed App trees
using the normal authorized mutation API. Receipts, embedded package definitions,
configuration and detached trees are retained in `retained` in the same catalog.
Trees use canonical serialized envelopes, preserving properties and site additions.
WydStore content, history, host configuration, filesystem roots, shared library
resources and created Pages remain intact. Retained instance IDs are reserved
against unrelated installations. A subtree containing another installed package's
managed IDs vetoes removal. A registry that cannot hydrate the remaining App also
vetoes the operation; there is no force-delete fallback.

Reinstall validates the supplied package, grants and mappings, restores the saved
trees, reuses existing Pages and validates the resulting App. Compatible versions
may be installed over retained data; incompatible versions require separate recovery
or migration rather than silently destroying that data.

`purge` is separate from uninstall. Catalog-only retained snapshots remain
purgeable when they contain no site-owned additions or physical resources.
Physical WydStore purge additionally requires
`purgeAuthorization: {package: 'publisher/package', content: true}` and an original
host plan. Plans expose provider, exact owner, collection definitions and before/
after checkpoint hashes. The plan labels active-store deletion and checkpoint
retention explicitly. Ordinary uninstall never grants content deletion.

Both JSON and SQLite can purge an entire, exclusively owned store. Every configured
collection must be mapped by the retained package. App, publisher, package,
principal, schema and persisted adapter ownership are checked. Another installed/
retained package reference or runtime-library binding vetoes deletion. Linked or
corrupt files, ambiguous ownership, unknown sidecars, installation-bound storage
and shared canonical-library scopes refuse safely. No broad filesystem or SQL
cleanup is used. Other files and the store's directory remain intact.

The active adapter file and its host mapping are removed within the recoverable
effects workflow. A precommit interruption restores the complete store, including
history. An interruption after catalog publication finishes the purge. Private
0600 recovery checkpoints remain intentionally retained under `content/`; purge
is **not secure erasure**, backup deletion, encryption or a retention-expiry
service. Checkpoint retention/removal needs explicit administrator policy. Existing
App Pages remain site-owned. Shared media/search/files resources remain unsupported.

## Publication, failure and recovery

Read-only planning validates the proposed graph, registry, bindings, grants,
placements, storage ownership/schema, state-size ceiling and fingerprints. Plans expose exact candidate resource hashes, requested/approved grants, mappings,
retention summaries and both dependency graphs. Plans
are frozen in-process objects, not JSON authorization tokens. New operation plans
are consumed on apply; failed or stale operations require a fresh plan.

Catalog-only operations (including the existing install API when host configuration
is unchanged) share the exclusive `.package-install.lock`. Publication writes and
fsyncs a private candidate file, publishes a synced operation journal, rechecks base
and catalog hashes, atomically renames the candidate over the catalog and fsyncs
the content directory. Instances, receipts, retained data and graph change in that
single document. This is local-filesystem atomic publication, not a transaction
with external providers, HTTP requests or host configuration.

`content/package-operation.json` records the latest operation's ID, writer PID,
action/changes, before/after catalog hashes, base hash, exact temporary filename and
status: `PLANNED`, `APPLYING`, `COMPLETED`, or `FAILED`. A lock, recovery marker,
unrecognized/incomplete journal or infrastructure backup blocks startup. A handled
prepublication failure records `FAILED` and leaves the old catalog. Failure after
rename returns `PACKAGE.RECOVERY` and retains evidence/lock until recovery. If a
failure record cannot be saved, the lock remains. Cancellation after publication
cannot report an uncommitted operation. The latest journal is replaced, not an
unbounded audit archive; installation receipts remain in the accepted catalog.

After the writer process has exited, the host can call:

```js
await recoverPackageOperation({root, installationContext});
```

Recovery authenticates host authority and serializes recovery, refuses a live or
indeterminate writer PID, verifies lock/journal identity, exact base/catalog hashes,
validates the accepted catalog and marks either `COMPLETED` (new catalog present) or
`FAILED` (old catalog present). It removes only the exact named temporary file and
matching lock. It never replays package code, infers a destructive rollback, removes
unknown files, or discards an unrecognized catalog. PID reuse can conservatively
block recovery. Interrupted recovery itself requires manual inspection of its marker.

### Recoverable local provisioning and adapter effects

The operator installer now passes durable infrastructure descriptors instead of an
in-memory preparation/cleanup callback. New schema stores, instance trees, grants,
configuration, initial properties and navigation are provisioned before activation.
New directories receive operation-bound ownership claims; prospective roots must
still be unused on apply. Private provider staging avoids publishing a partially
initialized SQLite file. Recovery never adopts an unrelated existing directory.

`content/package-effects.json` records the latest resource operation and references
an immutable, checksum-bound, 0600 `content/package-checkpoint-<uuid>.json`. That
checkpoint includes exact before/after configuration, catalog and adapter documents,
plus the directories this operation may create. The **combined** checkpoint is
limited to 4 MiB, including both catalog versions and all adapter data; each
migration approval is limited to 64 KiB. Larger operations refuse rather than losing
recovery coverage. Checkpoints contain plaintext user data and configuration;
they must receive the same access and backup protection as authoritative content.

The existing package writer lock serializes catalog and effects operations.
Per-store lifecycle barriers reject ordinary adapter calls while reconciliation is
pending. JSON replacement is fsynced atomic rename using an operation-specific
temporary name. SQLite replacement uses its fixed native transaction/schema;
package code never receives SQL or provider handles. Each store may be old or new
while the App is blocked; this is compensating multi-resource consistency, not a
cross-database atomic transaction. Catalog publication is the commit point.

A handled precommit error restores the recorded store/config/catalog state. Failed
compensation retains barriers and checkpoint evidence. Unknown content, changed
ownership or state outside the two recorded boundaries is preserved and requires
explicit reconciliation. Cleanup removes only exact owned files, claims and empty
owned directories; a durable per-directory cleanup record covers interrupted claim
removal. An old root is never recursively deleted. Cancellation before commit
compensates; cancellation after commit cannot turn success into an uncommitted retry.

After the writer exits, trusted host code can call:

```js
await recoverPackageEffects({root, installationContext}); // abort before commit
await recoverPackageEffects({root, installationContext, direction: 'resume'});
```

Recovery authenticates the App/host context, rejects live/indeterminate writer PIDs,
validates checksum/base/config/catalog/adapter boundaries and compares actual data
before every retry. It does not replay package code. An interrupted recovery can
be resumed, including its final cleanup. Recovery admission uses live chooser/ticket
claims so two reclaimers cannot steal each other's marker. PID reuse can still
conservatively block recovery. Host recovery accepts an optional authenticated
shared `budget`; otherwise it creates one bounded maintenance budget. Mandatory
precommit compensation is size-bounded maintenance, not new package execution.

`recoverPackageOperation` routes an effects writer lock to this recovery path;
`inspectPackageEffects` exposes its sanitized resource summary and checkpoint hash.
New catalog-only operations keep the original smaller journal/recovery path.
Old unversioned `.package-infrastructure.json` records still block startup and need
manual ownership reconciliation: this implementation does not invent missing
resource ownership evidence for an older interrupted installer.

Power-loss behavior depends on actual filesystem fsync/rename guarantees. Tests kill
ordinary processes; they do not qualify storage hardware, network filesystems or
power-loss recovery. Host writers and local implementation modules remain trusted.

## Budgets and errors

`createPackageBudget(context,{signal,parentBudget})` returns an opaque host token.
The operation shares this ledger across dependency planning, changes and publication;
passing `budget` shares work across repeated/subordinate operations. Attach the
cancellation signal and optional parent when creating a shared token, rather than
passing new signal/parent options alongside it. Maximum values
are 65,536 work units and 30,000 elapsed milliseconds, reducible by
`context.limits.packageWork` and `packageTimeMs`. An attached parent SEWN token must
belong to the same context; work debits its existing steps and deadline checks.
Creating a new child context never occurs in the manager. Work units count planning
and mutation boundaries, not measured CPU instructions. Existing manifest, tree,
compiler, package-count and 4 MiB state ceilings still apply.

Checkpoints are cooperative between trusted bounded operations; this does not
preempt a hung trusted adapter or provide OS CPU/memory isolation. No third-party
lifecycle code executes and no child action resets the ledger. Results expose the
versioned `wydgit.package-meter/1` record. These meters grant no capability and add
no billing behavior.

Stable failures distinguish `PACKAGE.CANCELLED`, `PACKAGE.LIMIT`, `PACKAGE.DENIED` /
`SEAM.DENIED`, `PACKAGE.CONFLICT`, `PACKAGE.DEPENDENCY`, `PACKAGE.CYCLE`, validation,
`PACKAGE.STORAGE`, `PACKAGE.BUSY`, `PACKAGE.STALE` and `PACKAGE.RECOVERY`. Migration
and purge refusals have their own codes above. These trusted APIs do not introduce
an HTTP status mapping; J administration must preserve their distinctions.

The shared SEWN ledger exposes `wydgit.execution-meter/1` to trusted observers.
Server Page meters now add bounded `wydgit.page-diagnostics/1`: phase durations,
first failing phase, authorization/service/dispatch wait totals and the static
shared accounting path (Page → events/components/workflows/services). Observers
run after admitted I/O settles, so failed-request service waits are represented.
No identity, context, capability, input, path or provider handle is retained.
Observer exceptions cannot change the HTTP outcome. HTTP errors remain sanitized.
No execution limit or browser bundle changed. Controlled probes distinguish
`timeMs` exhaustion from a connection-cancellation `guard`; these probes do not
attribute the unreproduced historical full-suite delays. The
[HTTP reliability issue](milestones/0.3-reliability.md) remains open.

## Qualification limits

The tests qualify the bounded contracts above on cooperating local stopped-App
writers, JSON and SQLite. They do not qualify destructive/arbitrary migrations,
changed instance footprints, installation-bound store identity transitions, shared
canonical-library purge, secure erasure/checkpoint retention policy, older ambiguous
infrastructure journals, hot lifecycle or distributed writers. Power loss, network
filesystems and storage hardware remain unqualified. Historical HTTP reliability
is still a release blocker. Managed WydHosting qualification remains deferred to
0.4 under Decision 0003; none of its six obligations is waived or expanded here.
