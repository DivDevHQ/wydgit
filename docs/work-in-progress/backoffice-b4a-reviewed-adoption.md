# BackOffice B4a — durable reviewed adoption

Recorded 2026-10-21. Baseline `859049ec8ac790831037ac8bfb20fd169bd24a3a`,
clean `develop/0.3`; origin fetched, 0 ahead / 0 behind. B3 code, retained evidence,
B2's approved contracts, repository development/founding rules and governing context,
placement, policy, lifecycle, action, HTTP, SEAM, Store and WydData documents were
reviewed. DEC-01/02 remain approved without amendment.

B4a implements authenticated durable approval evidence. It does not enable HTTP
Page entry, restrict live action dispatch, gate existing App startup on migration,
automatically approve actions, grant Page permissions or introduce a compatibility
bypass. **The enforcing runtime is B4b work.** The 1,000 ms deadline, accounting,
mutation/cancellation/indeterminate outcomes, HTTP classifications/session cookies,
FrontEnd, SEAM/Gate semantics and frozen clients remain unchanged.

## Trusted adoption API and operator authority

Use the existing exports from `wydgine/trusted/packages`:
`planPackagePolicy`, `approvePackagePolicy`, `applyPackagePolicy`,
`cancelPackagePolicy`, `inspectPackagePolicy` and the existing recovery operations.
There is no independent approval database, public route, portable provider, npm
hook, new administrative domain or package-owned review operation.

Every adoption stage requires a live branded native Server ExecutionContext,
exact canonical App, `package:null`, `installation:null` and independently issued
`packages.lifecycle.manage`, `packages.policy.manage`, `packages.placement.manage`.
There is no package provider for these maintenance capabilities. The trusted native
host authenticates/authorizes its operator before constructing that binding. This
API does not authenticate an arbitrary identity object against Gate or infer host
review authority from a session, role, context label, `self`, provenance or an
`isAdmin`/`approved`/`trusted` Boolean. The branded host binding and independently
issued grants are the authority; reviewer publisher/self/principal are bounded
audit attribution. Native modules/local trusted files remain trusted infrastructure.
Copied contexts and copied/modified plans cannot approve. Original frozen plan
identity is checked and consumed at review, with fresh capability and source checks.

1. Stop and drain the App, including other processes; close old raw registries.
2. Run `inspectBackOfficeMigration` with existing lifecycle+placement authority
   and a current loaded registry. Supply explicit Page proposals where desired.
3. Review each action's installed identity, required declarations, receipt bounds,
   concrete restrictive scope, operation/capability/owner and policy requirements.
   Review the full exact Page proposal, component consumers, ancestor constraints,
   independent Page permission and action references. A proposal is never approval.
4. Submit a complete selected approval inventory through `policy.backoffice`.
5. Inspect the original plan, explicitly approve expansion, then apply its durable
   approval. Inspect after uncertainty; never automatically replay a write.

```js
const report = inspectBackOfficeMigration({root, libraries, installationContext,
  pageProposals: [reviewedPageProposal]});
// A native reviewer selects these exact actions/proposals deliberately.
const backoffice = {
  actions: selectedActions.map(a => ({
    reference: a.reference, contractHash: a.contractHash, scope: a.restrictiveScope
  })),
  pages: [{proposal: reviewedPageProposal, contractHash: selectedPage.contractHash}]
};
const plan = await planPackagePolicy({root, app, package: packageId, installation,
  revision, packageRevision, policyRevision,
  policy: {grants: currentApprovedGrants, stores: [], backoffice},
  installationContext: nativePolicyOperator});
const approval = await approvePackagePolicy(plan, {
  installationContext: nativePolicyReviewer, allowExpansion: true
});
await applyPackagePolicy({root, app: plan.app, package: plan.package,
  installation: plan.installation, revision: approval.revision,
  packageRevision: plan.packageRevision, policyRevision: plan.policyRevision,
  approval: approval.id, planHash: plan.sha256,
  installationContext: nativePolicyOperator});
```

These are native tooling fragments, not package code or a runnable public example.
Reference data from preflight has its own static contract; it is not the existing
live discovery reference or an executable action handle.

The optional field is a complete replacement for this installation's selected
approval inventory. Omission preserves historical evidence without renewing it.
Empty `actions` and `pages` revoke all approvals. Omitted previously approved
subjects become explicit revocation tombstones; reapproval is a fresh review.
Partial action review is permitted and reported as incomplete migration, with a
list of missing actions. Page adoption requires every bound action to be reviewed
in the same inventory; an informational Page may bind zero actions. No action is
added from test success, package placement, a receipt or a supplied review witness.

Reconcile grants/Store operation-policy changes separately first, then inspect the
new accepted state. Simultaneous adoption plus changed grants/rules rejects.
Every action must be an exact installed declaration; candidate-over-installed
preflight analysis cannot rewrite legacy declarations. Missing/empty declarations
need a valid versioned package upgrade, not a copy of receipt-wide authority.

