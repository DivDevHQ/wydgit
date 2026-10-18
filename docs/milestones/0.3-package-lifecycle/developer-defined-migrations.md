# Developer-defined package and instance migrations

**Status:** Original agreed plan. The [manual replacement contract](manual-replacement-contract.md) now implements its bounded stopped-App workflow; automatic orchestration and full beta qualification remain open.

**Recorded:** 2026-10-18, for `develop/0.3`.

**Workstream:** Existing named 0.3 package lifecycle hardening workstream.

This plan codifies the owner-directed upgrade flow: retire an old Wydgit package
while keeping its instances and data, install the replacement with an optional
**Update instance references** choice, then run **Migrate Data**. The same steps
may run as one automatic upgrade when the developer supplies a complete compatible
migration path and the owner authorizes the exact operation.

Developers define application-specific transformations and validation. Wydgine
provides the safe execution, authorization, staging, integrity checks, recovery and
activation machinery. A migration is never permission to run an unrestricted hook.

## 1. Relationship to current contracts and roadmap

The [implemented lifecycle contract](../../package-lifecycle.md) remains the source
of truth for existing behavior. Today it accepts exact host-approved
`wydgit.package-migration/1` steps for lossless field renames/defaults and fixed-ID,
fixed-placement managed-instance property/prototype transitions. It does not run
third-party migration hooks, restructure arbitrary instance trees, or support
installation-bound storage identity changes. Existing uninstall detaches managed
trees into retained state; it is not the retire operation proposed here.

Reuse its native installer, validated manifests, receipts, graph planner, shared
budgets, writer serialization, adapter staging, checkpoints and publication
protocol. Do not reinterpret an existing approval or extend a closed manifest
silently. A developer migration declaration, executable representation and any
new lifecycle request need separately reviewed, versioned contracts before code.
Names and states below describe intended semantics, not accepted CLI flags,
manifest fields, services or new error codes.

This document creates no numbered milestone or new roadmap decision. Preserve
0.3-I (hosting), I0–I5.6 and subsequent I phases, and 0.3-J (Platform/App
Administration). J can later expose these engine operations through administrative
controls; the safety contract belongs in standalone Wydgine. No WydHosting or
WydOS dependency is introduced. [Decision 0003](../../decisions/0003-defer-managed-hosting-qualification-to-0.4.md)
keeps managed WydHosting qualification and the Debian VM experiment deferred to
0.4, with all six security obligations intact. The
[release-status record](../0.3-release-status.md), unresolved
[HTTP reliability issue](../0.3-reliability.md), and
[current lifecycle qualification limits](qualification-2026-10-18.md) remain in force.

## 2. Operations and owner experience

| Operation | Intended effect | Preservation boundary |
| --- | --- | --- |
| Ordinary uninstall (existing) | Remove executable catalog entry and detach managed App trees into retained state; eligible dependency pruning follows existing policy. | Existing retained trees/IDs, receipts, content and recovery rules still apply. This is removal, not in-place upgrade preparation. |
| Retire for replacement (planned) | Disable old execution and park the package's instances in place for an explicit replacement workflow. | Preserve instances, IDs, placements, properties, site additions, storage/history, identity/provenance, receipts, dependency requirements and recovery evidence. No pruning or purge. |
| Install replacement (planned extension) | Validate and stage the new package and its separately approved dependencies/grants. | Old retained resources remain reserved; no live binding or content replacement merely because installation succeeded. |
| Update instance references (planned option) | Plan mappings from the retired package/prototypes to the replacement for the chosen instances. | Publish only a complete validated binding change; never attach incompatible definitions to old data. |
| Migrate Data (planned) | Execute approved developer steps against staged data and instances, then validate and activate. | Failure preserves the accepted source state and recoverability. |
| Automatic upgrade (planned extension) | Compose staging, reference mapping, migration, validation and activation into one authorized operation. | Same checks and recovery guarantees as the manual workflow; no shortcut authority. |
| Purge (existing, separate) | Explicitly approved deletion within the implemented narrow ownership contract. | Retire, reference update and migration never imply purge or checkpoint deletion. |

### Manual sequence

