# Execution contexts, administrative domains, and WydStore isolation

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

The [reviewed package-policy foundation](reviewed-package-policy-reconciliation.md)
adds native stopped-App plan/review/apply with separate policy revisions and durable
host approval. Package requirements, execution placement, SEAM, Gate membership and
store ownership remain independent; direct policy-file edits still fail drift checks.

**Status:** Governing architecture. The [first execution-context increment](execution-context-foundation.md)
is implemented in alpha.16; wider administrative domains, isolation and provisioning
remain targets. This document’s matrix describes requirements, not completion.
**Recorded:** 2026-10-18  
**Scope:** Wydgine, WydClient/WydSUB, WydStore, WydGate, SEAM and WydHosting.  
**Compatibility:** 0.3 is a deliberate migration boundary for server context resolution.

The [implemented site-policy increment 3](backoffice-scoped-policy-and-store-authorization.md)
qualifies current Gate policy, context/SEAM intersection and protected JSON/SQLite
site-store admissions. Account/provider domains and wider matrix cases below remain
targets; the implementation record states the exact qualified subsets.

## 1. Purpose and governing contracts

Define one execution model for public functionality, site administration, future
customer-account administration and hosting-provider administration. Reuse Wydgit
prototypes and administrative controls while isolating execution authority,
membership directories, private data and privileged infrastructure.

This document integrates the Almond-Lab architecture write-up supplied by the user
and its subsequent client-execution additions. The additions supersede the earlier
`Client / Browser` table and prohibition on all client inference: `Client` now
implicitly resolves to `SUB`. Server context inference remains restricted to
trusted placement; there is no legacy `Server -> FrontEnd` default.

Read with these governing sources:

- [Founding architecture](FOUNDING-ARCHITECTURE.md): App is the canonical root;
  inheritance defines identity, dependencies provide services, and SEAM owns authority.
- [Current release scope](milestones/0.3-release-status.md), accepted
  [Decision 0003](decisions/0003-defer-managed-hosting-qualification-to-0.4.md) and
  [long-term roadmap](roadmap/long-term-platform-vision.md): **0.3-J remains
  Platform/App Administration**. Managed WydHosting, privileged hosting functions
  and the Debian VM experiment remain deferred to **0.4**. I5.6 remains incomplete,
  experimental and unqualified; its security gates are preserved.
- [Object model](object-model.md), [SEAM](seam.md), [canonical services](canonical-services.md),
  [WydStore](wydstore.md), [WydGate membership](wydgate-membership.md) and
  [package lifecycle](package-lifecycle.md): existing implemented contracts remain
  authoritative until explicitly versioned implementation changes replace them.
- [WydClient](wydclient.md), [WydOS proposal](wydos.md) and
  [I4 architecture](milestones/0.3-I4/README.md): preserve execution/adaptation,
  service and provider boundaries; optional platforms do not become engine dependencies.

Requirements below describe the agreed target architecture, with AccountAdmin and
optional native client contexts explicitly still proposed. They do not assert that
current closed schemas accept new fields, that all domain checks already exist, or
that native/mobile runtimes are available. No milestone is completed or renumbered.

## 2. Terminology and responsibility

A **site** means a website deployment/profile of a canonical **App**, not a new
object root. A **customer account** is a hosting ownership domain. It is distinct
from a WydGate authentication account, a membership, an OS user, a publisher, a
package, an installation and a worker/pool identity. Equal labels do not merge them.

`runat` identifies execution location/model; `context` selects an execution policy
environment. An **ownership domain** identifies whose protected data/resources are
being used. The context label is one attribute of a trusted execution identity,
not the whole existing SEAM `ExecutionContext` object and not a permission grant.

| Component | Responsibility |
| --- | --- |
| Wydgine | Server execution, trusted context resolution and server transport |
| WydClient | Client execution, adaptation and presentation through portable interfaces |
| WydGate | Identity, domain-scoped membership, rosters, groups, roles and application permission policy |
| WydStore | Trusted ownership bindings, authorization and provider-independent logical data access |
| SEAM | Trusted caller identity, capabilities, scope, visibility, authorization and execution bounds |
| WydHosting | Future account/provider provisioning, placement and OS isolation through narrow privileged boundaries |

