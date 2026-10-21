# BackOffice B3 — ratification, migration preflight and contract validation

**Recorded:** 2026-10-21. **Baseline:** `f9845d7f986883bb2192e0da06ad1e663ec64ffd`,
clean `develop/0.3`, origin fetched, zero divergence. Read repository instructions,
the ratified B2 contract, B1 implementation/evidence and the governing documents
linked by those records. No intervening commits or unrelated changes were present.

## Ratification and implemented boundary

**DEC-01 APPROVED; DEC-02 APPROVED.** Approval date **2026-10-21**; authority
**Project owner**; scope **both exact wordings, without amendments**, preserved in
[the B2 ratification](backoffice-b2-decision-package.md#owner-ratification).
The [normative Page/action contract](../backoffice-page-and-action-contracts.md)
links the detailed architecture and the implementation boundary. B1 alternatives,
counts, passing/failing evidence and observations remain historical evidence.

| Stage | B3 disposition |
| --- | --- |
| Architecture approval | Ratified exactly as authorized. Zero remaining blocked architectural choices. |
| Candidate validation | Implemented, bounded and non-authoritative. Valid means structural/static predicates pass against supplied facts. |
| Reviewed migration | Required; no B3 review/publication operation or authenticated adoption record exists. Matching review candidates do not constitute approval. |
| Runtime enforcement | Pending. Existing active Apps still start normally and action dispatch remains receipt-wide. No new Page route, binding invocation or attenuation is activated. |
| Qualification | Static positive/negative candidate tests plus existing installed runtime characterization. No claim of live Page/action enforcement. |

The 64-row conformance matrix remains **59 Implemented, 4 Partial, 1 Missing,
0 Unverified**; all **12 deferred/proposed/reserved** rows remain. Approval and static
validators do not qualify BO-HTTP-09, BO-ACT-10, BO-REU-05 or BO-REU-06 as complete.
BO-HTTP-12 accessibility obligations remain. **WYDGINE-0.3-HTTP-LIMIT is OPEN.**

## Native surfaces and trust boundaries

Import only from `wydgine/trusted/packages` in native host tooling:

| Surface | Implementation | Meaning |
| --- | --- | --- |
| `inspectBackOfficeMigration(options)` | [backoffice-preflight.js](../../packages/wydgine/src/engine/packages/backoffice-preflight.js) | Synchronous local installed-state inventory and candidate validation. Requires independently issued exact-App native lifecycle and placement authority, plus the existing loaded library registry. Returns portable facts/diagnostics; never the acquired guarded context. |
| `validateBackOfficeActionScope(candidate)` | [backoffice-preflight-contract.js](../../packages/wydgine/src/engine/packages/backoffice-preflight-contract.js) | Pure action requirements/maxima, operation/capability, concrete coverage, ownership and represented review validation. Supplied facts do not prove provenance. |
| `validateBackOfficePageEntry(candidate)` | Same module | Pure exact Page/owner/generation/permission representation, same-installation references, typed configuration and represented inherited constraints. Validity grants no entry or invocation. |

No native inspection capability is registered as a canonical service. There is no
HTTP endpoint, SEWN provider, new manifest/prototype field, package approval function
or executable portable handle. Current package/receipt/catalog validators retain
their existing closed schemas. Package versions, lockfiles and frozen clients do
not change.

Inspection reuses `readInstalledState`, safe reads and installed integrity/recovery
checks, `loadRepository`, `activatePackages`, and `acquirePackageExecution`'s exact
accepted-tree/placement validation. It acquires no provider work or execution lease
and performs no service dispatch, Gate resolution or writes. Native authority is
used only to inspect; it never becomes an action caller. Installation guards and
source/config fingerprints are rechecked before returning the report. Recovery,
pending review, drift, symlinks or invalid catalog state yield a sanitized blocked
report with no salvaged action facts. It does not bypass integrity to enumerate a
corrupt catalog. As with the existing native APIs, trusted local roots/writers and
loaded registries remain within the trusted host boundary.

Pure validators reuse canonical `validatePackageManifest`, `permissions`,
`actionDeclarations`, value-contract validation/matching, JSON budgets and existing
policy hashing. Fixed-operation metadata comes from the trusted registered library;
Store facts come from accepted host configuration. They inspect static scope/
ownership/policy representation and do not implement a second live policy evaluator.
The inspector never calls `administrativeAuthorize`, `authorizeSitePolicy`, a provider
handler or `resolve-session`. Passing in forged pure facts can never construct a
context or approve anything.

## Validation representations

These are **versioned candidate-analysis formats accepted only by B3 native/pure
validation**, not newly accepted package, prototype, receipt or runtime fields.
They are review input and may not be copied into installed state. B4 still needs a
versioned durable publication discriminator that older engines reject.

### Action candidates and effective scope

`validateBackOfficeActionScope` accepts bounded plain JSON:

```text
{entry, app, action, operation, stores?, resolvedScopes?, initiating?, review?}
```

`entry` is an installed snapshot with existing manifest/receipt/approved/mapping
fields. `action` is the existing closed action descriptor; `scopes` represents both
required resources and maximum resources, with no new required/max syntax.
`operation` is trusted registered `{apiVersion,capability,effect}` metadata.
`stores` are trusted configured Store definitions, used only as facts; no record
contents or provider handles are read. `resolvedScopes` contains trusted library
resolution results. Inspector candidates replace only an existing exact action
ID for analysis; they do not install/modify declarations.

B3 checks missing/empty/duplicate/unknown/wildcard scopes, closed declaration and
schema/API versions, fixed operation/capability/effect, managed owner, approved
logical and concrete coverage, mirrored receipt/policy evidence, accepted Store
mappings and App/publisher/package/principal/optional installation ownership.
For a policy-bound Store, every required resource must represent an applicable
BackOffice rule for the fixed operation. Missing rules fail static eligibility.
A public rule or no Store policy does not create a personal Store-grant requirement.
Gate uses its trusted `current-app` resolver; the result must be the exact App.

The result reports separately:

- Existing approved/legacy concrete resources.
- Declared logical resources and resolved maximum.
- Restrictive resource intersection with receipt and optional initiating scopes.
- Independent operation/policy requirements, transaction obligations and review state.
- `authority:false`, `liveAuthorization:"not-checked"`, `enforcementReady:false`.

All required resources must fit; a clipped intersection is accompanied by failure,
never success. A represented initiating context must match site/package/installation,
operation capability and complete required scope. It is plain static evidence, not
a branded live context. Resources absent from the action have no proposed package
service scope. Actual caller grants remain live action/Store predicates, not a
new list of user-owned Store resources.

The current canonical administrative resource families exercised are **WydStore and
WydGate**. Additional library resource families fail with `BO.RESOLVER_UNSUPPORTED`
until their trusted required-resource validation is qualified. This is an explicit
preflight limitation, not a receipt-wide fallback or change to current dispatch.

Transactions remain one fixed Store operation; validation records same-store-only
and all-members-live-authorization obligations. Every declared collection requires
the existing conservative `transaction` preflight rule; actual member operations
also need their individual capabilities and current policy later. B3 does not parse
arbitrary transaction values as proof that all future members will be authorized,
execute a transaction, infer cross-store atomicity or remove member checks.

### Page-entry proposal

`validateBackOfficePageEntry` accepts:

```text
{proposal, entry, app, pages, nodes, review?}
proposal = {
  schema: "wydgit.backoffice-page-entry-proposal/1",
  key, app, package, installation, owner, page, generation,
  policyRevision, permission, bindings
}
```

All proposal fields are mandatory and closed. The site-unique local `key` is a label,
not authority. Permission uses the existing exact permission grammar. `owner` must
be managed by the installation and occur in the selected Page; `page` must be an
actual accepted Page attachment/prototype. Placement must be active BackOffice in
this exact App. Generation and policy revision must match. No default entry is
created from placement or slug. Empty `bindings` permits informational Pages.

`pages` and `nodes` are static host facts. Each node contains `{id,page,type,
ancestors,isPage}`; ancestry is most-derived-first and includes its own `type`.
The inspector derives these from the real hydrated registry/graph. `type` avoids
the reserved `prototype` key in portable JSON. No raw runtime/registry escapes.

Each binding is closed `{name,consumer,reference,usage,fixedInput,constraints}`.
Names are unique within the entry. `consumer` must be in the selected Page.
`reference` must exactly match the existing action reference schema, App, package,
receipt, managed owner, action, generation and declaration/receipt/policy digest.
Names never trigger fallback to a different site/installation/package. `usage` is
`prepare` (read-effect only) or `intent`. `fixedInput` is a typed subset of declared
action parameters, with no capability/context/handler fields. Actual intent input,
constant override rejection and explicit confirmation remain future live checks.

Each constraint is closed `{type,targets,effect,input,output}`. Targets are finite
same-installation `owner/action` names. Constraints run base-to-derived using actual
node ancestry. The selected action must fit every target/effect constraint. Input
contracts may narrow the action input; action output must fit the consumer contract.
A derived constraint cannot widen the parent's targets, effect or input/output
contract. Containment/prototype labels grant nothing. Contract containment uses the
existing small value grammar, not arbitrary JSON Schema or executable validators.

Material boundary: no current prototype/receipt stores an authenticated Page action
slot declaration. B3 checks the **represented constraint chain** against real ancestry;
it cannot certify that a submitted chain includes all future accepted declarations.
B4 must authenticate the versioned complete declaration/configuration chain in
native review and check it again at publication/invocation. Omitting or changing
candidate constraints changes its review hash; it cannot create an executable grant.
A matching review candidate still leaves `pageEntryApproved:false`.

### Review candidate: witness, not approval

A closed `wydgit.backoffice-review-candidate/1` has exactly:

```text
{schema, app, package, installation, generation, policyRevision,
 subject, contractHash, status}
```

`subject` is `action:owner/action` or `page:entry-key`; `status` is `reviewed` or
`revoked`. SHA-256 binds the exact candidate, accepted artifact/receipt and relevant
resolved scope/static policy or Page graph evidence. Mismatched identity, revision,
generation, hash or represented revocation fails. A matching witness reports
`matching-candidate` and `BO.REVIEW_UNPUBLISHED`, **never authenticated approval**.
There is no signature, native reviewer verification, durable acceptance or migration
operation in this schema. B4 must integrate those with existing package-policy
review; B3 deliberately cannot emit an installed action as ready.

## Read-only inventory and diagnostics

Native options are `{root,libraries,installationContext,verifiedPackages?,
pageProposals?,actionCandidates?,reviews?}`. Candidate overrides are exact
`{package,installation,action}` records. Unknown selectors, duplicate action/review
selectors or duplicate site entry keys block instead of silently dropping input.

A report uses `wydgit.backoffice-migration-preflight/1` with source
`local-installed-catalog`, canonical App/catalog revision/fingerprint, installations,
actions, Pages and findings. It contains no credentials, provider roots, record
values, timestamps, newly generated IDs or raw exceptions. Collection/scope and
permission identifiers are intentional native review evidence. Results are deeply
frozen and deterministic for identical accepted bytes/inputs; input order is
preserved where semantically ordered, such as inheritance constraints. Installation
and action inventory order is stable. Repeated inspection changes no file bytes,
metadata, receipts, database state or configuration. Filesystem reads can still
update OS access-time accounting; this is not a content/policy mutation guarantee.

| Primary status | Meaning |
| --- | --- |
| `not-applicable` | No active administrative action or requested Page entry; dormant/retired/retained actions remain inventoried and require review before activation. |
| `requires-declaration` | Only declaration/required-resource issues (possibly approval issues too) prevent a candidate from satisfying the restrictive contract. Publish corrected versioned declarations through normal lifecycle. |
| `requires-receipt-reconciliation` | Declaration is valid, but a required capability/logical/concrete resource is outside approved receipt scope. Obtain explicit reviewed reconciliation; do not copy ambient scope into a declaration. |
| `blocked` | Invalid integrity/identity/placement/ownership/schema/operation/static policy, stale/revoked witness, ambiguous selector or another unclassified static failure. Restore exact state/correct evidence first. |
| `requires-review` | Static predicates pass, but authenticated durable migration/entry review remains absent. This includes matching review candidates. |
| `ready` | Reserved for a future enforcing contract with authenticated durable reviewed adoption. **B3 never emits it.** |

Fundamental blocking errors take precedence; declaration errors take precedence
over approval-coverage errors. All detailed findings remain, so a primary status
never hides other obligations. The aggregate report is blocked if an item is
blocked, otherwise requires review if any item needs work, otherwise not applicable.

Each finding has stable code/severity, applicable App/package/installation/action/
Page identity, requirement ID, violated contract, evidence source, remediation,
review-required flag and whether eventual enforcement would reject. That flag is
hypothetical: B3 never rejects production admission. Root-level corruption reports
no unverified identities. Static checks cannot prove a user's live permission,
provider admission, live revocation freshness, deadlines or a mutation outcome.

Budgets reuse existing descriptor-inspecting canonical JSON validation before
copy/access: 4 MiB, depth 64, 131,072 nodes for inspection/candidate/report data,
within existing package-state ceilings. Existing action/declaration constraints
still apply. At most 256 proposed entries/actions and 512 review witnesses per
inspection; each entry has at most 32 bindings/constraints/targets. Oversize reports
fail closed instead of truncating authority evidence. No generic network service
or production deployment is needed; native tooling supplies its existing registry.

## Actual inventory and compatibility findings

The repository `content/` has **no installed catalog or deployed receipt**. No external
or production installation was accessed. Its installed-state report is not applicable.
The following are repository manifests exercised through real disposable installations:

| Evidence | Actual discovered actions | B3 status |
| --- | --- | --- |
| Members example / independently installed module | `divdev/backoffice-members`: `list-members`, Gate current-app | `requires-review`; no durable strict adoption. |
| Notices example / independently installed module | `divdev/backoffice-notices`: `list-notices`, Store notices | `requires-review`; no durable strict adoption. |
| Shared B1 records/archive fixture, JSON and SQLite | `get`, `create`, `update`, `delete`, `transaction`, `archive-get` in the disposable members package | Six `requires-review` per provider. Receipt exposes records+archive; five records actions declare only records. Archive action declares only archive. |
| Shared B1 installed Taskboard native Page | No administrative action declarations | Informational Page proposal statically valid after exact BackOffice placement, still `requires-review`; existing placement alone has no entry. |
| Retired versions of fixture installations | Same declared actions, retained resources | `not-applicable` now; strict migration required before reactivation. |

Legacy get/transaction still reaches another approved resource when actual service
policy permits it, as BOB1-02 continues to prove. A strict candidate exposing records
only reports one resource even though legacy exposure has two. An intended two-resource
transaction needs both declared/approved resources **and both transaction preflight
rules**, plus future actual-member checks. B3 exposes that obligation without changing
current runtime behavior. Missing action resource declarations in valid accepted
catalogs are not silently salvaged: canonical catalog validation blocks malformed
installed manifests. The missing-declaration classification is demonstrated through
an explicit non-published candidate override instead.

No action becomes ready merely because its receipt covers all requirements. No
legacy grandfathering, receipt rewrite, automatic declaration expansion, migration,
policy review, upgrade or runtime-rejection flag is provided. The ratified migration
startup gate is a future enforcement prerequisite, not active B3 behavior.

## Qualification and remaining B4 obligations

[Tests](../../test/backoffice-preflight.test.js) exercise genuine installed JSON and
SQLite facts using the [shared B1 fixtures](../../test-support/backoffice-preflight.js).
Both providers receive the same intended static decisions. Existing BOB1-02 and
BOB1-03 assertions remain: fixture setup was factored for reuse, not weakened.
Installed-package qualification also stages the new tests and checks both new modules
in tarball inventory; runtime imports from the development checkout remain rejected.

Coverage includes all ten requested resource scenarios, exact/informational Page
proposals, missing approval/permission, foreign sites/packages/receipts, missing and
ambiguous actions, stale generation, retired placement, typed nested/inherited
references, authority manufacture/constraint widening, malformed JSON/accessors/
handles, review revocation/staleness, integrity/config/resource drift, symlink and
recovery barriers, deterministic repeated output, file/content/metadata preservation,
secret/path omission and unchanged receipt-wide runtime characterization.

The new export-availability test first failed natively with **0 pass / 1 fail** on
missing `inspectBackOfficeMigration`. No pre-existing validator vulnerability is
claimed: these are new surfaces. Early focused attempts caught missing fixture imports,
candidate aliasing into its source manifest and a forbidden portable JSON key;
those were corrected without weakening runtime security or deadline assertions.
The initial restricted file-level test failure is not functional evidence.

Exact commands, results and log hashes are retained in the
[B3 machine-readable evidence](../../test-support/backoffice-b3-evidence-2026-10-21.json).
Final required checks follow completed code/docs/evidence edits; their exact final
results are recorded in the commit message/owner handoff as well.

B4's first enforcing increment should publish/authenticate strict-action adoption
through existing stopped-App native review/recovery, add exact migration/startup
prerequisites, then apply trusted scope attenuation while preserving original caller,
capabilities, lifetime and limits. It must prove ordinary and transaction denials and
legitimate multi-resource positives over both providers. Canonical HTTP Page entry
comes after that boundary, with composition-only protected dispatch, explicit typed
intents, complete accepted ancestor constraints and live final authorization. Do not
use these static results as an executable allow token.

The system is ready to begin that scoped implementation after its remaining
publication/versioning design is encoded and qualified; **it is not ready to switch
on runtime enforcement or declare the BackOffice foundation complete**. Human
accessibility, broader ADM-01 controls and HTTP reliability remain separate work.
WydData/CIR/components/wider domains remain deferred. No deployment or release,
version bump, HTTP limit/cookie/status/deadline change or frozen-client update occurs.