1. **Inspect and retire.** Show the exact source package/version, affected instances,
   dependents, data, grants and recovery requirements. On a stopped App, authorize
   retirement, checkpoint accepted state and mark the old package unavailable for
   execution without deleting or detaching its instances. Preserve enough embedded
   definitions to inspect and recover parked instances without executing old code.
   The first beta keeps the App stopped throughout this workflow. A future live
   administration shell must explicitly quarantine affected objects and dependents;
   unresolved prototypes must never fall back to another executable definition.
2. **Install the replacement.** Validate exact publisher/package identity, version,
   artifact hashes, platform/library compatibility, grants, mappings and full
   dependency graph. Stage the candidate separately from active bindings. An
   incompatible replacement cannot use ordinary install as an activation bypass.
   This does not require general support for concurrent active package versions.
3. Offer **Update instance references**, defaulting to no implicit reassignment.
   If unchecked, existing instances stay parked against their original identities;
   the package must not silently adopt them or create duplicate replacements.
   If checked, show and validate the exact source/target identity mapping and its
   affected reference set. If data already meets the target contract, a validated
   no-op data step can complete the transition. Otherwise record a pending mapping
   for migration; the checkbox alone must not publish incompatible live references.
4. **Migrate Data.** Present source and target versions, the selected path, affected
   instances/stores, validation, required authority, bounds and recovery limitations.
   Run the developer-provided transformations and validators within the approved
   engine envelope. A source change since preview invalidates that preview.
5. **Validate and activate last.** Publish target bindings, instances, data mappings,
   graph and receipts only after all staged checks pass. Preserve source provenance
   and migration lineage. Until publication/reconciliation succeeds, keep execution
   blocked and show the actionable pending/failed/recovery status.

Retirement is not a way to evade reverse dependencies. Persist source dependency
edges and resource reservations while parked. Keep automatic dependencies pinned;
explicit/protected installations and shared runtime libraries remain protected.
Reject retirement if an outside dependent cannot remain valid or be included in
an explicitly approved stopped scope. Replacement activation validates the complete
proposed graph, including reverse dependents; do not erase edges to make it pass.
Only a later explicit cleanup plan may release obsolete reservations/dependencies
after proving no installed, retained or recovery reference still needs them.

## 3. Stable identity and reference mapping

App, publisher, package, installation, prototype, instance and storage ownership
identities are distinct. Display names, paths, labels, slot positions and matching
template names prove none of them. Receipts and validated canonical identities
must establish the source relationship; target declarations must establish a
compatible replacement. Package declarations alone do not prove publisher trust,
resource ownership or owner consent.

For the initial beta, keep the publisher-qualified package identity unchanged.
Cross-publisher/package ownership transfer requires a later reviewed protocol.
Retain historical installation identities and check storage bindings explicitly;
never mint a new installation ID and silently rebind a store owned by the old one.
Unsupported installation-bound transitions refuse even if schemas are identical.

Every proposed reference mapping must identify exact source/target package versions
and prototype identities, selected stable instance IDs, expected source state,
placements and all affected canonical references. Validate that sources exist and
belong to the selected package/App, targets exist and are permitted, targets do not
collide, and the complete reference inventory is understood. Check inheritance,
slot cardinality, parent/child integrity, binding targets, navigation where relevant,
and dependency constraints through normal hydration and graph validation. Unknown
or opaque references that cannot be accounted for block a structural change.
Do not search-and-replace arbitrary user text or URLs to infer object references.

For a one-to-one transition, preserve the immutable instance ID wherever feasible;
change the validated prototype/package binding and provenance rather than deleting
and recreating the App-owned object. Preserve site-authored children, customization,
record identities, revisions, tombstones and history. A change in placement needs
an explicit structural contract and owner approval, not a new ID as a workaround.

### One-to-many mappings

A split must explicitly identify a surviving semantic instance, if there is one,
which keeps the original ID. Allocate fresh collision-checked IDs for additional
instances and persist their lineage in the operation plan/checkpoint. Never give
multiple objects the same immutable ID. If no successor legitimately represents
the original object, preserve its retired identity and refuse the split until a
reviewed retirement/reference contract exists; do not choose a survivor by name.