## 3. Canonical execution contexts

The following `runat` and `context` identifiers are **case-sensitive**. These are
architecture identifiers, not new accepted WBasic grammar or manifest fields.
Existing package targets (`client`, `server`, `client-server`), CLIENT authoring,
WydSUB protocol versions and case-insensitive language facade names remain separate
contracts; mapping/versioning must be explicit before implementation.

| `runat` | `context` | Meaning and status |
| --- | --- | --- |
| `Client` | `SUB` | Portable client application interface; implicit when omitted, explicit `SUB` also allowed |
| `Server` | `FrontEnd` | Public-facing site execution; 0.3 foundation target |
| `Server` | `BackOffice` | Site administration; 0.3 foundation and 0.3-J target |
| `Server` | `AccountAdmin` | Proposed future customer-account administration; confirm during WydHosting 0.4 design |
| `Server` | `HostAdmin` | Reserved provider administration context; reservation does not enable privileged hosting in 0.3 |

Unknown spellings, case variants and invalid runtime/context combinations fail
validation. `Server / SUB` and `Client / BackOffice`, for example, are invalid.
Reserving a name does not make its environment available. Unavailable contexts
must be rejected rather than mapped to a different context.

Context is not a role. Authors, editors, moderators and owners may all operate in
BackOffice with different permissions. Neither AccountAdmin nor HostAdmin supplies
blanket access to subordinate private data. All server contexts use the same
Wydgine programming model; deployment may require separate processes, credentials,
networks and storage. Sharing an engine model does not mean sharing OS authority.

## 4. Prototype, instance and execution resolution

### Reusable prototypes and restrictions

A prototype may omit context and remain reusable across permitted environments.
A context-neutral server DataTable or WydGate MemberRoster can have separately
placed FrontEnd, BackOffice and future administrative instances. Neutrality does
not promise runtime portability or availability of services/capabilities everywhere.

An explicit prototype context restriction constrains all descendants and instances.
Inheritance may preserve or narrow restrictions, never widen them. Effective
restrictions must be checked across the entire ancestor chain; an empty result
rejects registration/placement. Runtime target requirements must also be satisfied.
Exact restriction syntax, including whether sets are exposed, remains open.

### Concrete instance resolution

Every executable instance resolves to one concrete context before execution:

1. Validate the runtime target and all inherited restrictions.
2. For `Client`, omitted context resolves to `SUB`; explicit `SUB` is valid.
   Reject any conflicting restriction or unsupported declared future client context.
3. For `Server`, use explicit instance selection within a trusted placement, or
   derive from trusted parent placement/installation/provisioning. A parent can
   supply placement metadata only when the host has validated it; containment
   itself grants no trust or authority.
4. Reconcile all applicable inputs. An explicit value cannot override an incompatible
   trusted placement or restriction. Conflicting or ambiguous inputs fail closed;
   no precedence rule may silently choose an elevated environment.
5. Bind the resolved context, owning domain and lifecycle to a host-issued execution
   identity, then independently authorize the requested work.

A context-neutral prototype may load as a definition, but a server instance cannot
execute while unresolved. Missing server placement is an error. **There is no
permanent `Server -> FrontEnd` fallback.** A package declaring `HostAdmin` cannot
create host placement, change ownership or grant itself capabilities.

Effective context and domain bindings are immutable for that execution. Moving an
instance to another context/domain is a separately authorized, validated lifecycle
operation that ends old execution authority and constructs fresh bindings. It is
never a field assignment by package code. Async continuations, events, callbacks
and service handles retain caller authority and lifetime guards; calling a more
privileged object cannot borrow its execution identity.

## 5. Portable and future native client execution

`SUB` is the portable **client application interface**, not a browser or DOM
emulator. WydClient remains the client runtime, `CLIENT` its public object surface,
and WydSUB the existing protocol identity. Using `SUB` as a context identifier does
not rename those surfaces or revive the historical runtime nickname as a product.