All declared resources are required preflight resources. Approving the exact
single-resource declared maximum under a two-resource receipt is valid narrowing.
Removing any required resource, or adding an undeclared/foreign resource, rejects.
A previously reviewed artifact edited in place under the same installation revision
cannot be blessed by re-review; restore accepted bytes or use a proper lifecycle upgrade.
No silent clipping, empty-as-unrestricted or invented separate optional-resource
semantics exist. New/wider approval evidence conservatively sets `plan.expanded`
and requires the existing explicit native expansion review. An equivalent fresh
review is permitted, but advances policy and generation; replaying a completed
approval fails. Review denial never publishes a partially approved inventory.

## Representation, persistence and reconciliation

Implementation: [adoption helper](../../packages/wydgine/src/engine/packages/backoffice-adoption.js),
[policy workflow](../../packages/wydgine/src/engine/packages/policy.js),
[policy integrity](../../packages/wydgine/src/engine/packages/policy-contract.js),
[inspection](../../packages/wydgine/src/engine/packages/backoffice-preflight.js).

`entry.backoffice` is `wydgit.backoffice-adoption/1`. It records:

- Exact App, package/publisher, installation, context, placement/lifetime generation,
  package/policy revision, accepted artifact, normalized receipt, App tree and
  configuration fingerprints.
- Approval UUID, original policy-plan hash, authenticated native reviewer attribution
  and approval time. Existing policy history retains the full reviewed plan/outcome.
- Per-action subject, complete installed declaration, rebased exact reference, **source** contract hash, declared
  required resources, concrete maximum, fixed operation/capability/effect and
  static owner/policy requirements.
- Exact rebased Page proposals and their **source** contract hashes; omitted subject
  revocation tombstones. Tombstones are bounded to 256; replacement/review is needed
  if that ceiling is reached. Existing per-package 32 actions/Pages, 64 KiB plan,
  4 MiB state/checkpoint and bounded audit ceilings remain.

`receipt.backofficeHash` checksums the evidence, and the existing policy hash now
includes that checksum when present. Evidence is not independently mutable policy.
Catalog 0.4 / receipt 0.1 stay unchanged. Older policy code that ignores the new
checksum calculates a different policy hash and fails drift validation. No old
receipt or accepted artifact is retroactively rewritten by inspection. No version,
manifest, lockfile or provider-format bump is made.

The normalized contract receipt excludes approval/policy checksums to avoid a
recursive self-hash; receipt identities, grants, mappings, revisions and placement
remain bound. Source review hashes are preserved as source evidence, not mislabeled
as hashes of the post-apply generation. Applying the reviewed transition explicitly
rebinds Page/action references to the approval UUID used as the new placement
generation, and to the new policy revision. A fresh lifetime UUID fences old contexts.
The target evidence fingerprints those exact post-transition facts. Read-only
inspection never performs this rebinding.

Approval uses the existing exclusive writer/catalog journal, synced temporary
catalog, rename and directory synchronization. Pending approval reserves the App.
Apply/cancel use existing private checksummed 0600 checkpoints and effects journal.
The catalog is the local commit point. No Store record or data migration is performed.
There is no new ad hoc approval-file write or cross-store atomicity claim.

A lost post-commit acknowledgement returns `PACKAGE.RECOVERY`, retains barriers and
is indeterminate to the caller. After writer exit, use `inspectPackageOperation` /
`inspectPackageEffects` and existing authorized recovery. Before publication recovery
preserves the source/pending review; exact resume may finish the approved target.
After commit it finishes the target and rejects rollback. Repeated terminal effects
recovery is idempotent. Recovery requires existing lifecycle+policy authority and
cannot approve a different target. A live writer, missing/corrupt/newer checkpoint,
foreign state, symlink or unresolved barrier blocks recovery/execution. No blind retry.

Hashes detect inconsistent trusted state, not a malicious native administrator able
to rewrite every catalog, configuration and checkpoint. Local cooperating writers,
filesystem synchronization and process termination are qualified. Hardware power
loss, network filesystems, hostile privileged writers, distributed leases and
cross-process execution drain remain outside the existing lifecycle guarantee.

## Lifecycle and fail-closed evidence