For every incoming reference, declare whether it follows the survivor, moves to a
specific new object, or expands to a set only where the referring contract permits
that cardinality. Define data partitioning, child placement, ownership and validation
for each result. No heuristic duplication, dangling reference, duplicated authority
or unreviewed alias/redirect may resolve ambiguity. Many-to-one merges need an
independent conflict/identity contract as well. **The first beta detects and refuses
splits, merges and changed footprints.** These rules describe prerequisites for a
future extension, not support hidden behind the reference-update checkbox.

## 4. Developer migration contract and version paths

Developers own the meaning of their data. They must supply transformations and
preconditions/postconditions for application-specific schema, property and
prototype changes, including owner customization and historical records. Wydgine
cannot infer that a renamed field, changed unit, split object or new required value
means the same thing. Semantic version ranges alone do not establish migratability.

A future closed declaration must bind at least these concepts:

| Concept | Required planning semantics |
| --- | --- |
| Identity and integrity | Versioned declaration format, stable step ID, exact publisher/package, source and target artifact/version identities, immutable logic and validator hashes. Reject changed content under the same identity. |
| Source/target state | Explicit package and schema versions, supported instance/prototype forms, ownership, record/history assumptions, storage mappings and runtime/contract compatibility. |
| Transformation | Portable bounded declarative operations or validated SEWN, with declared reads/writes, expected outputs, losslessness and preserved invariants. No native callback. |
| Validation | Developer pre/postconditions plus engine schema, ownership, hydration, graph and reference checks. Validators run under the same restricted envelope. |
| Execution requirements | Narrow resource scopes, capabilities, library requirements and operation-wide work/time/data/staging/checkpoint bounds. No authority inferred from dependency declarations. |
| Recovery | Engine-checkpoint compatibility, replay/idempotency rules for staged steps, expected before/after fingerprints and explicit unsupported/irreversible cases. Developer inverse code is not a substitute for source recovery. |

Treat package versions as nodes and migration steps as directed edges. Resolve
against the actual installed or retired receipt and actual schema/instance state,
not an assumed previous release. An adjacent chain such as `1.0 → 1.1 → 2.0` and
a direct edge `1.0 → 2.0` are both legitimate if their contracts compose. A direct
edge covers its declared source only; it does not imply support for `1.1`.
Each edge's postconditions must meet the next edge's preconditions, with final
state matching the exact accepted target. Validate each intermediate staged state;
intermediate package code never needs to become active.

A developer claiming support from **any previous version** must provide a complete
validated path from every version in the declared support set, including legacy
schema variants. Unsupported historical versions remain explicit refusals; the
platform cannot manufacture a missing transform. Intermediate logic must be included
in approved local artifacts with exact hashes; no automatic network retrieval or
execution of an old installed package is implied.

Planning rejects gaps, cycles, duplicate/conflicting steps, mismatched schemas,
unknown formats and unused/unrelated approvals. Where several paths are valid,
select one deterministically under a reviewed policy and bind it into the preview
and authorization; until that policy exists, require explicit path selection.
Do not guess that the shortest path is semantically preferable. A failed chosen
path does not silently switch paths or rerun a step on partially transformed data.
Unchanged compatible data may use an explicit validated no-op path.

Automatic upgrade requires a complete compatible path for **every** affected source
schema/instance, safe identity mappings, complete dependencies, separately approved
authority, enforceable bounds and recovery coverage. An incompatible version still
requires explicit upgrade intent under existing version rules. Authorization may
cover the composed operation without manual clicks, but automation cannot invent
consent, broaden grants or bypass a refusal. Otherwise leave the source accepted
or parked and explain which path/contract is missing; manual mode uses the same
safety checks and is not a force option.

## 5. Responsibility and SEAM execution boundary

| Developer supplies | Wydgine enforces |
| --- | --- |
| Version support matrix, migration paths and identity mapping intent. | Receipt/artifact validation, exact plan authorization, App/package/resource confinement and full graph/reference integrity. |
| Domain-specific transformation and semantic validation, with preservation requirements and fixtures. | Closed grammar/compiler validation, scoped data handles, schema validation and enforceable shared resource limits. |
| Expected output, compatibility constraints and deterministic behavior. | Private staging, durable checkpoints/journals, conflict detection, recovery, publication and activation. |

