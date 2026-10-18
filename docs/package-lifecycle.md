# Trusted local package lifecycle

Status: implemented **conservative local catalog lifecycle**, with release blockers
below. This is not full production package lifecycle qualification. See the
[audit and qualification record](milestones/0.3-package-lifecycle/README.md).
The existing I hosting and J administration identifiers are unchanged.

## Host API and approvals

The native installer remains the package manager. Trusted host code imports
`planPackageOperation`, `applyPackageOperation`, `packageOperation`,
`createPackageBudget`, `inspectPackageOperation` and `recoverPackageOperation` from
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
renaming/removing instances, arbitrary transformations and incompatible definitions
fail before publication. Package templates never overwrite administrator settings
or authored content. Created Pages remain App-owned and are reused on reinstall.
Navigation removal only removes one exact original item; ambiguous/customized items
remain, with a plan warning.

**Storage schemas must remain identical.** A schema change returns
`PACKAGE.MIGRATION_REQUIRED`. WydStore record transactions are implemented on JSON
and SQLite, but neither adapter supplies a package schema-migration/checkpoint
contract. This work does not simulate migrations with raw SQL or rewrite record
history. Ordered data/schema migrations, cross-store checkpoints and irreversible
migration approval remain unimplemented release blockers.

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

`purge` is a separate explicit host-authorized action after uninstall. It currently
supports deleting retained catalog instance/configuration snapshots only when the
package declares no physical storage/library scopes and the snapshots contain no
foreign site additions. The created App Page remains site-owned. Physical data
purge returns `PACKAGE.PURGE_UNSUPPORTED` without changing state. Site additions
return `PACKAGE.OWNERSHIP`. No raw filesystem or SQL deletion exists here; ordinary
uninstall never authorizes content destruction. This restricted purge does not meet
the complete physical-purge milestone requirement.

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

The older host-configuration/provisioning installer still uses
`.package-infrastructure.json` with saved config/catalog state. It now has synced
lock metadata, directory fsync at publication and bounded checkpoints, but it is a
multi-resource compensating workflow. **It is not covered by automatic catalog
recovery.** On an infrastructure interruption, stop writers, inspect the saved
configuration/catalog, compare actual ownership/provider state and restore or
explicitly reconcile before removing recovery markers. Preserve ambiguous/new data.
Never delete locks merely to retry. Fully automated provisioning crash recovery and
qualification of failed compensation remain release blockers.

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

The shared SEWN ledger additionally exposes `wydgit.execution-meter/1` through its
trusted `meter()` and optional host `execution.observeBudget` callback. It records
elapsed time, charges and the first terminal resource (`timeMs`, counter name,
`guard`, or `closed`). The observer receives no context, authority, storage handle,
identity or secrets; observer exceptions cannot change HTTP outcomes. HTTP error
responses/log envelopes retain their existing sanitized contracts. See the still
[open HTTP limit investigation](milestones/0.3-reliability.md).

## Qualification limits

The passing local tests qualify the catalog operations described here, graph
invariants, retention and JSON/SQLite content preservation. They do not qualify
schema/data migrations, physical data purge, multi-resource provisioning recovery,
automatic committed-upgrade rollback, arbitrary instance migrations, hot lifecycle
or distributed writers. The historical intermittent HTTP failure remains a release
blocker. Managed WydHosting qualification remains deferred to 0.4 under Decision
0003; none of its six security obligations is waived or pulled into this work.