Web, native desktop and mobile adapters may implement the same semantic interface
without emulating a browser. Semantic controls, state, events and service intent
map to appropriate native mechanisms. Ordinary Wydgits receive no raw DOM, Node,
shell or arbitrary platform bindings. A standalone client remains possible without
Wydgine or WydHosting; server-authoritative data still needs an explicitly defined,
authorized transport. This document adds no such transport or automatic data sync.

Portable capabilities can expose runtime-independent behavior. A **camera
abstraction**, for example, could request a bounded capture with user consent and
return a documented portable result through browser or native adapters. This is a
proposed capability example, not an existing API. It is different from exposing a
specific mobile camera SDK, native handle or platform-only capture pipeline.
Missing support, denied consent and unavailable hardware must be explicit outcomes.
No adapter may claim compatibility by silently weakening the semantic contract.

Future optional native/platform-specific client contexts or APIs **may** provide
extra runtime freedom at a portability cost. Such Wydgits must declare platform
requirements and supplied implementations in manifests, and supply separate
implementations per runtime where necessary. Selection must validate declared
requirements, runtime support and host approval before execution. Unsupported
variants fail explicitly; any fallback is a deliberately supplied and declared
implementation. There is no silent compatibility or browser emulation promise.

Manifest declarations describe requirements, not grants. SEAM, consent, package
approval and OS enforcement still apply. Exact future context names, schema,
implementation-selection rules, compatibility/version negotiation and permitted
native APIs are deferred. Current closed manifests must not be documented as
already accepting speculative extensions. Reuse the [WydOS proposal](wydos.md)
where its controlled service contracts fit rather than exposing unchecked native access.

## 6. Ownership and storage domains

Context and store ownership are separate axes. FrontEnd and BackOffice share a
site's own WydStore resources subject to separate authorization; the shared domain
does not mean all packages, collections or records are mutually readable.

| Owner domain | Administrative environment | Isolation requirement |
| --- | --- | --- |
| Site/App | FrontEnd and BackOffice | Own site data only under exact grants; other sites remain isolated even within one customer/pool |
| Customer account | One designated active AccountAdmin site and associated store/domain | Separate from all hosted sites and other accounts; hosted sites cannot open it |
| Hosting provider | Designated HostAdmin site/store provisioned by trusted installation | Separate from accounts and tenants; no tenant/customer raw access |

Administrative sites are Apps with trusted domain designations. Their App/site IDs
do not convert their account/host-owned storage into ordinary hosted-site storage.
An account manager may create a site without reading its private member records;
a host operator may suspend a site without permission to query its private data.
There is no implicit upward, downward, same-owner or sibling-domain data access.

### Trusted WydStore binding and access

The target binding associates each store with immutable trusted site/App, account
and host IDs as applicable, plus its domain type/ID, lifecycle and existing resource
ownership constraints. Runtime context participates in authorization but is not a
substitute for owner identity. Host configuration/provisioning establishes the
mapping; request fields, friendly store names, paths, manifests and record content
cannot establish or replace it. Exact descriptor representation is an open decision.

Retain existing exact App/publisher/package/store ownership, installation identity
where required, logical collection scopes and capability checks. Introduce domain
metadata through reviewed schema/API versions, not by dropping current checks or
reinterpreting an existing `app` field as a customer account ID. In particular,
`library:wydgate` retains its private dependency binding rather than exposing its
identity directory to roster UI packages.

Every operation that reaches protected service state must authorize the genuine
caller, runtime/context, domain, exact target, capability, scope and applicable
membership policy before provider access. Cover reads, queries, writes, history,
transactions, schema/lifecycle effects, exports and recovery interfaces where
supported. Cached service handles and reused connections cannot retain obsolete
placement authority. Purely local draft operations and unchanged `save()` keep
existing semantics; they are not protected-store access or proof of authorization.

### Logical and physical isolation