SEAM remains authoritative. Roles, identity, publisher metadata, inheritance,
containment and dependencies confer no capabilities. The host authorizes lifecycle
management; third-party logic never receives the host execution context or
`packages.lifecycle.manage`. A migration must use a restricted context/scoped
interface whose authority is limited to the approved source snapshot and target
staging resources. Grants cannot be unioned across steps, dependencies or Apps.

**Never grant arbitrary Node, JavaScript, SQL, filesystem, process, shell, sockets,
module loading, npm, `eval` or raw adapter access to migration hooks.** Retire,
install and validation callbacks cannot be alternate escape routes. Provider SQL
and physical file publication stay inside trusted adapters. A reviewed canonical
service extension is separate platform work; a migration cannot install one to
obtain missing privileges. No external network or irreversible side effects belong
in the beta envelope.

Start with the existing bounded lossless operation vocabulary; developer-authored
logic may be admitted only through a new validated declarative/SEWN contract and
scoped service surface. Do not advertise general SEWN migration execution before
those contracts and adversarial tests exist. Developers can provide behavior in
that safe representation; they cannot supply an arbitrary native script.

All steps, validators, dependency work, reference scans and retries within one
operation share terminal work/time/cancellation limits. Add explicit limits for
records, history, input/output bytes, mapping cardinality, step count, staged space
and checkpoint space. Child execution must not reset limits. If work cannot fit
within approved bounds or cannot be interrupted safely, refuse before effects.
Do not raise the current 4 MiB checkpoint or other runtime ceilings merely to make
an upgrade pass; resumable chunking needs a separate consistency contract.

## 6. Staging, publication and recovery

1. **Read-only plan:** Capture exact source catalog/configuration/store fingerprints,
   receipts, graph, reference inventory, artifact hashes, path, grants, mappings and
   bounded resource estimate. Show what stays parked and what will activate. Plans
   are evidence for review, never self-authorizing serialized tokens.
2. **Authorize and recheck:** Reuse host/App SEAM checks and the existing single-writer
   discipline on a stopped App. Before effects, reject stale source data, changed
   artifacts, ownership, grants, configuration or another unresolved operation.
3. **Checkpoint before mutation:** Persist complete integrity-bound source state and
   the chosen plan, including instances, historical data, identities, receipts,
   dependency reservations, configuration and mappings. Protect checkpoints like
   authoritative user content; they contain private data and may contain secrets.
   Keep existing barriers on corruption, missing evidence or ambiguous journals.
4. **Transform staged copies:** Read a stable source snapshot and write only private
   target state. Run each developer step and validator within the shared envelope.
   Defaults never replace owner values; occupied rename destinations and incompatible
   customizations refuse. Preserve the full content/history invariants, not just
   the latest rows. Validate complete App hydration and the proposed dependency graph.
5. **Publish and activate last:** Record durable intent and exact before/after images
   using trusted adapters and configuration/catalog publication. Reuse the catalog
   commit point and per-store barriers. Multiple stores can temporarily be at old
   or new boundaries while execution stays blocked; this is compensating consistency,
   not a claim of one cross-store atomic transaction. Record completed step lineage,
   accepted hashes and resulting receipts. Activate only after reconciliation proves
   the accepted target state complete.
6. **Recover deliberately:** Before commit, default to restoring the recorded source;
   an explicit authorized resume may publish already validated after-images. After
   commit, finish the accepted target. Do not execute third-party code as a recovery
   hook. If computation must be restarted, use a fresh plan and clean staging from
   verified source, with new authorization where the plan changes. Unknown state or
   failed compensation preserves barriers/checkpoints for explicit reconciliation.

A completed transition records its operation/step identities so retries cannot
apply it twice. Manual workflow boundaries need durable pending records; a restart
must distinguish retired, replacement staged, mapping pending, migration failed,
recovery required and active states. These are logical states to map onto the
existing catalog/effects protocols, not a second independent transaction system.

**Never restore an old checkpoint over newer user content.** Committed rollback is
a new authorized, serialized operation and must compare catalog, configuration and
every affected store with the exact committed checkpoint. Any later write or
ownership/configuration change makes that rollback stale before mutation. Preserve
both current content and recovery evidence; forward migration or explicit conflict
reconciliation is needed instead. Do not delete newer rows, reset revisions, replay
old defaults or hide loss behind a successful status. Version history alone is not
a backup, and retained checkpoints are not secure erasure or a retention policy.