| Event | Approval evidence |
| --- | --- |
| Ordinary restart | Preserved and current if every bound fact still matches; no in-memory review token is needed to inspect or apply pending durable review. |
| Interrupted review/apply | Existing journal/checkpoint recovery selects exact source or committed target; no partial approval becomes current. |
| Revocation | Empty/removal inventory requires independent review/apply; tombstones and fresh generation persist. Recovery never restores a committed revoked approval. |
| Equivalent fresh adoption | Explicit new review, new policy/generation/approval; source hashes are not replayed. |
| Policy or receipt revision | Historical evidence becomes stale; omitted adoption never renews it. |
| Upgrade/replacement/reinstall | Historical evidence may be retained for diagnosis, but receipt/generation/artifact mismatch prevents transfer. Fresh review is required. |
| Retirement/relocation | Retired/wrong-context/fresh generation is ineligible; reactivation does not revive old evidence. |
| Removal | Retained evidence remains historical and ineligible. Purge follows existing explicit retained-data rules. |
| Cancel pending review | Source grants preserved; existing lifetime fence advances and old evidence becomes stale. |
| Integrity/config/tree failure | Invalid checksums/schema or accepted-state failure blocks inspection; otherwise bound drift reports stale, with no executable approval. |
| Symlink/restored-mtime substitution | Safe reads and existing inode/ctime-aware guards remain; inspection rechecks bytes, never treats mtime as approval. |

Any deliberate transfer/reapproval must use the same reviewed process. Revocation
of evidence does not itself narrow B4a runtime dispatch: that is deliberately B4b.

## Complete accepted binding chain

Trusted planning validates the accepted repository, canonical Page attachments,
managed instance ownership, one package principal per Page, inherited execution
restrictions, resource mappings, dependency pins and fixed-operation exports.
It resolves every accepted Page node recursively with exact instance/prototype and
full ancestor identity, validated properties, execution selection and ordered slots.
Those facts enter Page contract hashing, alongside accepted resources and receipt.

Each proposed binding is closed reference data with an exact consumer on this Page,
current same-App/package/installation/action owner+ID+generation+revision, typed fixed
inputs, read-only preparation versus explicit intent, and finite actual-ancestry
constraints in narrowing base-to-derived order. Missing/duplicate/foreign actions,
stale references, invalid configuration, widening inherited constraints and injected
capability/context/handler fields reject. Each referenced action must also pass
trusted capability/API/effect, receipt coverage, exact resource owner/resolution and
required operation-policy validation and be in the reviewed action inventory.
Nesting does not select another installation's authority.

The existing schema has no executable component action-handle property or separate
prototype action-grant language. Ordinary property strings are not interpreted as
authority references. The accepted binding contract is the explicit proposal's
binding/constraint list, checked against real accepted ancestry and containment;
no speculative property or hidden inheritance registry is introduced.

Runtime-created/repeated children, actual input/transaction members, genuine caller
and initiating server scope, live Session/Page/action/service policy, final admission,
publication and lifetime are B4b live checks. Static structure cannot stand in for
them. No native handle crosses into configuration, and validity never invokes an action.

## Inspection and migration prerequisites

`inspectPackagePolicy().backoffice` distinguishes absent/proposed, adopted, stale
and revoked evidence, attribution and missing actions. Its separate `.approval`
reports durable reviewed-but-not-applied policy. `inspectBackOfficeMigration` adds
fresh structural action/Page validation and exact references; it automatically
inspects current adopted Pages even when no new proposal is submitted.

Per-action output separates `valid`, `reviewState`, `adoptionStatus`,
`durablyAdopted`, `eligibleForEnforcement` and `enforcementReady:false`.
An active installation is eligible for future integration only if current adoption
covers **all** installed actions. Page chains additionally require current valid
reviewed bound actions. Candidate overrides never borrow durable installed review.
Reports are bounded deterministic frozen JSON without credentials, resource records,
provider roots or runtime contexts. Unknown selectors, ambiguous inputs and integrity
failures return sanitized blocked diagnostics, not salvaged authority.

Diagnostics include `BO.ADOPTION_REQUIRED`, `BO.ADOPTION_CURRENT`,
`BO.ADOPTION_STALE`, `BO.ADOPTION_REVOKED`, `BO.ADOPTION_PENDING`, `BO.MIGRATION_INCOMPLETE`, existing
`BO.*` structural findings and package drift/recovery barriers, with remediation.
`eligibleForEnforcement` describes static adoption prerequisites only; all runtime
checks remain listed obligations and `enforcementActive:false` stays explicit.
B4b must fail startup for active legacy actions without complete current migration,
while B4a preserves existing active Apps. A record alone is never enforcement-ready.

## Qualification and actual migrations

[Test suite](../../test/backoffice-adoption.test.js),
[installed fixture helpers](../../test-support/backoffice-adoption.js) and
[machine-readable evidence](../../test-support/backoffice-b4a-evidence-2026-10-21.json).
Only disposable **test installations** were adopted:

| Installed fixture | Reviewed/adopted evidence |
| --- | --- |
| Members and Notices modules | `list-members` and `list-notices`, independently, on the JSON module fixture. Both-provider action fixtures separately qualify provider parity. |
| Records/archive JSON and SQLite | All six `get`, `create`, `update`, `delete`, `transaction`, `archive-get`; partial migration and explicit revocation also exercised. |
| Multi-resource variants JSON and SQLite | Explicit versioned fixture declarations require records+archive for get/transaction; both are reviewed, with no required-resource clipping. |
| Installed Taskboard | Informational Page with no actions after exact BackOffice placement; no user Page permission is assigned. |

Repository `content/` has no installed catalog. **No production or external
installation was reviewed, migrated or adopted.** No bulk fixture action is
implicitly approved outside the explicit native test workflow.

BOB4A-01–18 covers authenticated/native authority, forged identities/trusted flags,
exact freshness, pending/source/durable separation, narrowing/maxima, reviewed chains,
provider parity, invalid declarations/operations/foreign resources, source/receipt/
policy/manifest/evidence/config drift, accessors/handles, symlinks/restored-mtime,
duplicate/conflicting approvals, partial migration, upgrade/replace/retire/remove/
reinstall, SIGKILL at review/apply boundaries, lost acknowledgement, checksum corruption,
compensation, recovery, revocation and cross-process races. Existing B3/B1/action/
HTTP/placement/policy/security qualification remains required, including the explicit
receipt-wide dispatch characterization and unchanged Session cookie handling.

The new adoption success test fails against the original B3 policy implementation
on rejected `policy.backoffice` fields (two provider cases), then passes with B4a.
This is new capability evidence; no pre-existing vulnerability correction is claimed.
Early fixture corrections (wrong discovery name, recovery attempted while its writer
was alive, synchronous lifecycle rejection handling and avoiding traversal of fixture
symlinks into independently edited checkout dependencies) are retained in evidence; no authorization assertion or runtime limit was
weakened. The first full suite had 1,926 passes and two source-pin failures because historical
HTTP evidence tests pinned the entire package lifecycle module. The archived source
and archive hashes remain immutable; those tests now compare the complete installed
execution guard byte-for-byte with the verified historical source, allowing separate
trusted lifecycle code elsewhere in that module. No HTTP experiment, guard, budget
or historical evidence was changed. Review completeness was also improved to retain
the full installed action declaration and conservatively classify declaration
changes as approval expansion. Final commands/counts/log hashes are in the evidence JSON.

## Conformance and B4b handoff

All stable requirements/classifications remain: **64 in scope, 59 Implemented,
4 Partial, 1 Missing, 0 Unverified; 12 deferred/proposed/reserved**. No promotion
follows from inert evidence. BO-ACT-10 remains Partial until restrictive dispatch and
startup migration are enforced. BO-HTTP-09 remains Missing. BO-REU-05/06 and
BO-HTTP-12 retain composition/administrative/accessibility obligations.

The reviewed-adoption layer is ready for B4b integration within the qualified local,
stopped-App trust model. B4b must independently consume current evidence, require
complete reviewed migration at enforcing startup, implement caller-preserving maxima
and transaction-member checks, then join exact Page-entry approval and independent
live Page permission to shared HTTP admission/execution. Actual deployments still
need explicit review/migration. No canonical Page is HTTP-reachable due to B4a.
Full BackOffice foundation, WydData/CIR, wider domains, generic data components,
human accessibility and managed-hosting qualification remain incomplete/deferred.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No release, deployment, tagging, publication
or version bump. Commit/push status is recorded in the owner handoff.

## Verification record

Node 24.21.0; all final passing selections have zero failures, cancellations, skips
or todo. Commands, log locations/hashes, corrected attempts and actual installed
inventory are retained in the evidence JSON linked above.

| Qualification | Result |
| --- | ---: |
| Focused adoption/B3/B1/policy/HTTP/actions/placement/historical guard | 281 passed |
| Final immutable-artifact drift and genuine upgrade checks | 4 passed |
| Full repository, including client/regex pretest build | 1,928 passed |
| Local-tarball installed-engine fixtures | 657 passed |
| Installed provider | 35 passed |
| Real installed process supervision | 20 passed |
| Installed unprivileged Linux boundaries | 25 passed |
| Independent frozen-client history | 31 immutable artifacts |
| Changed Markdown | 59 file links, 4 anchors; 76 stable IDs unchanged |
| `npm run check` | 3 complete pages, 42 internal links, unique anchors |
| Whitespace | `git diff --check` passed |

The original policy-module substitution has 0 passes / 2 expected failures on the
new adoption field. The first full B4a run had 1,926 passes / 2 source-pin failures,
corrected as described above; the completed full run has 1,928/1,928. Final required
checks are repeated after recording this report/evidence; the commit and owner
handoff state their outcome. Tarball resolution rejects checkout runtime imports
and confirms exactly one installed engine per consumer. No provider, HTTP runtime,
shared/client artifact, manifest, lockfile or version metadata changes occur.
