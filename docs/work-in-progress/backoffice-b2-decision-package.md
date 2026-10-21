# BackOffice B2 — Page admission and action resource scope

## OWNER APPROVAL REQUIRED

**Status: PROPOSED — neither DEC-01 nor DEC-02 is APPROVED.** Recorded 2026-10-21
against B1 `6edb1c36e88ed691e3b873f428ca8fddca1acc1b` on `develop/0.3`.
This is a decision package, not a runtime, schema or normative-contract change.
Approval of these decisions authorizes their contracts; implementation and
qualification must still satisfy the sequence and proof obligations below.

### DEC-01: explicit Page entry, shared admission, declarative action bindings

**Recommended option: C, with B's independent Page permission and A's shared
machinery.** The host approves an exact installed Page entry, independently of
BackOffice placement and package resource grants. A caller needs a genuine site
session and the entry's live Gate permission. Wydgine reuses routing, installed
acquisition, guarded contexts, the canonical Page executor and response controls.
A component's named action binding is portable reference data resolved by the
kernel against the installed action registry at invocation; it carries no authority.
Server Page preparation may invoke approved read bindings under its existing
caller and reduced scope. Browser actions are separately admitted explicit intents.
Neither path borrows authority from a parent, prototype or component.

**Principal tradeoff:** one explicit Page-entry approval and a bounded binding
contract add review work, but avoid deriving entry permission from any/all actions
or granting administrative authority through composition. Initial Page bindings
are restricted to the same installation; cross-package Page aggregation is deferred.

**Compatibility:** existing shell, action endpoints and FrontEnd Page contracts
remain separate. No existing BackOffice placement automatically becomes an HTTP
Page. Existing App-owned wrappers can be explicitly bound without becoming managed
package objects. New Page entries require DEC-02's strict action semantics.

**Exact approval wording:**

> I approve DEC-01 as proposed in the BackOffice B2 decision package: explicit
> host-approved installed Page entry with an independent live Page permission,
> shared trusted admission and Page execution, and declarative same-installation
> action bindings reauthorized at invocation. Pages compose behavior; protected
> service operations use approved action bindings. Inheritance and nesting grant
> no authority. Cross-package Page bindings remain deferred.

### DEC-02: declared maxima, reviewed through existing package policy

**Recommended option: B plus a bounded form of C.** An action's existing declared
resources remain required preflight resources and become its maximum resource
scope. Resolve them with trusted mappings, intersect them with the receipt's
approved concrete resources and any genuine initiating server context, then apply
operation capabilities, ownership and current action/service policy independently.
Review the derived per-action scope in the existing package-policy/upgrade plan;
do not introduce a second independently mutable approval registry. Gate permissions
are predicates, not an invented set of direct Store grants for every user.

**Principal tradeoff:** least privilege becomes auditable per action, but a package
that relied on undeclared resources must declare all intended resources and obtain
review. Existing conservative required-resource preflight can make a multi-resource
action unavailable when any declared resource is unavailable to that caller.

**Compatibility:** current receipt-wide dispatch changes only after explicit
migration. Before a runtime enforcing this contract starts an App with active
BackOffice actions, require a stopped-App reviewed adoption/upgrade for every such
installation. A read-only preflight reports blockers first. Preserve the old runtime
and accepted state until migration succeeds. No automatic adoption, edited historical
receipts, silent clipping or legacy execution bypass is proposed.

**Exact approval wording:**

> I approve DEC-02 as proposed in the BackOffice B2 decision package: declared
> action resources are required preflight resources and restrictive maxima, bounded
> by approved receipt scope, any initiating server authority, exact ownership,
> operation capabilities and live Gate/service policy. Review effective per-action
> scopes through existing package policy. Require explicit reviewed migration of
> active legacy BackOffice actions before the enforcing runtime admits the App;
> provide no receipt-wide compatibility bypass.

**Owner choices:** approve each wording independently, or request a named change.
The deliberate choices include same-installation Page bindings, no Page-lifecycle
writes, conservative all-declared-resource preflight, and migration as an App startup
prerequisite. There is no hidden request to approve a new context, WydData, CIR,
a package schema spelling, release date, version bump or HTTP-limit waiver.

## Baseline, evidence and limits

Initial tree was clean; branch and HEAD matched the requested baseline. Fetch of
origin completed with **0 ahead / 0 behind**. B1's runtime diff, fixtures and reports
were reviewed. Its only production correction was final invalid-Session cookie
deletion; its two-resource and native Page fixtures characterize the unresolved
contracts. B2 preserves those results and changes documentation only.

| B1 inventory | Count retained by B2 |
| --- | ---: |
| In-scope requirements | 64 |
| Implemented and verified | 59 |
| Partial | 4 |
| Missing | 1 |
| Unverified | 0 |
| Deferred, proposed or reserved | 12 |
| Decisions awaiting approval | 2 |