## 7. Safe refusal rules

Refuse before activation, preserve accepted content/evidence and report a bounded,
actionable reason when any of the following applies:

- No complete path, undeclared source/schema variant, unsupported contract, changed
  artifact, conflicting path selection or developer validation failure.
- Invalid/ambiguous identity, cross-owner adoption, unresolved incoming reference,
  ID collision, unsupported split/merge, unsafe slot/placement change or site-owned
  customization that cannot satisfy target constraints.
- Missing dependency, cycle, incompatible reverse dependent, unapproved runtime
  library/capability, shared-resource deletion or ambiguous installed/retained ownership.
- Destructive, lossy or irreversible transformation, history truncation, unknown
  side effects, provider/ownership transfer or unsupported installation-bound storage.
  A backup or developer claim of reversibility alone does not authorize these.
- Raw runtime/SQL/filesystem hook, foreign resource access, unbounded computation,
  insufficient staging/checkpoint capacity or an unenforceable cancellation boundary.
- Concurrent/stale plan, corrupt/incomplete journal/checkpoint, live or uncertain
  writer, unknown adapter state, failed compensation or stale committed rollback.

Reuse established stable error categories where they fit; select any additional
versioned diagnostics in contract review. Do not silently activate, fall back to
ordinary uninstall, drop data, prune dependencies, force ownership, or run a privileged
script to make an unsupported transition succeed.

## 8. Proposed beta scope and implementation order

This is a proposed bounded beta contract, not evidence that 0.3 is beta-ready.

1. Review the closed declaration, scoped execution and pending-retirement/reference
   contracts against existing lifecycle APIs. Keep current behavior intact.
2. Implement stopped single-App retire/stage/adopt flows with stable one-to-one
   instance IDs and unchanged footprint/placement/ownership. Prove lossless developer
   declarations and semantic validators within the bounded vocabulary on JSON and SQLite.
3. Support exact adjacent and direct version paths through the same planner; add
   automatic composed upgrades only after manual and recovery acceptance passes.
4. Qualify the complete acceptance matrix below, document supported source versions
   and limits, and perform security/release review. Only then expose J-facing controls.

Beta includes separately authorized grants/dependencies, private staged data,
all-history preservation, conflict-aware rollback and crash recovery. It excludes
destructive/irreversible transforms, splits/merges, package ownership transfers,
installation-bound store rebinding, changed providers, live upgrades, distributed
writers, arbitrary hooks and external side effects. Unsupported upgrades must
remain safe, explainable refusals. Signing/registry distribution, checkpoint expiry,
secure erasure and large resumable migrations remain independent work.

Future extensions may add reviewed structural mapping, lossless domain operations,
chunked execution, cross-package/provider migration and richer administration.
Each needs its own capability, identity, consistency and acceptance contract; none
relaxes this plan's preservation rules. Managed hosting orchestration remains 0.4
work under Decision 0003, not a beta dependency silently assigned to this workstream.

## 9. Acceptance tests required before the beta claim

These are planned tests, not tests executed by adding this document. Run applicable
cases against both JSON and SQLite using disposable stopped Apps and real content,
customizations, multiple instances, history, revisions and tombstones. Retain
existing lifecycle/security regressions and normal repository checks.