JSON, SQLite and future relational/document adapters must enforce the same domain
authorization contract. Trusted adapters receive only validated operations; raw
paths, SQL, adapters, connection strings and credentials never reach ordinary
Wydgit code. Equal logical store names across domains must never collide.

Use separate backing paths/namespaces/databases, credentials, restricted filesystem
permissions, processes and network boundaries as the adapter/deployment requires.
Prevent path traversal, symlink substitution and mutable mappings from redirecting
access into another domain. JSON and SQLite file separation alone is insufficient
if a compromised tenant process has credentials/permissions to read administrative
files. Privileged secrets must never reside in tenant processes, inherited process
environments, logs, package properties or returned handles.

OS processes, credentials, namespaces and filesystem/network controls reinforce
logical checks. Shared-process logical isolation is not OS containment. Follow the
standalone 0.3 process/user/storage separation in Decision 0003; managed pool claims
require separate 0.4 evidence. An adapter/deployment unable to meet the required
isolation contract cannot qualify for multi-tenant WydHosting. Document and test
per-adapter atomicity, durability, locking and recovery limitations; common APIs do
not imply identical crash guarantees or distributed transactions.

## 7. WydGate scoped membership and policy

WydGate manages rosters, memberships, groups, roles, role assignments, permission
assignments and associated policy through reusable Wydgits and canonical services.
Context-neutral prototypes can be instantiated as site-member controls in BackOffice,
account-member controls in AccountAdmin or provider-staff controls in HostAdmin.
Each instance receives a separately trusted domain binding and authorized facade.
These are conceptual placements, not existing prototype IDs or public syntax.

Reuse does not share identity directories, credentials, sessions or grants. Existing
Gate authentication accounts and App memberships are not hosting customer accounts.
No automatic SSO, federation or identity merging follows from customer ownership,
a shared prototype, equal usernames, cookies or UI composition. Current Gate APIs
remain App-scoped; account/host scope extensions need explicitly versioned contracts.

Gate supplies verified identity and membership/role/permission policy inputs to
trusted authorization. **Identity and application permissions do not mint SEAM
capabilities.** Effective permission requires the intersection of host-approved
capabilities/scopes, trusted context/domain, Gate policy and operation requirements.
SEAM and service boundaries enforce that decision. A membership role change cannot
expand host grants, edit placement or expose the Gate backing store.

Revalidate relevant membership/session state for protected actions. Do not assume
frozen identity snapshots observe revocation. Domain-bind cookies/session resolvers,
requests and policy caches; stale or unavailable policy must not permit privileged
work. Revocation freshness, policy versioning and long-running action behavior need
an explicit contract before broader administrative activation.

## 8. One modular BackOffice framework

Build one modular framework with reusable navigation, layout, property editing,
forms/validation, tables, content editors, dashboards, module registration and
management-action controls. Installed Wydgits may contribute approved modules via
existing lifecycle/service abstractions. Contributions and visibility are filtered
by capability and policy; hidden buttons are not enforcement.

Do not prematurely divide this into WydConsole, WydBackoffice and WydDash products.
Naming and library decomposition remain open. AccountAdmin and HostAdmin may reuse
the framework later with different placements, membership domains and service
bindings. No UI reuse transfers storage credentials, process authority or grants.
Site-level APIs/user experiences remain **0.3-J Platform/App Administration**.

## 9. Cross-domain service operations and SEAM enforcement

Site creation, resource allocation, plan changes, suspension and backup/recovery
may legitimately cross domains. They must use narrow, audited service operations,
never raw cross-domain WydStore handles or a universal administrative connection.
Use existing canonical dispatch where applicable and separate privileged brokers
where needed; no new universal engine or parallel authority system is implied.

For each operation the trusted boundary must:

1. Authenticate the principal and validate its current session/lifetime.
2. Check trusted runtime/context, initiating domain, exact target and ownership relationship.
3. Require separately approved capability, scope, current authorization and execution bounds.
4. Validate bounded arguments against a closed operation contract; no arbitrary commands,
   raw SQL, filesystem destinations or caller-selected credentials.
