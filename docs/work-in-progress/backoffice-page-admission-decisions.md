# BackOffice B1 — Page admission and action scope decisions

**B2 decision preparation (2026-10-21):** the
[owner decision package](backoffice-b2-decision-package.md#owner-approval-required)
now specifies both recommendations, lifecycle/binding contracts, typed scope rules,
reviewed migration and security proof obligations. **DEC-01 and DEC-02 remain
ARCHITECTURAL APPROVAL REQUIRED.** B2 changes documentation only; the B1 evidence,
requirement classifications and implemented receipt-wide dispatch below are retained.

Recorded 2026-10-21 against `1928baa6ac1f1dd0814e9b581fede2f5cf58c359`,
clean `develop/0.3`, fetched origin, zero divergence. This record preserves the
[matrix IDs](backoffice-conformance-matrix.md). Recommendations below are not
accepted security contracts. B1 changes no schema, authority grant or Page deadline.

## Disposition

| Decision / requirement IDs | Status | Result |
| --- | --- | --- |
| DEC-01: BO-HTTP-09; BO-REU-05; dependent BO-REU-06 | **ARCHITECTURAL APPROVAL REQUIRED** | Existing trusted acquisition and Page execution are reusable; the HTTP Page selection, permission and action-binding contract is missing. |
| DEC-02: BO-ACT-10 | **ARCHITECTURAL APPROVAL REQUIRED** | Required-resource preflight exists; making those resources a maximum dispatch scope changes current behavior. |
| Both: caller preservation, no authority from inheritance/nesting/configuration | **EXISTING CONTRACT — IMPLEMENT** | Already enforced through SEAM, package activation and protected services. Preserve it; do not add delegation. |
| BO-HTTP-02/11: late invalid-session cookie deletion | **CLARIFICATION — SAFE TO IMPLEMENT** | Apply the existing matching-cookie deletion contract at final HTTP Session authorization too, preserving uncertain native outcomes. Implemented by BOB1-01. |
| AccountAdmin, HostAdmin, System/Headless, WydData/CIR runtime | **DEFERRED / OUT OF SCOPE** | No activation or implementation. |

Neither blocked decision is fully resolved by existing contracts. Their established
security prerequisites are resolved; their new composition/authority choices are not.

## DEC-01 — canonical BackOffice Page admission

### Requirements and existing normative authority

Exact IDs: **BO-HTTP-09**, **BO-REU-05**, with **BO-REU-06** dependent.
[HTTP Routes and admission](../backoffice-http-and-ui.md#routes-and-admission)
defines a platform action shell and two APIs, explicitly closes unknown routes and
preserves public Pages/transfers. [Placement Trusted host contract](../backoffice-placement-lifecycle.md#trusted-host-contract)
authorizes exact installed-instance acquisition with separately approved grants,
not browser admission. [SEAM Events and request execution](../seam.md#events-and-request-execution)
requires genuine caller/App/Session and forbids grant union. The
[governing contexts §§4, 7–8](../execution-contexts-and-administrative-domains.md)
require independently authorized concrete execution and reusable administrative
controls but do not specify a Page permission or contribution descriptor.
[Founding §§4–10](../FOUNDING-ARCHITECTURE.md) governs identity, composition and authority.

### Current implementation and complete request trace

| Boundary | Actual trusted source / behavior |
| --- | --- |
| Route / site | `http/routing.js` validates host/proxy/origin and selects canonical App before credentials. `http/transport/hono.js` binds transport and admission. No body/query site selects authority. |
| Administrative route | `http/backoffice.js` recognizes shell/discovery/invoke only. It does not resolve an installed Page. Shell is native web presentation; it has no package principal. |
| Caller | `execution/lifecycle.js` resolves the reserved auth cookie with this site's real Gate. Action factory independently resolves the opaque session; identity is carried unchanged into acquisition. Current policy rereads Gate state. |
| Package / prototype / instance | `packages/index.js` activation validates accepted manifest/resources, provenance, complete inherited tree and Page attachments. One installed package principal per Page; Page wrapper is App-owned. Action owner is an exact managed instance. |
| Placement / domain | Accepted catalog/receipt binds active FrontEnd or BackOffice, exact canonical App and generation. Current administrative domain is the site/App only; no account/provider designation exists. A context label cannot create a domain. |
| Public Page context | `activatePackages().context` issues FrontEnd, exact installed principal/receipt/scopes and Session identity; rejects BackOffice or retired placement. `http/pipeline.js` checks the whole tree before execution, including transfer paths. |
| Administrative acquisition | `acquirePackageExecution` requires native lifecycle/placement authority, exact receipt, generation, App and managed self; checks accepted state, bindings, restrictions and integrity. It does not authenticate an HTTP caller or choose a Page permission. |
| Grants / lifetime | Receipt approvals supply SEAM grants, independently of caller membership/permissions. `guardInstalledExecution` and `seam/context.js` fence recovery barriers, receipt/config/artifact drift, changed generations and retired installations. Derived contexts share the fence. |
| Page / response | `execution/page.js` validates owning App/Session, creates the existing ledger/controller, dispatches bounded lifecycle/semantic workflows, prepares semantic components and renders via the trusted web adapter. `http/response.js` validates and publishes responses; native work settles before drain release. Errors/cancellation/deadlines cannot prove rollback. |
| Action response | The separate HTTP action adapter repeats Session authorization before publication, sanitizes errors and reports rejected/completed/uncertain admission outcomes. It never executes a canonical Page. |

There is a canonical **native acquisition mechanism** and canonical **Page executor**,
but no canonical **HTTP BackOffice Page admission** joining them. Extending those
existing mechanisms is preferable to a second BackOffice execution framework.

### Missing semantics and candidate intersection

Valid installed binding, approved placement, trusted site/domain, authenticated
and authorized caller, live lifecycle/integrity/generation, and applicable SEAM
grants are all established prerequisites for installed administrative operations.
They are necessary checks, but do not decide:

- Which exact Page binding a URL selects, or whether that Page is discoverable.
- What current permission authorizes rendering a Page with several differently
  authorized actions, or with no action at all.
- How an App-owned Page wrapper relates to managed self/receipt identity.
- How a component binds an action reference and how Client/SUB submits an explicit
  intent without creating an administrative context or transferring authority.
- Whether Page execution and contributed action dispatch retain the same initiating
  authority or meet in a separately admitted request under DEC-02.

A literal blanket intersection could incorrectly reject the existing platform
shell (no installed Page/package), neutral Page prototypes (no BackOffice declaration
is required when host placement approves them), and App-owned wrappers (not managed
installation self). Requiring *every* action permission to render would exclude a
member legitimately authorized for one action. Requiring a nonempty SEAM capability
set would exclude a bounded informational Page that needs no protected operation.
The last two are design cases, not newly supported Page contracts. Authentication
alone permits the existing shell, including an empty action list; it does not
currently authorize an arbitrary installed administrative Page.

### Alternatives, recommendation and consequences

| Viable alternative | Security and compatibility implications |
| --- | --- |
| A. Explicit installed administrative Page binding and independently reviewed Page-entry permission; actions remain independently authorized. | Makes entry auditable and exact; avoids all-actions or any-action inference. Requires a versioned declaration/host approval contract, Page-to-managed-owner binding and defined discovery/denial semantics. Keeps existing shell and FrontEnd routes compatible. |
| B. Exact installed Page selection with entry derived from authorized contributed actions, or an explicit authenticated informational-Page mode. | Reuses action discovery, but must specify any/all/actionless rules, prevent content leaks before authorization, and handle revocation of the last eligible action. Coupling Page visibility to action availability is observable and needs approval. |

**Recommendation (pending approval): A**, reusing routing, session resolution,
`acquirePackageExecution`, `executePage`, response publication and the existing
action dispatcher. Define a closed binding to exact Page/owner/installation and
one explicit Page permission. Recheck each action independently. Keep generic
shell admission unchanged. No proposed route spelling or manifest field is accepted
by this recommendation. Before implementation, approve Client/SUB action intent
binding and DEC-02; then qualify real HTTP positive and negative paths on both providers.

FrontEnd must retain its existing routes and cannot choose BackOffice through a
transfer, property or query. Inheritance can specialize a neutral Page; nesting
can compose controls, but neither can replace caller identity or acquire grants.
Future DataTable, DataPager, DetailForm, repeated rows and provider-specific views
can reuse semantic controls with explicit authorized action references. They need
no privileged base class or CIR resolver. A row/template configuration remains data.

### Independently valid B1 fixture and decision status

`BOB1-03` in `test/backoffice-page-foundation.test.js` installs the existing neutral
Taskboard family from actual package resources. The native harness acquires exact
receipt authority and explicitly supplies the App-owned Page root as trusted `self`,
retaining the acquired lifetime, capabilities and resource scopes. This native
`self` makes the App-owned Page root visible, as in the public adapter; it is not
a managed-instance object grant in the receipt. It runs packaged Page.PreRender behavior,
inherited/nested components, typed navigation and repeated rows through `executePage`
and actual HTML response publication in both contexts. Relocation, update and
retirement fence old contexts/generations; public acquisition and copied contexts deny.

This native root adaptation is test harness work, **not a new production admission
API**. There is no independently authenticated Page-entry policy or component/action
bridge. Existing installed HTTP CRUD and denial fixtures remain valid separate
portions; joining them would decide the missing contract. BO-REU-05 advances only
to **Partial**; BO-HTTP-09 remains **Missing**. **ARCHITECTURAL APPROVAL REQUIRED.**

## DEC-02 — action scope and reusable components

### Requirements and existing normative authority

Exact ID: **BO-ACT-10**; independent safeguards BO-ACT-02/03/05/09,
BO-STO-01/02/07/09, BO-CTX-05/08 and BO-PLC-10 remain required.
[Action Descriptor, Registration and Discovery/Invocation](../backoffice-action-framework.md)
says scopes are nonempty subsets of declared logical requirements, preflights those
required resources, and acquires capabilities/concrete scopes from the approved
receipt. [Reviewed policy Three independent contracts](../reviewed-package-policy-reconciliation.md#three-independent-contracts)
distinguishes requirements, host approval and effective execution.
[Store Authority and ownership](../wydstore.md#authority-and-ownership),
[Transactions](../wydstore.md#transactions-and-durability),
[scoped authorization](../backoffice-scoped-policy-and-store-authorization.md#wydstore-policy-stages-de)
and [SEAM caller-bound services](../seam.md#caller-bound-library-services)
require actual-target checks under original caller authority.

### Current authoritative scope dimensions

| Dimension | Authority / descriptive role |
| --- | --- |
| Publisher / package | Trusted manifest/receipt identity and service ownership, not friendly metadata or role grants. Cross-owner Store sharing remains unsupported. |
| Installation | Exact receipt and accepted grants/mappings; mandatory generation and policy/declaration digest in references. |
| Site / domain | Exact canonical App and this site's independent session directory; no broader administrative domain is activated. |
| Caller | Genuine resolved initiating user/session plus current Gate policy; cached identity permissions cannot grant SEAM capabilities. |
| Page | No Page field in administrative references and no implemented Page-to-action binding. Page containment is not action authority. |
| Component instance | Descriptor owner must be a managed instance with exact declared visibility. Reference pins that owner; title/category/nesting do not grant anything. There is no generic component action-reference invocation API yet. |
| Capability / scopes | Capability and logical required subsets must be approved; trusted service preflight covers required resources. Actual dispatch currently retains the full approved receipt capability/scope set. Services independently enforce actual target, operation and policy. |
| Presentation | Title, description, category and package version assist display. Reference comparison also fences version/declaration changes through its digest; display metadata is no bearer capability. |

`packages/backoffice-contract.js` validates requirements; `packages/backoffice.js`
resolves them and preflights discovery/invocation. It binds the full acquired
context to the fixed canonical operation. `libraries/dispatch.js` preserves it;
Store separately authorizes each actual collection and transaction member.

### Direct two-resource evidence and ambiguity

`BOB1-02` installs one package with approved `records` and `archive` resources,
different action permissions and different protected Store permissions on JSON
and SQLite. With archive Store read permission but without archive *action*
permission, archive action discovery is hidden, yet the records action can currently
read archive when given that target. Revoking archive Store permission denies the
same target; records discovery remains available. Revoking the required records
Store permission hides/denies the records action even with archive access retained.

A transaction whose required resource is records can currently include an approved
archive member. Revoked archive write permission denies the entire batch before
any first-member write; restoring that permission admits both members. Forged
site/package/owner references and private/unapproved targets deny. This is direct
characterization of current behavior, **not acceptance of resource attenuation or
of action permissions as per-resource permissions**. These tests deliberately make
the ambiguous behavior reviewable; revise them with the approved DEC-02 contract.

The text establishes required preflight, but does not explicitly establish whether
that subset is also a maximum. Required-resource semantics and maximum-resource
semantics are observably different even when Store's independent protection holds.

### Alternatives, security, compatibility and recommendation

| Viable alternative | Security and compatibility implications |
| --- | --- |
| A. Retain scopes as required preflight resources; full approved package dispatch. | Preserves existing behavior. An action permission cannot be treated as a resource ceiling; weaker action permissions can reach another approved resource if its own Store policy permits it. Document this explicitly and review every action/Store-policy pairing. |
| B. Define scopes as required resources **and maximum dispatch resources**. | Narrows ambient resource reach and makes explicit bindings easier to reason about. Changes existing multi-resource behavior; requires versioned compatibility/review, resource resolution for each opted-in library, transaction envelope/member intersection and retention of the original lifetime/caller. Do not infer capability attenuation or new delegation from this choice. |

**Recommendation (pending approval): B**, with effective resource authority the
intersection of receipt approval, action resource ceiling, original initiating
execution where applicable, and actual service policy. Specify how original Page
execution participates before implementing a Page bridge. Some canonical operations
may legitimately need several approved resources; declare all of them explicitly.
Do not narrow Gate's private implementation storage binding as if it were package
resource authority. Capabilities, operation semantics and reference lifetimes remain
independent. No attenuation implementation is retained in B1.

FrontEnd cannot get a BackOffice context from composition. An authenticated browser
may explicitly submit a separately admitted BackOffice request with its cookie and
CSRF; that does not transfer FrontEnd execution authority or make UI hiding a guard.
An inherited method/nested child retains the initiating context, never another
instance's independently issued binding. Cross-package composition cannot union
Page principals. An authorized capability reference is data, not executable/native
closure authority. A forged or stale reference still undergoes full admission.

The candidate principle — a component can reference/invoke an authorized capability
but cannot create, expand or transfer it through inheritance, nesting or configuration —
is already an **EXISTING CONTRACT** under founding SEAM and caller-bound dispatch.
Its future component action-binding API is not established by that principle.
Shared DataTable/DetailForm components can accept explicit bindings without owning
or minting the action's authority; provider specialization and repeated children
retain the same bounds. Nothing requires WydData/CIR implementation now.

Implementation after approval should reuse acquired guarded contexts and canonical
library scope resolution; preserve original identity, reduce only the approved
resource subset, and qualify both required and actual transaction targets, revoked
policy, independent modules, upgrade/retirement and uncertain publication. A new
privilege-delegation registry or ambient privileged component service is unnecessary.
**ARCHITECTURAL APPROVAL REQUIRED.**

## Other remaining gaps and shortest safe next increment

| Requirement | Independently implementable work / remaining dependency |
| --- | --- |
| BO-HTTP-12 (Partial) | Existing Chrome/Firefox subsets and DOM controls remain. Human assistive-technology and complete native Firefox keyboard qualification cannot be certified by unit counts. No human session was performed in B1. Independent of DEC-02; richer canonical controls also depend on DEC-01. |
| BO-REU-06 (Partial) | Generic shell layout/forms/tables exist; property editing, content editors and dashboards are broader ADM-01 work, not fully specified missing APIs. Canonical administrative composition depends on DEC-01 and explicit binding semantics. Do not invent those features here. |

Approve DEC-01's Page binding/entry policy and DEC-02's resource semantics together,
then implement one HTTP fixture that joins the independently qualified installed
Page and action/Store paths. Test unauthorized entry, actual Page result rendering,
explicit action references, caller preservation, all lifecycle/integrity denials,
concurrency, cancellation and indeterminate writes on both providers. Complete the
human/browser accessibility gaps before claiming full reusable administration.
Generic data-bound runtime implementation is **not ready**; architecture and shared
semantic control design can continue within existing contracts. HTTP-LIMIT remains
OPEN independently of every result recorded here.