| ID | Scenario and required result |
| --- | --- |
| MIG-01 | Retire keeps in-place stable IDs, placements, authored children/properties, data/history, identities, receipts, dependency pins and recovery evidence; old behavior cannot execute. Ordinary uninstall still follows its distinct retained-detach contract. |
| MIG-02 | Restart after retire or candidate install restores the exact pending workflow, not active incompatible bindings. Unchecked reference update leaves old instances parked; no duplicates or silent adoption. |
| MIG-03 | Valid one-to-one reference update preserves IDs and updates every declared canonical reference only at validated publication. Names/paths alone, foreign IDs and target collisions refuse without effects. |
| MIG-04 | Split/merge/changed footprint or unknown incoming reference safely refuses in beta. Future split fixtures must prove one survivor ID, fresh unique IDs, deterministic reference routing, partitioned content and lineage before enabling support. |
| MIG-05 | Developer lossless transform and semantic validation preserve customized values and all historical metadata. Occupied rename/default conflicts, invalid target schemas or failing validators leave source intact. |
| MIG-06 | Adjacent multi-step and direct paths produce validated equivalent intended outcomes; mixed supported starting versions are covered. Missing edge, unsupported old version, cycle, mismatched intermediate state, unused approval and ambiguous path refuse. |
| MIG-07 | Automatic and manual flows yield the same accepted content/graph/receipts and authority requirements. Automatic mode cannot bypass explicit incompatible-upgrade intent or gain additional grants. |
| MIG-08 | Missing/incompatible dependencies and reverse dependents veto activation. Shared, explicit, protected and retained/recovery dependencies survive retirement; no premature pruning or library removal. |
| MIG-09 | Forged/replayed plans, wrong App/package contexts, publisher/role-based privilege assumptions and grant union attempts fail. Third-party logic never receives the host context, SQL, paths, native imports or foreign handles. |
| MIG-10 | Hostile logic/validators hit bounded work, time, bytes, history, step, mapping and staging limits; nested calls cannot reset the ledger. Cancellation before commit compensates; after commit it cannot report an uncommitted retry. |
| MIG-11 | Inject errors and real process death after retire publication, candidate staging, each migration step, checkpoint/journal sync, each store/config/catalog publication and compensation/recovery cleanup. Recovery reaches verified old or accepted new state or stays blocked with evidence; it never reruns an untrusted hook. |
| MIG-12 | Competing retire/migrate/uninstall/purge/recovery operations serialize. Changes between preview and apply reject stale plans. Corrupt journals, ambiguous ownership, shared stores and installation-bound identity changes refuse without deleting unknown content. |
| MIG-13 | Immediate committed rollback succeeds only at exact recorded boundaries and increases catalog revision. A later record/configuration/ownership write makes rollback stale; newer user content and evidence remain byte-for-byte intact. |
| MIG-14 | Retry/resume never transforms twice, adopts someone else's staging, or changes the chosen path/artifacts. Tampered logic, checkpoints or receipts block activation/recovery. |
| MIG-15 | Unsupported destructive/irreversible operations and purge disguised as migration refuse even with a developer inverse or backup. Checkpoints stay private, retained and outside ordinary cleanup; unrelated files/resources remain untouched. |

Release evidence must identify commands, versions, source/target fixtures, failure
boundaries, content comparisons and remaining limits. Passing local tests does not
qualify power loss, hardware/network filesystems, multi-tenant isolation or live-site
migration, and does not close the separate HTTP reliability blocker.

## 10. Open design questions before implementation

- What closed manifest/declaration schema carries steps, scoped validators and
  immutable hashes, and how does it translate into existing host approvals without
  trusting package-authored authorization claims?
- Which minimal declarative/SEWN operations and scoped data interfaces can express
  useful developer migrations while enforcing budgets and preventing native escapes?
  How will developer semantic fixtures and validation failures be packaged?
- How should retained in-place instances and staged bindings be encoded in existing
  catalog/receipt protocols, with inspectability but no accidental execution?
- What exact source-version support matrix, legacy schema identification and path
  selection policy makes adjacent/direct paths deterministic and reviewable?
- How are all canonical incoming references inventoried, including site-owned
  bindings, so a future split cannot silently misdirect identity or authority?
- Which dependency reservations are needed for parked instances and recovery, and
  what explicit later cleanup proof can safely release them?
- What identity/recovery protocol would permit installation-bound store transitions,
  changed placement, splits/merges or cross-package ownership transfers later?
- How are durable manual-workflow authorization expiry, cancellation/abandonment and
  return to the old version represented without dropping reservations or evidence?
- What checkpoint retention, backup and private-data access policy is required,
  and what consistency protocol could safely exceed today's size bounds?
- What evidence is sufficient for a bounded package-lifecycle beta claim while
  preserving broader 0.3 release blockers and Decision 0003's separate 0.4 gates?

Answers must update this plan or its reviewed successor contracts before expanding
behavior. This document implements no lifecycle operation, changes no runtime or
package version, and authorizes no deployment, push or production-data migration.