5. Execute through the appropriately isolated service using its own narrow authority.
   A privileged implementation binding must not launder authority for its caller.
6. Return the minimum safe result and record initiator, source/target domain, action,
   policy/operation reference and outcome in a protected audit trail without secrets.
7. Handle retries, cancellation and uncertain completion using durable operation identity
   where side effects require it. Reconcile state before retrying an unknown result.

Administrative labels alone satisfy none of these checks. Enforce at dispatch and
service/resource boundaries, including background work, not only the UI/router.
Library registration, provenance, signatures, inheritance and containment provide no
capability escalation. Existing SEAM visibility, traversal, budgets and same-caller
rules remain in force. Denial must not leak foreign record existence or credentials.

## 10. Provisioning, replacement and recovery

### Hosted sites

Trusted site provisioning binds canonical App/site identity, owner relationship,
store mappings and permitted FrontEnd/BackOffice placements before readiness.
Separate grants protect public and administrative actions over the site's data.
Tenant installation cannot designate an administrative domain, alter an owner
mapping or inject administrative credentials. Standalone operation needs neither
WydHosting nor a customer-account/HostAdmin deployment.

### AccountAdmin: proposed 0.4 environment

Each hosting customer account has a single designated active AccountAdmin site
and associated administrative store/domain. A customer may set it up through an
authorized workflow and configure/extend it within approved bounds. Whether setup
creates it automatically or guides customer creation is open; neither option lets
an ordinary hosted site self-promote. Trusted provisioning validates account
ownership and atomically protects uniqueness under concurrent setup attempts.

### HostAdmin: reserved for trusted hosting installation

Trusted WydHosting installation provisions the designated HostAdmin site/store
and provider designation. Tenant package installation and customer workflows cannot
create, replace or restore it. The environment and narrow privileged brokers are
separate from tenant processes. Reservation in 0.3 creates no working root-capable
panel, OS broker or provider store.

### Durable administrative lifecycle

Provisioning and replacement must be planned, bounded, audited and recoverable.
Stage the App, private store, identity bootstrap, policy and protected designation
before readiness. Publish only a consistent approved binding; partial setup must
not expose an anonymous admin UI or fabricate ownership. Retries must reconcile
existing staged state instead of creating competing active designations.

Protect replacement/recovery with independent trusted authorization so losing the
admin site does not remove the only recovery path. Verify backup provenance,
owner identity, schema and policy before restoration; rotate compromised secrets
and invalidate old execution/session/placement authority. Stage replacement while
fencing the old designation, then publish one active authority. Preserve recoverable
source data until verification; never duplicate live authority or silently promote
a hosted site. Failed recovery stays unavailable with a protected operator path.

Crashes before publication leave private inactive staging. Crashes during cutover
require durable intent and reconciliation of designation, data and policy before
resuming. After publication, retries must discover the committed result. Do not
claim an atomic transaction across registry, filesystem, store and broker without
implementation evidence. Conflicting/unknown outcomes block activation and deletion.

Respect package lifecycle dependency, retention, protected-installation and recovery
barriers. Removing/upgrading an administrative module cannot orphan protected
identity data, remove a shared dependency or erase the sole recovery environment.
Current lifecycle machinery is a reusable foundation, not proof that these future
cross-domain recovery cases are implemented. History is not backup; exercise
provider-consistent backups and restore on disposable isolated roots.

## 11. Wydgine 0.3 migration boundary

Inventory existing prototypes, instances, canonical App/source fragments, manifests,
examples, fixtures, installed catalogs/receipts, persisted data, service configuration
and generated artifacts affected by resolution. Classify server placements explicitly;
do not bulk-label every legacy server object FrontEnd. Reject ambiguous or
unauthorized cases for operator review. Client omission resolves to SUB under the
new contract; replacing an old Browser label requires an explicit migration.

Before implementation, select versioned schema and artifact transitions compatible
with current closed validators. Plan against exact source/installation revisions
and produce an inspectable classification/change report. Back up source, complete
record/history state, ownership mappings and secrets through trusted channels;
quiesce writes or use proven consistent checkpoints. Never serialize live contexts,
handles or credentials into portable data.