The [conformance matrix](backoffice-conformance-matrix.md),
[B1 decision record](backoffice-page-admission-decisions.md) and
[implementation report](backoffice-foundation-implementation.md#b1-implementation-and-disposition)
remain evidence, not acceptance of the proposals here. BO-HTTP-09 is Missing;
BO-ACT-10, BO-REU-05, BO-REU-06 and BO-HTTP-12 remain Partial.
No classification is promoted by this document or by approval alone.

Governing sources reviewed: [development rules](../DEVELOPMENT.md),
[founding architecture](../FOUNDING-ARCHITECTURE.md),
[execution domains](../execution-contexts-and-administrative-domains.md),
[implemented context foundation](../execution-context-foundation.md),
[placement/lifetime](../backoffice-placement-lifecycle.md),
[site/Store policy](../backoffice-scoped-policy-and-store-authorization.md),
[reviewed policy](../reviewed-package-policy-reconciliation.md),
[action framework](../backoffice-action-framework.md),
[HTTP/UI](../backoffice-http-and-ui.md), [package lifecycle](../package-lifecycle.md),
[SEAM](../seam.md), [WydStore](../wydstore.md),
[WydData design](../architecture/wyddata.md),
[current release scope](../milestones/0.3-release-status.md) and
[open reliability issue](../milestones/0.3-reliability.md).
Implementation facts below come from repository code/tests, not assumed future APIs.
No external installations or production receipts were inspected.

### Actual code and tests

Paths in this table are repository links; engine implementation lives under
`packages/wydgine/src/engine`, even where tests use compatibility exports.

| Evidence | Finding |
| --- | --- |
| [routing](../../packages/wydgine/src/engine/http/routing.js), [Hono transport](../../packages/wydgine/src/engine/http/transport/hono.js), [pipeline](../../packages/wydgine/src/engine/http/pipeline.js) | Canonical App routing precedes credentials; public Page acquisition excludes BackOffice, including transfers. |
| [HTTP BackOffice](../../packages/wydgine/src/engine/http/backoffice.js) | Shell, action discovery and action invocation only; unknown paths close. Native acquisition authority never becomes the action caller. |
| [packages](../../packages/wydgine/src/engine/packages/index.js), [installed state](../../packages/wydgine/src/engine/packages/state.js) | Managed-self acquisition, exact receipt/generation, one package principal per Page, App-owned wrapper, accepted artifacts/mappings and recovery guards. |
| [action declarations](../../packages/wydgine/src/engine/packages/backoffice-contract.js), [action runtime](../../packages/wydgine/src/engine/packages/backoffice.js) | Closed declarations, fixed service binding, live required-resource preflight, full receipt scope at dispatch; references are stale-check data. |
| [context](../../packages/wydgine/src/engine/seam/context.js), [library registry](../../packages/wydgine/src/engine/libraries/index.js), [dispatch](../../packages/wydgine/src/engine/libraries/dispatch.js) | Branded immutable authority/lifetime; caller-bound dispatch; trusted library resource resolution and independent live policy. |
| [Page](../../packages/wydgine/src/engine/execution/page.js), [Session](../../packages/wydgine/src/engine/execution/lifecycle.js), [response](../../packages/wydgine/src/engine/http/response.js) | App/Session matching, bounded canonical lifecycle/components, protected service facades and response publication. Existing Page service access is not the proposed action-binding facade. |
| [Store core](../../packages/wydstore/src/core.js), [authorization](../../packages/wydstore/src/authorization.js) | Exact ownership/resource/capability checks; transaction envelope and every member checked before provider execution; structural caches confer no allow decision. |
| [BOB1-02](../../test/backoffice-action-scope.test.js) | Two approved same-package resources on JSON/SQLite demonstrate receipt-wide access and separate actual-target policy. |
| [BOB1-03](../../test/backoffice-page-foundation.test.js) | Installed Taskboard Page renders in both contexts through an explicitly trusted native root adaptation; no HTTP Page permission or action bridge. |
| [actions](../../test/backoffice-actions.test.js), [HTTP](../../test/backoffice-http.test.js), [placement](../../test/backoffice-placement.test.js), [modules](../../test/backoffice-modules.test.js) | Real installed dispatch, stale/forged references, live policy, provider CRUD, independent packages, lifecycle and integrity denials. |

## DEC-01 — installed Page admission

### Exact problem and existing behavior

Trusted acquisition and canonical execution exist independently. No accepted contract
joins a browser request to a specific installed administrative Page and its entry
permission, or joins that Page's components to independently authorized actions.
Authentication sufficient for the native shell is not permission to render arbitrary
package content. Action discovery must not define Page-entry permission implicitly.

The concepts stay independent:

| Concept | Meaning; no implied grant |
| --- | --- |
| Authentication | This site's real Gate resolves an opaque credential into the genuine current user/session. |
| Caller authorization | Current Gate membership and exact required permission; roles alone do not suffice. |
| Placement | Native approval of this installation's active Server/BackOffice placement. |
| Installation validity | Accepted artifact/resource integrity, owner/receipt/generation, mappings and recovery state. |
| Resource scope | Independently host-approved concrete service targets; DEC-02 further bounds actions. |
| Execution context | Branded immutable caller binding with independent grants, limits and shared lifetime fence. |
| Administrative domain | Canonical site/App selected by trusted routing. BackOffice does not create an account/provider domain. |
| Page-entry grant | Proposed exact host-approved publication binding; separate from placement, caller permission and SEAM capabilities. |

### Alternatives

A/B/C here use the assignment's labels. B1's alternative A corresponds most closely
to C below; B1's action-derived alternative B is assessed as D.

| Dimension | A: extend action-oriented admission | B: dedicated Page operation | C: explicit installed entry, shared machinery | D: any/all-action-derived entry |
| --- | --- | --- | --- | --- |
| Authority | Reuses exact action checks, but needs a new rule for Pages with zero/many actions. A synthetic action risks conflating render and service authority. | Clean independent permission, but a separate authority engine would duplicate guards. | Exact entry approval plus independent permission; shared lower guards, no synthetic service capability. | Page visibility coupled to action grants; cannot safely infer content authority. |
| Package/host approval | Must define how an action authorizes the whole Page. | New Page contract and approval. | Versioned entry requirement plus exact native approval; existing package grants remain separate. | Host still needs a publication binding; action declarations alone cannot publish a Page. |
| Caller | Any/all/selected action policy must be chosen. | Explicit entry permission. | Explicit entry permission; no nonempty capability requirement for informational Pages. | Any leaks content to partial users; all excludes legitimate partial users; actionless mode is another rule. |
| Domain | Safe only with existing exact-App resolution. | Must duplicate or reuse exact-App resolver. | Existing App resolver and site directory; wider contexts reject. | Same underlying requirements; revoking last action changes Page availability unexpectedly. |
| Compatibility/migration | No Page contract exists to preserve; must avoid altering shell policy. | Opt-in new Page publication; existing shell distinct. | Opt-in exact publication; no implicit adoption of old placements/wrappers. | New semantics and navigation coupling; no repository promise requires it. |
| Components/inheritance | Action metadata alone does not define component bindings. | Independent binding model still needed. | Neutral prototypes and named bindings; full-tree restrictions; no inherited authority. | Component/action availability can alter unrelated Page admission. |
| Revocation/lifecycle | Existing machinery reusable, with explicit Page checks added. | Safe if it shares generation, receipt and current policy guards. | Same guards plus entry/binding revision and final permission checks. | Also needs recomputation of any/all action eligibility at every entry. |
| HTTP | Extends trusted adapter; render is not fixed-service invocation. | New route/operation; parallel transport is unnecessary. | Closed Page route/intent variants within current adapter. | Discovery and content visibility become interdependent. |
| Tests/maintenance | Initially small, grows special cases for Page lifecycle. | Highest duplication risk if built as an independent framework. | Small semantic addition; reuse existing tests and native executor. | Most policy combinations, metadata disclosure and actionless cases. |

**Recommendation:** C with an independent Page permission (B's useful semantic
separation), implemented by extending A's trusted adapter. Reject a parallel
security framework and any/all-derived entry. Revocation of an action need not
revoke an informational Page; Page permission revocation always denies that Page.

### Proposed exact entry and grant contract

These are **semantic records, not implemented JSON fields or schema versions**.
The implementation must encode them in a versioned closed contract with unknown-field
rejection and an engine minimum that older engines cannot ignore.

An entry has: a site-unique bounded local entry key; exact canonical App, package
and installation receipt; one exact managed owner; one exact App-owned Page root;
accepted attachment/footprint evidence; live placement generation; one required
Gate Page permission; exact accepted declaration and approved policy/binding digest;
and a finite map of named action bindings. The entry key is a lookup label, never
a principal. Require the existing lowercase local action-name grammar, at most
32 entries per installation and 256 per site; at most 32 named bindings per entry.
Apply existing package state/JSON ceilings too; these new proposed maxima cannot
raise them. Permission uses the existing exact permission grammar, no wildcard.

A versioned immutable package contribution requests the owner and Page attachment
role, permission and binding requirements. The native host resolves the actual
App-owned Page and approves the exact entry record at install or stopped-App policy
review. An existing package can instead receive a host-authored exact entry proposal
validated against its accepted resources/footprint, without modifying those bytes.
In either case, only the native reviewer can publish approval. Package declarations,
Page properties, URL slugs, config values and Gate assignments cannot approve it.
An entry with zero bindings is valid. An entry with no permission is invalid.

Required approvals/checks are conjunctive:

1. Existing native installation/placement authority approves exact active BackOffice
   placement. Policy changes use existing lifecycle/policy authority; placement
   changes still need placement authority. A package cannot supply either.
2. Existing host policy approves package capabilities, object grants, concrete
   mappings and the additional exact Page-entry/binding evidence. Page publication
   is not a new implicit SEAM capability. No duplicate action grant is minted.
3. The caller has a genuine live site session, active membership and the Page's
   exact current permission. No owner/administrator label substitutes for it.
4. Every action independently satisfies DEC-02 and its current action/service rules.
   Page entry never requires all bound actions to be authorized for the caller.

App-owned Page adaptation must follow BOB1-03: acquire using the exact managed owner,
then derive a guarded Page-root binding in trusted code, preserving package,
installation, identity, limits, grants and the opaque lifetime fence. Only this
exact wrapper becomes `self` (and thus self-visible); it receives no edit grant.
Do not put the wrapper in managed receipt visibility or give visibility to the
whole App. Validate the entire Page subtree and its single package principal.
Public/neutral prototype definitions may be reused; a separately installed
package's executable principal may not be merged into the Page.

### Request/admission lifecycle: existing checks and required additions

Order below is the proposed complete path; an implementation may reject earlier
when doing so reveals no protected content and preserves all dependencies.

| Step | Existing trusted boundary and check | Missing Page-specific addition |
| --- | --- | --- |
| 1. HTTP admission | Native host quotas/drain, Hono header/body/response bounds; real request cancellation. | Route Page work through these same leases/meters. |
| 2. Site/route | Routing validates Host/proxy/effective origin, selects canonical App before cookies. | Proposed `GET /backoffice/pages/<entry-key>`; exact one-segment key, no query selector. GET only; HEAD/POST return 405 and execute no lifecycle/action. Unknown key returns 404 after authentication. |
| 3. Installed package | Catalog and activated mappings identify accepted package, not request metadata. | Resolve entry only in this App's approved entries. No package/path/service selector in request. |
| 4. Prototype/instance | Activation validates managed instances, provenance, attachments and inherited full-tree restrictions. | Check exact entry owner/Page pair and one principal; explicit wrapper adaptation above. |
| 5. Placement | Native active BackOffice placement and exact App/generation already required. | Require that placement for the whole selected Page; public route/transfer cannot choose it. |
| 6. Authentication | Same reserved cookie, site Gate and Session resolver; foreign/revoked/expired sessions deny. | Reuse it; no anonymous Page mode or credentials in Page references. |
| 7. Caller authorization | Existing private live Gate evaluator verifies current site membership/permission. | Evaluate exact entry permission before Page lifecycle, preparation or content disclosure. |
| 8. Domain | Canonical App/site and independent site directory already available. | Require exact equality throughout entry, Page, action and Session. AccountAdmin/HostAdmin remain unavailable. |
| 9. Integrity/generation | Accepted resources/receipts/config, mappings, generation, symlinks and recovery barriers already validated. | Bind entry/config revision into guard/reference checks; changed entry requires fresh generation and registry. |
| 10. Context | Existing host-only acquisition, context branding and derivations preserve caller and receipt. | Construct Page wrapper and composition-only facade as specified below; never use native operator grants. |
| 11. Page execution | Existing executor checks App/Session, bounds lifecycle/components, repetition and cleanup. | Supply exact BackOffice binding and named read-action facade; shared Page ledger. |
| 12. Binding/invocation | Installed fixed action registry, stale references and caller/service authorization exist. | Named Page bindings and explicit browser intent variant below; DEC-02 attenuation. |
| 13. Response | Trusted rendering/response validation and native quotas exist; action HTTP reauthorizes before publication. | Recheck Session, Page permission, installation/entry guard before any success bytes; no-store, existing CSP and same-origin resource policy. Use same-origin referrer policy on successful documents for Firefox; no-referrer on errors/APIs. |
| 14. End/fences | Existing derived lifetime, cancellation/deadline, drain and retired/replaced/revoked checks. | Apply same guard to Page bindings/preparation and retained callbacks; do not detach admitted native work or extend the 1,000 ms Page limit. |

Protected Page navigation must reject supplied foreign Origin and cross-site/same-site
Fetch Metadata, as the existing APIs do. Exact site cookies still authenticate.
Navigation with absent Origin/Fetch Metadata can be admitted under the trusted route
and cookie rules; it supplies no mutation intent. POST action intents require exact
Origin, existing session/App-scoped CSRF and closed bounded JSON. No wildcard CORS,
redirect credential forwarding or public transfer path is added.

The first increment needs no new Page-list endpoint. A trusted navigation adapter
may expose an entry only after the same entry authentication/permission checks;
its links grant nothing. Existing action discovery remains action discovery and
cannot be used to infer Page permission or disclose unavailable Page metadata.

### Page execution versus action authority

For this new Page entry, ordinary protected provider dispatch is available only
through its approved named action bindings. Adapt the existing Page/presentation
service facade in trusted code; do not add a context type or expose native registries.
Direct `SERVICES.Invoke`/`Call`, configured presentation service calls and alternate
legacy service paths must not bypass this rule on an admitted BackOffice Page.
FrontEnd and existing non-Page action contracts retain their own boundaries.
Local semantic composition/methods/forms still use their approved object grants.

Page lifecycle and preparation may explicitly request **read-effect** bindings;
all must be installed fixed trusted operations classified as read. Rendering,
preparation, GET, cleanup and repeated row creation may never invoke write actions.
No implicit provider calls per row or mutation disguised as read is permitted.
Reuse existing trusted read classification/admission; a library opting in bears
responsibility for its semantics. An unavailable read produces safe component state
or a whole-Page failure according to its declared required/optional presentation
contract; neither permits disclosing denied action metadata/results.

A server-side read binding preserves the Page's initiating branded context and
caller, shares its ledger/deadline/cancellation/lifetime, and only attenuates resources
under DEC-02. It cannot freshly acquire the callee's stronger independent context.
A browser click runs in Client/SUB and submits explicit intent to a separately
admitted server request. Its context is freshly acquired from the exact action's
approved installation with the genuine current session, never from client-supplied
capabilities or the last Page request's expired authority. This is the existing
HTTP action admission pattern, not nested privilege delegation.

### Action binding model and lifecycle

**A binding is a declarative request to resolve an approved operation at invocation.**
It is not a capability grant, executable closure, authority-bearing handle or proof
that the current user may invoke it. A full action reference remains the existing
exact App/package/receipt/owner/action/generation/revision tuple; it is not refreshed
on invoke. Distinguish a declarative local action name from its resolved reference.

| Candidate | Disposition |
| --- | --- |
| Explicit canonical `package#instance/action` ID | Useful for authoring/diagnostics, insufficient alone at invocation because it omits receipt/generation/revision. |
| Installation-local owner/action reference | Preferred package authoring target; host resolves exact installation and approved registry. Never search another installation on failure. |
| Page-declared named bindings | Recommended finite allowlist connecting semantic control intent to exact local action targets/contracts. |
| Package-approved registry | Reuse existing catalog-derived immutable registry; no second mutable action registry or callbacks. |
| Per-instance configuration | May select among declared allowed local targets through reviewed stopped-App binding configuration. Cannot add a target/service, relax a contract, or supply principal. |
| Nested controls | Receive binding name/reference as typed data. Invocation resolves the approved Page binding; parent services/contexts never cross as values. |
| Inherited bindings | Base defines typed binding slots/constraints; overrides may narrow. Concrete target and configuration require review at the installed Page. Inheritance cannot approve a new target or weaken read/write/input restrictions. |

Proposed stages (wire spelling remains to be versioned before implementation):

1. **Install/update:** validate declaration bounds, owner/Page attachment and binding
   slot contracts; resolve all configured targets against this installation's
   accepted action declarations. Reject missing targets, incompatible input/output,
   wrong effect/API, cycles/ambiguous inherited overrides, foreign installation or
   Page principal. No live caller is implied by installation success.
2. **Binding/configuration:** validate closed typed configuration, literal/default
   input against the target contract, and finite allowed targets. Review the exact
   target/configuration digest through package policy. Binding changes renew lifetime
   generation; accepted authored data is not silently overwritten by package update.
   Optional unconfigured slots are allowed only when declared optional and render
   unavailable; a configured dangling target fails planning.
3. **Page admission/preparation:** revalidate approved entry/binding digest and
   placement; authorize entry first. Resolve configured targets to exact references;
   filter unavailable action descriptors. Do not fail an informational Page merely
   because the caller lacks a bound action permission. Validate dynamic local values
   before a preparation call. Templates pass typed values, not executable resolvers.
4. **Browser intent:** extend the trusted invocation adapter with a mutually
   exclusive closed envelope: existing `{reference,input,confirmed?}` or proposed
   `{pageBinding,input,confirmed?}`. `pageBinding` pins entry identity/revision,
   binding name and exact action reference. Reject mixing variants. These names are
   illustrative, not currently accepted fields. The adapter re-resolves the approved
   entry, rechecks entry permission and exact binding/action reference, then invokes
   the existing action boundary. Existing raw action requests still require their
   own action/service authority; Page entry is not a universal action permission.
5. **Invocation:** input/default merge uses only declared fields; reject attempts to
   override fixed configuration, unknown fields, invalid parameters and conflicting
   values. Dynamic row/record IDs are untrusted input with ordinary target/revision
   checks. A repeated component cannot use a record key as an authority assertion.
   Required write confirmation remains explicit per attempt. Reauthorize action,
   DEC-02 scope, actual service targets and current caller; never trust prior discovery.
6. **Completion:** recheck lifetime/current action policy and Session; Page-associated
   intents also recheck Page entry/binding and permission before successful publication.
   Preserve the existing rejected/completed/uncertain action outcome contract, including
   committed-but-indeterminate results and no automatic retry.

The Page key and binding name already select the reviewed target. A browser-supplied
component instance ID is not proof that a real component sent a request and is not
needed for authorization. At composition time the kernel validates the receiving
component/template's typed slot in the admitted Page subtree. At invocation it checks
the exact approved binding. Runtime row identity may supply diagnostic/presentation
correlation only; it grants no additional action or record permission.

| Identity | Authorization participation |
| --- | --- |
| Caller | Genuine initiating session/user/membership, checked live for Page, action and any protected Store operation. |
| Site/App | Trusted route/domain; exact equality across Session, Page entry, receipt, reference, service scope and Store owner. |
| Package/publisher | Accepted Page/action principal and resource owner; not derived from prototype labels or request data. |
| Installation | Exact receipt, generation, approval/declaration/config revision and lifecycle; no name-based rebinding. |
| Page | Approved publication and entry permission plus finite binding allowlist; no universal action authority. |
| Component | Declared typed binding consumer and visible subtree member at composition; no separate administrative principal/grant. |
| Action | Exact managed owner/local ID, fixed service/API/effect, independent permission and DEC-02 required/maximum scopes. |

### Binding failures and HTTP denial contract

Proposed Page failures use safe structured codes (`PAGE.DENIED`, `PAGE.STALE`,
`PAGE.INVALID_REQUEST` are illustrative new names requiring closed schema definition).
Existing action codes/statuses remain authoritative where applicable.

| Condition | Install/binding | Live invocation/publication |
| --- | --- | --- |
| Missing action/invalid contract | Reject configured binding/plan; optional unconfigured slot can remain unavailable. | 409 stale reference; no fallback/search/automatic refresh. |
| Caller lacks Page permission | No caller authorization inferred at install. | 403 generic denial before Page code/content; Page-associated intent denies too. |
| Caller lacks action/Store permission | Does not make the package invalid. | Hide unavailable descriptors; 403 denial on explicit invocation. |
| Retired/removed/relocated installation | Entry becomes unavailable; retained data is not authority. | Deny; stale known references 409; unknown navigation key 404. |
| Upgraded/same-context replacement | Validate current configured bindings; reject incompatible target, never overwrite customization. | Old reference 409; explicit reload/discovery obtains new reference. Never replay mutation. |
| Revoked host grant/Page entry | Reviewed narrowing/removal fences generation and rebuilds registry. | Generic denial/stale as appropriate; no fresh context may revive old approval. |
| Other site/package/receipt target | Reject exact binding resolution. | Stale/denied without foreign metadata or provider entry; cross-package Page binding unsupported. |
| Invalid dynamic input/default override | Static literals reject planning; runtime input checked afresh. | 400 invalid input/request, no service handler. |
| Session invalid at any check | Not a package validation concern. | 401 and matching auth-cookie deletion, including late invalidation. Transient resolver failure is 503 and preserves cookie. |
| Integrity/barrier/unavailable policy | Reject activation/acquisition. | Sanitized unavailable/denial, never content/native details or permissive fallback. |
| Deadline/cancel/output failure after admission | No rollback inference. | Existing 503 or disconnect; admitted action outcome uncertain. Await settlement through drain. |

Unauthenticated protected Page requests receive 401 before entry-specific metadata.
An authenticated unknown entry returns 404; a known but unauthorized entry returns
403 generic text without its title, package, actions or denial details. This chooses
consistency with the existing action-denial surface over concealing key existence.
No redirect login loop, cacheable private Page, partially streamed protected success
before final authorization, or side-effecting HEAD is proposed. The public adapter
continues rejecting BackOffice Pages/transfers independently of this route.

### Implementation impact and compatibility

Add semantic entry validation and approved policy evidence to the existing package
planning/acceptance path, exact Page-root admission to the trusted HTTP adapter,
and typed binding consumption in the Page/presentation facade. Reuse Session,
`acquirePackageExecution`, lifetime derivation, `executePage`, fixed action invocation
and response publication. Shared lower-level functions should remove duplicated
checks; do not copy the dispatcher or grant engine into a Page subsystem.

No existing package declares an approved Page entry. The native shell remains valid
with zero actions and has no installed package principal. BOB1-03 is a useful native
fixture, not permission to publish Taskboard. Neutral App-owned wrappers remain
reusable; no privileged component superclass is required. Existing FrontEnd events,
actions and transfers do not become administrative bindings. New administrative
Pages deliberately use composition-only protected service access, a new opt-in
contract rather than a retroactive restriction on public Pages.

## DEC-02 — action resource scope

### Exact problem and existing behavior

An action currently declares nonempty required resources, preflights them, then
receives the complete approved installation context for dispatch. Required resources
are not enforced as a maximum. This matters when multiple resources share a package
and one action permission is weaker than another. Existing actual-target SEAM,
ownership and Store policy still protect those resources; B1 did not demonstrate
a cross-owner bypass.

BOB1-02 uses `divdev/backoffice-members` modified in a disposable installation:
`get` declares `records`; `archive-get` declares `archive` and requires
`archive.action.read`. With `archive.records.read` but without `archive.action.read`,
`get` can currently read archive. Removing the Store permission denies that target.
A transaction declaring only records can currently mutate approved archive too
when every actual member's Store policy permits it. This is direct behavior to
change after approval, not evidence that policy checks are missing.

### Alternatives

| Dimension | A: receipt-wide | B: declaration maximum | C: separate per-action approval |
| --- | --- | --- | --- |
| Least privilege | Package ceiling only; undeclared approved targets remain reachable. | Exact declared resource ceiling plus receipt/caller/service checks. | Can narrow further than declaration if separately configured. |
| Compatibility/upgrades | Preserves B1 behavior; every action/Store-policy pairing needs review. | B1 two-resource characterization changes; explicit migration and expansion review needed. | New receipt approval dimension and migration; stale reference/review semantics required. |
| Declaration vs approval | Already independent, but action declaration conveys only preflight. | Declaration requests max; receipt approves resources; review displays derived action result. | Strong explicit separation, but a second editable scope map can drift/duplicate receipt approval. |
| Multi-resource/transactions | Any receipt resource, including undeclared members, subject to service rules. | Declare every resource; envelope/member checks all fit the maximum. | Can approve subsets, but partial approvals must not pretend required-resource preflight succeeds. |
| Ownership/SEAM/Store | Exact owner/capability/service checks still mandatory. | Same checks with smaller concrete scopes; no new sharing. | Same checks; approval never replaces ownership. |
| Caller-specific grants | Existing action and actual-target Gate predicates. | Same live predicates; no new direct per-user Store-scope language. | Same; independent action scope approval must not be mistaken for caller permission. |
| Receipt reconciliation/revocation | Existing whole-receipt policy workflow. | Reuse it, add action expansion evidence/digest and invalidate generations. | Independent table adds coordination/audit/rollback complexity if separately mutable. |
| JSON/SQLite | Existing common authorization and differing durability. | Provider-neutral attenuation before both adapters. | Same if implemented above provider layer. |
| Ergonomics/maintainability | Easiest initially, difficult local reasoning about action reach. | Small authoring model: list all resources; conservative preflight may hide broad actions. | More configuration and potential approval matrices. |
| Future providers | Ambient package reach remains hard to explain. | Trusted provider resolver maps finite resource maxima; unsupported resolution rejects. | Useful only if narrower per-action independent approvals prove necessary later. |

**Recommendation: B with C's explicit review, without C's second scope table.**
The existing reviewed policy plan approves the exact declarations and derived
maximum for every action, together with receipt scope. It may withhold an entire
action by leaving its requirements unapproved. It does not maintain a separately
editable per-action resource subset. To narrow an action, publish/review a narrower
declaration (or remove approval for a resource, making its required preflight fail).
No custom predicate DSL, delegation registry or action-specific credentials.

### Formal effective-scope rule

The candidate `receipt ∩ declaration ∩ caller grants` is valid only as a shorthand
for the following typed rules. The current representations are not three identical
sets. In particular, permission strings never resolve into Store collection grants.

Let `I` be the exact accepted installation and generation in trusted App `S`, `a`
the exact fixed action, `u` the genuine initiating identity, `t` the current check,
and `l` a canonical library. Define:

| Term | Type and authority |
| --- | --- |
| `R_I,l` | Finite concrete resource set independently approved in the receipt and validated against accepted mappings/configuration. For Store, exact `{store, collection}` pairs under the separately checked owner tuple; for Gate, exact canonical App IDs. |
| `D_a,l` | Finite logical resource names in the immutable accepted action declaration; requirements/maxima, never grants. Store names resolve using this installation's accepted `storageMappings`; other opted-in libraries use their trusted package scope resolver. |
| `M_I,a,l = resolve_I,l(D_a,l)` | Concrete declared maximum. Deterministic against accepted configuration, exact owner/domain, no request-selected provider/path. Unknown/ambiguous/nonfinite resolution rejects. |
| `Q_l` | Concrete scope of the original branded initiating server context for an in-process Page call; must match site/package/installation and be live. For separately admitted HTTP action invocation, there is no Page authority to inherit; omit this restriction rather than inventing a client Store grant. |
| `C_I` | Receipt-approved exact SEAM capabilities, independent of resource sets and Gate permissions. An in-process invocation also requires applicable original-context capabilities. |
| `P_action(u,a,t)` | Live current-site authenticated membership and action permission predicate, evaluated through existing Gate policy. A Page-associated call additionally needs `P_page(u,entry,t)`. |
| `P_service(u,op,r,t)` | Current trusted operation policy for actual resource `r` under original caller. Protected Store rules may require a different Gate permission; explicit public rules require no membership permission, while scope/capability/owner still apply. An unprotected Store retains its existing capability/owner/scope contract. |
| `O(I,r)` | Exact App/publisher/package/principal and any configured installation ownership predicate. No assumed cross-owner sharing or retrofitted installation ownership. |
| `Live(I,t)` | Accepted artifacts/receipt/policy/config and generation, active placement, no recovery barrier, live Session/context, request budget/cancellation. |

For each library, construct a trusted derived context with:

```text
E_a,l = R_I,l ∩ M_I,a,l                    (separate HTTP admission)
E_a,l = R_I,l ∩ M_I,a,l ∩ Q_l              (in-process server invocation)
```

For libraries absent from `a.scopes`, the package-visible **resource scope is empty**;
never spread their full receipt scopes back into the derived context. Preserve
independent non-resource grants (for example object visibility and prototype scopes)
without treating them as service resource authority. Keep receipt capabilities
and any original-context capability intersection; do not collapse them to just
`a.capability`, because transaction members can legitimately require additional
receipt-approved create/read/delete capabilities. Only the installed fixed operation
is callable through the action; a broader capability set does not select another
operation. Limits only reduce, and the opaque original lifetime must be shared.
A trusted attenuation primitive must not accept portable contexts or manufacture
new host authority. Scope reduction is not a new execution environment.

Before discovery/invocation require **all declared required resources**, not merely
an overlapping subset:

```text
for every declared library l:
    D_a,l ⊆ approved logical requirements_I,l
    M_I,a,l ⊆ R_I,l
    if in-process: M_I,a,l ⊆ Q_l
    trusted required_resource_preflight(l, a, M_I,a,l, u) succeeds
```

The existing administrative callback preflights the action's fixed operation on its
service library's declared resources. Additional library scopes, if present, require
an opted-in trusted required-resource validator; reject activation when one is
unavailable. No general claim that an unrelated library's resource names are Store
pairs is valid. Private implementation dependencies are handled separately below.

Authorize an actual service operation/transaction member only when:

```text
ALLOW(a, op, r, u, t) =
    approved_action_contract(I, a) ∧ Live(I,t) ∧ P_action(u,a,t)
    ∧ (P_page(u,entry,t) when Page-associated)
    ∧ fixed_operation_allows(a, op)
    ∧ required_capability(op) ∈ C_I
    ∧ (required_capability(op) ∈ C_original when in-process)
    ∧ r ∈ E_a,library(op) ∧ O(I,r) ∧ P_service(u,op,r,t)
```

`fixed_operation_allows` means exactly the declared fixed operation, except that
Store transaction admits only its documented finite member-operation list, with
its own per-member checks. `effect:write` and confirmation do not grant every write
operation. Gate roster restrictions, declared API version, closed input/output,
provider availability, revision rules and budgets remain additional prerequisites.
Actions are not custom workflows or arbitrary service dispatch.

Thus the caller term is a family of live predicates, not a new user resource set.
A user can need `content.action.read` to invoke `get` and separately
`archive.records.read` for an archive Store target; they do not need a personal
SEAM `{store,collection}` grant. Scope is the package execution's approved authority.
When Store has no policy, do not manufacture an extra per-user Store permission.
The action permission still applies. Current revocation is checked at the next
protected boundary; it cannot erase previously disclosed values or atomically undo
work already admitted before revocation.

Gate's private `library:wydgate` directory binding remains private implementation
authority, not a package Store scope to intersect away or copy into `E`. Calling an
approved Gate action still rechecks its original caller/site policy. A new library
cannot use private dependency authority as an unrestricted substitute for declared
package resources; its opt-in operation and resolver need their own trusted review.

### Operation, absent/empty and wildcard rules

| Case | Proposed result |
| --- | --- |
| No `backofficeActions` | Valid package with zero contributed actions; no action authority. |
| Action missing `scopes` | Invalid declaration, as today; never means full receipt. |
| `scopes:{}`, empty provider array, missing service-library key | Invalid action, as today; never means unrestricted or optional. |
| Required resource declared but not approved | Action unavailable in discovery and denied on invocation; no silent clipping or fallback to another resource. Installation may retain dormant actions under existing approval-subset policy. |
| Wildcard capability/permission/resource name | Reject. Resource maxima are exact finite sets; `current-app` is a trusted Gate resolver token, not a wildcard. |
| Existing visible/editable `prefix-*` | Retain existing object-only matching; it cannot broaden service resource scopes. |
| Requested operation beyond fixed binding | Reject regardless of resource/capability availability. |
| Missing/unknown library scope resolver or required-resource validator | Reject activation of the action under strict semantics; no receipt-wide fallback. |
| No protected operation needed by an informational Page | Valid Page entry with empty action bindings; do not invent an empty-scope action. |

### Multi-resource authorization and provider behavior

A legitimate action declares all resources it may touch, bounded by existing
resource/declaration/preflight/transaction ceilings. It need not invent one action
per record, nor can an untrusted input string expand a declared set. Current Store
administrative preflight accepts at most 16 resources; transaction members remain
1–64 (or reduced limits). No proposal raises those ceilings.

For a transaction, resolve/authorize the envelope's exact store/collection and every
member's effective collection in the **same store**. Require envelope transaction
capability/policy plus each member's ordinary capability/policy, all within `E`.
Validate every member and policy before the first provider mutation. A denied
second member must leave the first unwritten. Each declared required resource must
also pass the existing conservative fixed-operation preflight. Therefore a strict
records/archive transaction needs approved `transaction` policy on both declared
collections as well as its actual create/update/etc. member policies. Do not weaken
preflight merely to make the old BOB1 fixture pass.

BOB1-02 under strict semantics: `get(records)` targeting archive denies even when
archive Store permission exists. An archive read uses the archive action and its
permission, or an explicitly reviewed `get` declaration covering both resources.
Its existing records-only transaction must deny archive before writes. A legitimate
replacement transaction declares `[records, archive]`, receives host review, and its
fixture config explicitly supplies both required transaction rules and actual member
rules. Both ordinary create capabilities and the transaction write capability must
remain approved. This example is a **proposed modification**, not current fixture
syntax or qualification.

JSON keeps one-document private batch plus one rename; SQLite keeps native
`BEGIN IMMEDIATE`, result/revision checks and rollback. Scope checks belong above
the adapters and must behave identically. No cross-store, cross-owner, JSON/SQLite
combined, network or REST transaction is authorized. Multiple separate service
requests do not become one transaction. Multi-step workflows remain deferred.

### Review, upgrade and revocation

The existing native review machinery should show, for every action: exact owner,
fixed operation/effect, action permission, logical required maximum, resolved maximum,
receipt intersection, missing approvals, and prior/target differences. Review also
binds the action-contract semantics version and accepted declaration digest. Include
this evidence under the existing size ceilings and policy revision/integrity checks.
It is derived evidence, not a second independently writable per-action resource map.

Changes that expand an action maximum **within an unchanged receipt scope** still
expand that action's authority and require explicit expansion approval. Added action,
changed fixed operation/effect, changed permission, widened input target contract,
changed Page binding or mapping are conservatively flagged for review; never infer
permission implication from role membership. Narrowing also needs reviewed publication.
Unchanged approvals may survive compatible updates only when their complete semantic
binding remains equivalent. Updates cannot auto-approve a new action or wider maximum.

Separate artifact acceptance from policy: publish any changed immutable declaration
only through a valid versioned package update/upgrade; never edit accepted resources
or historical receipts. If new requirements remove approved package grants, first
perform existing reviewed narrowing. Reconciled updates preserve the approved subset.
A candidate which changes action authority cannot execute before its corresponding
review is applied. Use the existing stopped-App review barrier and effects/checkpoint
workflow to hold it unavailable; do not introduce an executable half-approved state.

All entry/action/policy/config changes bind into receipt/policy integrity and fresh
execution generations; rebuild action/Page registries after drain/restart. Old
references, contexts, cached services, callbacks and handles remain fenced, including
rollback/cancellation. Gate membership/session changes are live without a package
policy rebuild. Checks before provider admission and after asynchronous completion
remain mandatory. A Store provider already admitted may commit before a later revoke;
HTTP then reports denial/uncertain publication, never proof of rollback. Cross-process
drain remains an operator obligation, not a new distributed lease guarantee.

### Implementation impact

Factor action authorization/resource resolution so preflight and dispatch use the
same trusted reduced context. Reuse package mappings, library resolvers and installed
lifetime guards. Add reviewed per-action authority evidence/digests and expansion
classification to existing policy/update planning. No Store SQL/JSON schema change,
record/history migration, new per-user Store grant language, private Gate rebinding,
custom workflow interpreter or generic data provider is required.

## Compatibility inventory and migration decision

### Repository evidence, distinct from hypothetical packages

Inventory scanned repository manifest files excluding dependencies and Git internals,
and action fixture builders. No installed catalog/receipt files were found under
repository `content/`. Tests construct real disposable receipts; no production or
external installation inventory is implied.

| Actual artifact/fixture | Impact |
| --- | --- |
| [members manifest](../../examples/backoffice-members/manifest.json) | One `list-members` action, managed owner `backoffice-members`, `wydgate:[current-app]`, `gate.members.manage`; no Store resources. Strict maximum resolves to this App. Needs reviewed adoption/versioned future contract, no apparent extra-resource dependency. |
| [notices manifest](../../examples/backoffice-notices/manifest.json) | One `list-notices` query, owner `backoffice-notices`, `wydstore:[notices]`, `operations.notices.read`; only one package Store resource. No behavioral expansion needed; explicit adoption still required. |
| Other checked-in example manifests | Guestbook, membership, search, taskboard, WBasic Taskboard, source-components, media contain no `backofficeActions`. No action-scope migration implied by their public Page declarations. |
| [action fixture](../../test-support/backoffice.js) | Builds a real `page-admin` App-owned wrapper with `/administration` slug and BackOffice placement. This does not publish an approved Page entry. Test wrapper must receive an explicit entry for DEC-01 HTTP tests. |
| [Store action fixture](../../test-support/backoffice-store.js) | Four fixed CRUD actions on `records`; independent action and Store permissions. Single-resource behavior should remain with reviewed strict adoption. |
| BOB1-02 records/archive fixture | Actual two-resource receipt-wide get and transaction success assertions change under strict semantics. Preserve original characterization under the historical baseline; add strict denial and explicit multi-resource success cases. |
| BOB1-03 Taskboard | Real neutral composed Page and Page.PreRender handler; no action declaration. New Page route/grant/binding fixtures needed; never infer entry from its `home` Page ID. |
| [module fixtures](../../test-support/backoffice-modules.js), BOMOD-01/02 | Separate members and notices receipts with independent permissions. Keep separate action shell discovery. Combining both principals in one installed Page is unsupported; shared definition reuse is allowed. |
| [manual replacement tests](../../test/manual-replacements.test.js) | A `second` Store resource is added for migration/checkpoint failure coverage, not an action declaration; DEC-02 must not alter those ownership/effects semantics. |

Actual compatibility promises include readable older catalogs; immutable accepted
resources/receipts; separate host approvals; preservation of reconciled subsets and
authored App trees; no grant union; public Page/transfer compatibility; and explicit
failure for unsupported contracts. Action documentation promises required preflight
and receipt-derived execution but never explicitly promises a declaration maximum.
Therefore strict dispatch is a **behavior change**, even for packages whose action
shape is already valid. No claim that all external packages are single-resource is
justified by the two checked-in contributions.

### Strategies considered

| Strategy | Evaluation |
| --- | --- |
| Immediate global fail-closed with implicit reinterpretation | Narrower, but old installations unexpectedly break after a binary upgrade. Do not silently reinterpret receipts or discover problems only at first action invocation. |
| Versioned opt-in only, old receipt-wide behavior indefinitely | Preserves old packages but leaves an unbounded legacy authority path, especially through future Page composition. Reject as the permanent model. |
| Explicit finite legacy compatibility mode | Could pin receipt/hash/grants and a host-reviewed expiry, disallow Pages/expansion/upgrades, then require migration. Adds an enforcement clock, exception state and more qualification. No actual persistent repository receipt requires it; do not add it now. |
| Reviewed migration before enforcing runtime admission | Recommended with a versioned contract and read-only preflight. Owner sees exact behavior changes and blockers before maintenance/startup; failed migration leaves source intact. No execution bypass. |

### Recommended migration procedure

1. Ship a read-only native preflight before/with the enforcing increment. It inventories
   active BackOffice action installations, all effective action scopes, new Page
   entry proposals and all legacy/invalid/missing policy bindings. Classify changed
   behavior conservatively; static analysis cannot prove a dynamic action will never
   target another receipt resource. Report records/archive explicitly.
2. Stop/drain the App and all cooperating execution processes. Keep an exact backup
   and existing bounded checkpoints. Do not begin cutover if providers cannot drain.
3. Owner reviews an exact per-installation action-contract adoption plan through
   existing native policy authority. Even unchanged declarations require explicit
   adoption of maximum semantics. Adoption is approval of the exact current artifact,
   receipt resources, derived per-action limits and semantics version, not editing
   historical bytes. New artifacts introducing declarations/bindings require an
   appropriate minimum engine version and normal package version advancement.
4. Where legitimate extra resources were omitted, first prepare a versioned package
   update declaring them and compatible Store rules. Follow existing policy narrowing/
   upgrade/expansion review ordering. Old source remains available until stopped-App
   transition; pending target review blocks execution. No partial App starts with an
   unreviewed active BackOffice action installation.
5. Publish adoption using existing checksummed policy/effects workflow, a new supported
   catalog/receipt contract discriminator that older engines reject, fresh generation
   and policy revision. Exact wire schema/version numbers are implementation work,
   not fields accepted by this document. Recovery must recognize the discriminator.
6. The enforcing runtime refuses App startup/admission if **any active BackOffice
   action installation** lacks reviewed strict adoption. Report a native sanitized
   migration blocker before accepting requests; no per-request legacy fallback.
   A package with no actions needs no DEC-02 adoption. A FrontEnd installation's
   dormant actions need adoption before relocation/activation into BackOffice.
   Retired/retained installations need adoption before reactivation/reinstall.
7. Start fresh registries, run actual installed positive/negative qualification, and
   explicitly acquire fresh references. Failed precommit migration preserves source;
   postcommit recovery completes the recorded target. Never launch an older engine
   against newer accepted state. Reverse policy change uses fresh review and new
   generations, not restored stale approval or silent receipt-wide behavior.

This deliberately chooses a planned startup prerequisite over a legacy mode. Existing
binary/state can continue operating before owner-approved cutover. An operator must
schedule maintenance; these decisions do not authorize deployment or retroactively
change existing installations. If a real deployment later demonstrates a need for
a finite exception, return to the owner with its exact inventory, expiry and removal
tests; no such exception is implicitly authorized here.

## Cross-cutting contracts and reusable Wydgits

DEC-01 determines which Page and binding can be selected; DEC-02 determines the
resource authority of the selected action. Neither substitutes for current caller
policy, service operation validation or receipt integrity. A Page binding cannot
widen `D`; a narrower `D` cannot create Page-entry approval. No new engine execution
context, domain, delegation authority or cross-package grant union is introduced.

Neutral/inherited/nested components execute local behavior under the initiating
Page context. Same-publisher inheritance and public prototype reuse retain existing
object-model rules. A specialization can narrow a typed binding constraint, not
replace approved targets or erase ancestor security requirements. A child receives
portable references/data, never an independently privileged service facade. This
protects authority boundaries; it is not an isolation boundary against arbitrary
hostile native JavaScript (which ordinary packages do not execute).

| Future component | Compatibility of the proposed contract; no implementation claim |
| --- | --- |
| DataBound | Typed logical operation dependency plus explicit load/action intent; no provider authority from its base prototype. |
| DataTable | Named approved read binding, bounded results/columns and safe denied/stale/empty states. No implicit per-row provider calls. |
| DataPager | Reuses the view's query/continuation input, never a new scope or context; cursor/offset is data. |
| DetailForm | Named approved mutation, closed parameters/revision and explicit confirmation; preserves drafts on conflict/uncertain delivery. |
| Repeated row templates | Existing typed repetition/lifetime cleanup; record keys cannot select another binding or confer record authority. |
| Model-specific inheritance | Specialize labels/validation/contracts while preserving installed target review and original caller. |
| Provider-specific specialization | Approved provider operation/resolver behind the same logical binding; unsupported operations fail explicitly. |
| FrontEnd/BackOffice composition | Reuse definitions/presentation; each placement/entry and request has independent authority. A FrontEnd browser may explicitly submit a BackOffice action if its real session independently passes that admission; FrontEnd server code cannot acquire BackOffice. |

WydStore still owns persistence, JSON/SQLite authorization and transactions. Proposed
WydData may later adapt Store, PostgreSQL, REST or computed/SEAM sources behind
approved logical operations, so a generic control need not know the provider. This
requires separately qualified provider resource resolvers, scope enforcement,
operation support and outbound/destination approval where relevant. PostgreSQL
persistence belongs to WydStore even when remote. REST capability discovery cannot
replace SEAM, exact destination limits or live policy. Read-only/computed sources
need not pretend to be writable stores. No future provider can advertise broader
transaction or retry guarantees than its qualified source.

WydData providers, protocol, DataBound/DataTable/DataPager/DetailForm and CIR remain
proposed/unimplemented. CIR is not a required resolver or authority source. No
System/Headless/AccountAdmin/HostAdmin activation follows from this package. Frozen
WydClient artifacts are unchanged; a future presentation adapter change must use
its separately governed versioned workflow.

## Security proof obligations and required regression tests

The identifiers B2P/B2S below are **proposed tests**, not passing evidence. Existing
test names identify reusable regressions; the future Page/strict-scope joins must
be demonstrated through installed exports and genuine HTTP, not mock authority.

| Threat | Trusted enforcement boundary | Required proof |
| --- | --- | --- |
| Forged Page entry / unauthorized discovery | Exact approved entry resolver, live Page policy before execution | B2P-01: property/slug/query/raw Page ID cannot publish a Page; no entry metadata or handler call on denied entry; informational zero-binding Page succeeds only with entry grant/permission. |
| Forged site identity | Native routing before credentials, exact App in every receipt/reference/service owner | B2P-02: identical Page/action labels on independent Apps, foreign Host/proxy/body/App rejected; extend BOHTTP-05, ACT-11, BOMOD-02. |
| Forged package identity | Accepted catalog, single Page principal, exact managed owner and wrapper binding | B2P-03: request/provenance/public base prototype cannot substitute package, managed owner or App-owned root; extend BOP-01/07 and BOB1-03. |
| Forged caller identity | Reserved-cookie Session resolution and live Gate evaluator | B2P-04: forged roles/membership/capabilities in input/config reject, cross-App/expired/revoked sessions fail; preserve BOHTTP-02/04 and ACT-02/11. |
| Unauthorized action binding/configuration | Closed finite target allowlist, reviewed binding digest, exact installed registry | B2P-05: missing target, forged binding, default override, invalid type, fixed-service replacement and unauthorized configuration fail before provider; independent raw action invocation still needs its own authority. |
| Nested-component escalation | Typed references, composition-only facade, independent action reauthorization | B2P-06: child holding a binding cannot call another action, raw SERVICES path, legacy service alias or native acquisition; arbitrary row keys cannot expand scope. |
| Inheritance escalation | Ancestor restrictions and binding slot contracts validated across full tree | B2P-07: override cannot widen context/targets/input/effect or borrow prototype authority; neutral Taskboard inheritance/nesting/repetition still renders. |
| Cross-site invocation | Origin/CSRF, site cookie, exact reference and owner checks | B2P-08: foreign origin/token/reference, same IDs/different App and public transfers deny; preserve BOHTTP-04/05/10. |
| Cross-package invocation / grant union | Same-installation Page binding resolver and Store owner; one Page principal | B2P-09: foreign contribution/nested installed principal denies; independent shell modules remain usable under their own receipts (BOMOD-01). |
| Receipt-scope bypass | Approved logical-subset preflight, concrete scope intersection, independent service ownership | B2S-01: unapproved/private Gate/foreign owner targets deny even when declared or user permission exists; ACT-06/10 and BOFOUND-01 remain. |
| Action-scope bypass | Trusted reduced guarded context used by preflight and all actual dispatch paths | B2S-02: records-only get cannot reach approved archive; cache/legacy/direct Page presentation paths cannot restore receipt-wide scope; test both providers. |
| Wildcard abuse | Exact capability/resource grammar and deterministic resolvers | B2S-03: bare/prefix/middle wildcard resources reject; current-app resolves only exact site; object prefix grants do not alter Store scope. |
| Unauthorized multi-resource transactions | Store envelope/member preparation, attenuated scope, all actual policy before provider | B2S-04: denied second archive member writes neither record; declare/review both plus required transaction/member permissions for positive case; absent member capability also denies. |
| Missing/empty declaration or absent provider | Closed action validator, strict resolver/opt-in registration | B2S-05: no scopes/empty/unknown library/extra keys reject; no receipt-wide fallback; no-action informational Page remains valid. |
| Stale installation generation / replaced/upgraded target | Installed lifetime and exact immutable reference/digest comparison | B2P-10/B2S-06: old contexts, callbacks, read bindings and browser intents stay stale after update/replace/relocate, with same IDs; explicit refresh only (ACT-03, BOP-02/03/12). |
| Retired or retained package | Placement acquisition and lifetime guard | B2P-11: no Page/action/provider entry after retire/remove; reinstall issues fresh authority; retained data/history preserved (BOP-06/10, ACT-03). |
| Revoked caller grants/session | Live Page/action/service policy before admission and final publication | B2P-12/B2S-07: revoke entry, action and actual Store permissions independently, including between async checks; BOB1-01 still deletes matching cookie after native commit and reports uncertain. |
| Tampered manifest/resources | Accepted resource hashes, package validation before acquisition | B2P-13: altered artifact/binding/declaration rejects before Page/service code; preserve existing package integrity suites. |
| Receipt drift / restored timestamps | Mirrored integrity, config/receipt fingerprints and metadata guard | B2P-14/B2S-08: mirror/edit scopes or binding digest, restore mtime; activation/cached execution denies (BOFOUND-03, policy reconciliation). |
| Symlink substitution | Existing safe reads/local-root/accepted-state and provider checks | B2P-15: linked catalog/config/artifact/provider replacements reject; no route-supplied native paths (BOFOUND-03 and provider suites). |
| Recovery barriers / review half-state | Existing package writer/recovery/pending-policy barriers | B2P-16/B2S-09: kill/restart at adoption/entry publication boundaries, no mixed/legacy authority; repeat recovery yields one registration, fresh generation, exact checkpoints (ACT-09, reconciliation/lifecycle suites). |
| Concurrent requests | Per-request immutable caller/context/ledger, existing admission and Store CAS | B2P-17: concurrent callers with different permissions cannot share authorization/results/reference authority or exceed budgets; preserve GATECONT and BOREL-04. |
| Cancellation/disconnect | Completion guard, Page cleanup, native work retained through App drain | B2P-18: disconnect before admission calls no provider; after admission hold drain until settlement, do not retry (BOREL-05). |
| Deadline exhaustion | Shared Page/SEWN ledger, reduced request deadline and provider-entry guard | B2P-19: chained/nested read binding cannot reset ledger, start late work or extend 1,000 ms Page ceiling; preserve BOREL-01/02/03/07. |
| Native commit then indeterminate HTTP response | Completion/publication separation, final policy, outcome header | B2P-20: write commits once, then expire/revoke/break output/disconnect; uncertain result, inspection shows one revision, no replay (BOB1-01, BOHTTP-07). |
| Silent authority expansion on upgrade | Existing reviewed policy with added per-action diffs/strict discriminator | B2S-10: widening records to records+archive inside same receipt still needs explicit expansion review; copied approvals/hash replay/older engine fail. |
| Unexpected legacy execution after rollout | Preflight plus all-active-action startup gate | B2S-11: mixed adopted/unadopted active installations block App; dormant/retired entries cannot activate without review; no config flag resumes receipt-wide mode. |

A live Gate permission check and Store commit are not one atomic transaction.
Revocation after the final pre-admission check may race already admitted work; tests
must prove checks at qualified boundaries and truthful post-admission outcomes,
not claim instantaneous rollback. Installed integrity protects cooperating trusted
local-host state; hashes are not protection against a malicious native administrator
who controls all accepted files. Preserve existing provider, process/Linux,
symlink, package lifecycle, SEAM and browser credential regressions.

## Proposed implementation sequence and readiness

1. **Approve contracts, then version and validate metadata.** First increment:
   read-only adoption preflight and closed semantic validators for Page entry,
   bindings and strict action resource resolution; no HTTP activation yet. Produce
   exact review evidence from the real members/notices/records/archive fixtures.
   Assign supported wire schema discriminators and engine minimums, not speculative
   accepted fields. Required declaration/receipt/recovery integrity must include them.
2. Extend existing stopped-App review/update/recovery to approve action semantics,
   per-action scope differences and exact entry/binding configuration. Qualify
   pending review/start exclusion, expansion and interrupted adoption. Enforce the
   startup migration prerequisite before any strict Page path is enabled.
3. Apply trusted scope attenuation to action preflight/dispatch while preserving
   caller, member capabilities, private dependencies, budgets and lifetime. Add
   explicit strict BOB1-02 denials and correctly declared multi-resource positives
   on JSON/SQLite; retain historical baseline evidence.
4. Join exact Page entry to existing HTTP/Session/acquisition/Page/response paths.
   Add composition-only protected service facade, named read preparation and browser
   intent binding; preserve separate raw action API and public routes. Qualify the
   App-owned wrapper and same-principal nesting/inheritance/repetition over real HTTP.
5. Run the complete threat/regression selection through installed packages on both
   providers, required repository checks and immutable-client verification. Only
   then reconsider BO-HTTP-09, BO-ACT-10 and BO-REU-05 classifications from evidence.
   Address human accessibility and broader reusable ADM-01 controls separately.

Both decisions are sufficiently specified for owner approval **as proposals**.
Remaining owner questions are the explicit choices in the approval section, not
unresolved authority defaults. Exact closed schema names and internal function
signatures are implementation details; they must encode the specified semantics,
not reopen grant inheritance, caller/Store distinction or resource maxima. A request
to support cross-package Page aggregation, server Page writes, independently mutable
per-action approvals or a legacy exception would require a revised owner decision.

Expected matrix impact after B2: **none**. Approval removes decision uncertainty;
it does not implement the missing Page route or qualify scope attenuation. Successful
later integration could qualify BO-HTTP-09, BO-ACT-10 and BO-REU-05, subject to their
full criteria. BO-REU-06 still includes broader editors/dashboard work; BO-HTTP-12
still needs human assistive-technology/full keyboard qualification. Do not claim
64/64, completed BackOffice conformance or readiness to implement generic data-bound
Wydgits before the foundation joins are qualified.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No deadline, response guarantee, frozen
client, runtime version, deployment, package publication or release status changes.

## B2 verification and handoff

B2 modifies only this package, the linked B1 decision-record entry and the Unreleased
changelog. No runtime/test-support code, accepted fixture, manifest, lockfile,
version metadata or frozen WydClient artifact changes.

- `node --test test/backoffice-action-scope.test.js test/backoffice-page-foundation.test.js test/backoffice-actions.test.js test/backoffice-http.test.js test/backoffice-placement.test.js test/backoffice-modules.test.js`:
  **96 passed**, zero failures/cancellations/skips/todo. This includes the real
  installed two-provider scope characterization and native Page composition,
  plus HTTP, independent modules, lifecycle/integrity and late-revocation tests.
  These are existing behavior tests, not qualification of proposed B2 semantics.
- A temporary Python documentation checker validates all **59 relative file links
  and 10 anchors** in the three changed documents, proposal coverage markers,
  **76 stable matrix IDs** and unchanged **59 Implemented / 4 Partial / 1 Missing**
  in-scope classifications. No checker is added to the shipped project.
- Final `npm test` (including existing client/regex build), `npm run check`,
  repeated documentation/whitespace checks and final intended-diff review are
  required after the last content edit. Their exact final results are recorded
  in the commit message and owner handoff, rather than predicting a passing run.

The final handoff reports commit/remote HEAD and tree status; a commit cannot embed
its own hash. Approval remains pending regardless of commit/push completion.