Preserve stable App/Wydgit/domain identities, customizations, references, membership
relationships, ownership, record revisions/history and retained-package constraints.
Validate intermediate and final graphs, inherited restrictions, context placement,
store ownership and policy on JSON and SQLite. Context migration must not manufacture
administrative roles, capabilities or parent trust. Packages need new versioned
artifacts when bytes change; retain immutable historical client bundles and fixtures
that intentionally verify old schemas.

Stage, validate and checkpoint migrations before activation, with resumable intent,
conflict detection and checked rollback. Recovery must distinguish source, staged
and committed state and fence obsolete bindings. Recheck authorization and revisions
when applying a saved plan. A one-time conversion tool is optional future work,
not a normal runtime inference path or a tool delivered by this docs-only change.
Old incompatible data must fail clearly with migration guidance. Do not restore
legacy `Server -> FrontEnd` behavior to make old fixtures pass. Rollback must use a
compatible complete snapshot/runtime pair without reviving stale elevated authority.

## 12. Threat and acceptance matrix

These are required **future qualification cases**, not test results. Run both
ordinary APIs and bypass attempts at host/service/adapter/deployment boundaries.
For persistence cases cover JSON and SQLite independently; repeat the contract for
future adapters. Separate portable logical evidence from installed OS evidence.

| ID | Scenario / threat | Required acceptance result | Phase |
| --- | --- | --- | --- |
| CTX-01 | Server has no context or trusted placement | Reject before execution; no FrontEnd default | 0.3 foundation |
| CTX-02 | Neutral prototype placed explicitly or through trusted parent/provisioning | Concrete matching context; ambiguity/conflict rejected | 0.3 foundation |
| CTX-03 | Descendant or instance widens ancestor restriction | Reject including multi-level inheritance | 0.3 foundation |
| CTX-04 | Wrong case, unknown context or invalid runtime/context pair | Fail closed; reserved unavailable contexts do not activate | 0.3 foundation |
| CTX-05 | Request/manifest declares HostAdmin, mutates context or borrows privileged callee | No placement or grant escalation; same-caller checks hold | 0.3 foundation; host case 0.4 |
| CTX-06 | Placement changes while old handles/events continue | Old lifetime fenced; fresh authorization required | 0.3 foundation |
| CLI-01 | Client omits context or explicitly declares SUB | Same resolved SUB; restrictions still enforced | 0.3 foundation |
| CLI-02 | Same semantic UI/camera capability on web, desktop and mobile | Contract conformance without browser emulation; unsupported/denied explicit | Future adapter qualification |
| CLI-03 | Future native requirement unsupported or variant absent | Explicit refusal; no silent emulation, substitution or authority grant | Future client extension |
| STO-01 | FrontEnd and BackOffice access own site's shared store | Allowed operations succeed; protected operations independently denied | 0.3 foundation/J |
| STO-02 | One site targets another, including same customer/pool and equal store names | Deny all foreign reads, history, queries and mutations | 0.3 logical; 0.4 managed OS |
| STO-03 | Site targets AccountAdmin or HostAdmin data | Deny; no backing resource or secret reachable | 0.4 |
| STO-04 | Account targets another account or HostAdmin; host targets private tenant records | Deny absent narrow explicit service authorization; hierarchy grants nothing | 0.4 |
| STO-05 | Forged IDs/mapping, copied handles, raw adapter/credential access | Reject; immutable trusted ownership and lifetimes remain effective | 0.3 site; 0.4 administrative |
| STO-06 | Traversal/symlink/mapping swap, direct file/network attempt from tenant process | OS/storage controls deny; no administrative secrets in tenant process | 0.4 installed qualification |
| GAT-01 | Same roster prototype instantiated at site/account/host scope | Independent directories, memberships, sessions and service bindings | 0.3 site; 0.4 wider scopes |
| GAT-02 | Owner role without capability; capability without required membership | Both denied; no implicit capability minting | 0.3/J |
| GAT-03 | Revoked/suspended membership or stale session/policy cache | Protected operation rejected under explicit freshness contract | 0.3/J; 0.4 wider scopes |
| ADM-01 | UI hidden, direct action forged, module contribution requests wider scope | Server/service denial; approved controls still work | 0.3-J |
| XDM-01 | Authorized provision/suspend/plan/backup action | Exact target/action succeeds with safe result and protected audit | 0.4 |
| XDM-02 | Cross-domain action targets unrelated data or service retries unknown result | Deny unrelated access; reconcile uncertainty without duplicate effects | 0.4 |
| PRV-01 | Concurrent AccountAdmin setup or tenant self-promotion | At most one active designation; tenant cannot designate | 0.4 |
| PRV-02 | HostAdmin installation/replacement by customer | Deny; only trusted provider workflow succeeds | 0.4 |
| REC-01 | Process death before/during/after provisioning or replacement publication | Recover consistent ownership, fence old authority, no exposed partial admin site | 0.4 |
| REC-02 | Compromised/old backup, unavailable admin site or interrupted restore | Protected independent recovery; validate provenance and rotate/fence authority | 0.4 |
| MIG-01 | Existing Wydgits/fixtures/persisted data migrate and restart | Stable data/identity/history; no legacy runtime fallback | 0.3 foundation |
| MIG-02 | Crash, stale plan, conflicting owner mapping or rollback during migration | Preserve source; resume/rollback checked state; ambiguity blocks execution | 0.3 foundation |
| LIF-01 | Remove shared/protected administrative dependency during update/uninstall | Dependency/retention barriers protect data and recovery path | 0.3 lifecycle/J; 0.4 domains |
| LIM-01 | Excess work, unauthenticated admin request, malicious arguments or audit payload | Bounded denial, no secret leakage or unchecked broker execution | Each applicable phase |

0.3 acceptance qualifies context foundations and site-level behavior only. Native
adapter conformance and full account/provider OS isolation cannot be inferred from
site tests, mocks, same-UID processes or successful Debian installation. Existing
I5.6 installed qualification gates and unresolved 0.3 HTTP reliability obligations
remain separate and unchanged.

### Increment 5 backend acceptance evidence

The [alpha.20 action implementation](backoffice-action-framework.md#qualification-and-acceptance)
records the exact mission-to-test mapping and limitations. This supplements the
required matrix above without declaring its future cases complete.

| Acceptance case | Implemented evidence / remaining boundary |
| --- | --- |
| ADM-01 | Partial: installed modular actions, private discovery, direct invocation denial and independent service policy qualified; graphical UI and user-facing transport deferred |
| CTX-05 / CTX-06 | Site backend qualified: BackOffice placement, genuine caller, exact receipt/revision/generation and retired/replaced execution fencing; account/host contexts remain unavailable |
| GAT-02 / GAT-03 | Site actions qualified: independent SEAM, live direct/group/role policy, current session/membership and per-site denial; wider domains deferred |
| STO-02 | Site action boundary qualified on JSON/SQLite: exact required-resource ownership and protected policy during discovery/invocation; stale record writes retain Store conflicts |
| LIF-01 | Existing dependency/retention protections retained; action replacement/removal/reinstall and interrupted local recovery qualified on both providers; wider-domain recovery deferred |

## 13. Implementation phases and release boundaries

### Phase A — Wydgine 0.3 context and storage foundation

Finalize versioned context/placement contracts, validate inherited restrictions,
resolve Client to SUB, require concrete Server placement and freeze trusted
execution bindings. Integrate SEAM/service checks and trusted domain identifiers
without requiring WydHosting. Migrate existing authoring/fixtures/persistence and
qualify site isolation and FrontEnd/BackOffice shared-site behavior. Reserve
HostAdmin without enabling privileged facilities; retain AccountAdmin as proposed.
This is an architecture work sequence, not a new milestone identifier or a claim
that implementation has begun.

### Phase B — 0.3-J Platform/App Administration

Use one reusable BackOffice framework, approved installed-Wydgit contributions,
WydGate controls and independently enforced site management actions. Demonstrate
on disposable Apps; qualify policy, denial, lifecycle and recovery boundaries.
Platform/App administration remains in J; broker separation is designed here,
while privileged managed-hosting actions remain deferred. Do not move J to 0.4
or invent a competing administration product split.

### Phase C — WydHosting 0.4 privileged domains and qualification

Confirm AccountAdmin, implement one designated site/store per customer and trusted
HostAdmin installation. Provide narrow audited provisioning/resource-management
interfaces and protected replacement/disaster recovery. Qualify account/provider
storage, process, credentials, filesystem and network isolation. Retain all six
Decision 0003 work packages and I5.6/I5.7/I5.8 acceptance/evidence obligations; no
admin UI can bypass them. The Debian VM experiment stays deferred to 0.4.

### Later optional client programs

Develop web/native desktop/mobile SUB adapters and portable capability conformance
as separately scoped work. Only then consider explicit platform-specific contexts,
manifest extensions and per-runtime implementation selection. No native API/schema,
mobile runtime, WydOS driver or portability waiver is committed for 0.3 or 0.4 here.

## 14. Open decisions before implementation

1. **AccountAdmin status:** confirm permanent canonical context versus WydHosting
   extension during 0.4 architecture work. Its proposed status does not weaken the
   account-isolation requirement if that environment is implemented.
2. **Schema and syntax:** versioned representation of runat/context, prototype
   restrictions, concrete instance placement, trusted parent/installer metadata
   and mapping from existing package targets/CLIENT authoring. Do not assume new
   envelope or manifest fields are currently accepted.
3. **SEAM identity:** exact domain/site/account/host/lifecycle fields, token branding,
   validation and service-binding changes while preserving current owner tuples,
   scope grammar, limits and installation identity.
4. **Gate policy inputs:** versioned scoped-directory contract, trusted policy
   evaluation, revocation freshness and long-running/background action semantics.
   There is no automatic account federation or SEAM grant derivation.
5. **Provisioning:** guided customer-created versus automatically provisioned
   AccountAdmin, protected designation uniqueness, recovery authority and concrete
   replacement/backup/anti-rollback protocols.
6. **Shared controls:** initial BackOffice library boundaries and contribution
   contract, based on real needs; no WydConsole/WydBackoffice/WydDash product split.
7. **Adapter/deployment qualification:** which JSON/SQLite and future backend
   configurations meet logical and OS isolation requirements, crash guarantees and
   retained-data recovery on each supported deployment.
8. **Migration mechanics:** schema versions, inventory tooling, operator review of
   ambiguous legacy placement, immutable artifact releases, checkpoints and complete
   rollback compatibility. No converter or migration is implemented by this document.
9. **Future clients:** exact optional native contexts/APIs, manifest requirements and
   variants, selection/version negotiation, consent/discovery and cross-adapter
   conformance. Portable camera semantics are an example still to be specified.

## 15. Governing principle

Prototypes define reusable behavior and restrictions. Trusted instance placement
establishes context and domain. WydGate manages membership and application policy;
WydStore isolates data by ownership; SEAM enforces execution authority. WydHosting
provisions and protects future administrative boundaries. A broader administrative
scope never automatically opens another domain's private data.


### Increment 6 browser-facing acceptance evidence

The [alpha.21 HTTP/UI contract](backoffice-http-and-ui.md#qualification-and-remaining-work)
adds the site-scoped browser subset of ADM-01: authenticated shell, authorized
dynamic navigation, bounded closed-contract forms/results, explicit write
confirmation, exact-origin/CSRF checks and real WydGate roster invocation. HTTP
and deterministic DOM tests retain independent Gate/SEAM, site, receipt/generation,
service and stale-reference enforcement. No host-policy/lifecycle authority crosses
HTTP. Full administration, visual browser/accessibility qualification, privileged
review UI, live distributed lifecycle and wider domains remain deferred. Historical
backend-only evidence above is preserved, not a current transport deferral.
