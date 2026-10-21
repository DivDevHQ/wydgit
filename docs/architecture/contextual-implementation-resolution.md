# Contextual Implementation Resolution (CIR)

**Platform:** Wydgit / Wydgine / WydClient  
**Document version:** 0.1 — architecture review draft  
**Recorded:** 2026-10-20  
**Status:** Proposed extension to the existing execution-context architecture; no implementation or release claim.  
**Workflow boundary:** Deliver and review this document before resuming Spike E. Delivery does not dispatch Cooter or resume testing.

## 1. Purpose and normative scope

Contextual Implementation Resolution (CIR) selects a compatible implementation of a declared contract for a trusted execution environment. An application can use common objects and interfaces while Wydgine or WydClient binds the implementation appropriate to its execution location, context, native platform and available facilities.

The intended outcome is portable application semantics with native abilities where qualified implementations exist. Portability is conditional on contract compatibility, runtime support, policy and available capabilities. CIR does not promise that every application runs unchanged on every platform.

In this document, **MUST**, **MUST NOT**, **SHOULD** and **MAY** express requirements of the proposed CIR contract. They do not describe features already shipped. The rules become implementation obligations when this draft is accepted and the corresponding versioned increment is authorized.

### 1.1 Decision provenance

| Category | Basis and treatment |
| --- | --- |
| Confirmed direction from Almond-Lab | `Client`, `Server` and `System` are distinct execution locations. `System` supports headless/daemon work outside Wydgine HTTP processing. Client objects may use `context=SUB` and `subContext=Android`. Shared interfaces, inherited platform implementations and runtime detection support native cross-platform behavior. |
| Existing repository contract | Trusted placement, immutable execution bindings, implicit Client/SUB, explicit Server context, inherited restrictions, caller-owned authority, package/lifecycle fences and existing closed schemas remain authoritative. |
| Proposed by this specification | CIR metadata, System context profile, platform identifiers, deterministic ranking, result/error contract, resolution lifecycle and conformance requirements. These require review and versioned implementation. |
| Unavailable source detail | The retrieved Almond-Lab assistant replies contain reference markers rather than readable architecture text. This draft does not attribute its new rules to those replies. |

This document supersedes the older deferral of *designing* per-runtime implementation selection. It does not supersede implemented wire contracts, change accepted release milestones, or authorize native runtime development.

## 2. Architectural invariants

1. **App remains the canonical root.** A site is a deployment/profile of an App; CIR introduces no alternate root or containment model.
2. **Prototype inheritance defines object identity and reusable behavior.** CIR chooses among registered implementations; it does not replace the object model.
3. **Interfaces define common observable contracts.** A shared contract has stable semantics across implementations, including failure and cancellation behavior.
4. **Dependencies supply services.** A native implementation uses approved adapters and existing service boundaries, rather than embedding unrestricted host access in portable objects.
5. **SEAM owns execution authority.** Placement, platform detection, interfaces, inheritance and implementation selection grant no permissions.
6. **Selection precedes activation.** No candidate runs merely to decide whether it should be selected.
7. **Bindings belong to a lifecycle generation.** Selection cannot turn a stale object, session, package or policy approval into live authority.
8. **Uncertainty stays explicit.** A completed native write, a committed transaction and a client receiving success remain distinct events.

## 3. Execution coordinates

### 3.1 `runAt`: execution location

| Value | Meaning | Proposed CIR behavior |
| --- | --- | --- |
| `Client` | Execution in WydClient or another qualified client runtime, including future browser, desktop or mobile adapters | Resolve portable or native client implementations behind common contracts. |
| `Server` | Wydgine server application execution, including its existing public and administrative processing | Preserve explicit trusted FrontEnd/BackOffice placement and server authorization. |
| `System` | Host-managed headless, scheduled or daemon execution independent of an HTTP request lifecycle | Require a separately issued, bounded System binding and a qualified runner. No ambient HTTP session or OS privilege. |

`System` identifies an execution model, not a machine, root account, process identity, presentation style or permission level. A Server object does not become System because it runs on the same host. A non-HTTP task is not automatically System: the trusted runner establishes its model.

### 3.2 `context`: execution environment

| `runAt` | `context` | Status and meaning |
| --- | --- | --- |
| `Client` | `SUB` | Existing portable client context. Omission resolves to SUB; explicit SUB is equivalent. SUB is a context identifier, not a product rename. |
| `Server` | `FrontEnd` | Existing public site execution. No generic Server-to-FrontEnd default. |
| `Server` | `BackOffice` | Existing site administrative execution; permissions remain independently enforced. |
| `Server` | `AccountAdmin` | Proposed future account administration; unavailable until separately implemented and qualified. |
| `Server` | `HostAdmin` | Reserved provider administration; does not enable privileged hosting. |
| `System` | `Headless` | Proposed CIR v1 profile for non-HTTP tasks. Explicit trusted placement required; no default. This identifier needs acceptance before implementation. |

`Client/BackOffice`, `Server/SUB` and `System/SUB` are invalid in this profile. `Server/System` is not an alias for `System/Headless`. Unknown, reserved-but-unavailable or unsupported combinations MUST fail closed. A context-neutral declaration is a reusable restriction, not a concrete execution binding.

FrontEnd and BackOffice remain policy environments even though they often correspond to presentation surfaces. A browser displaying administrative controls still executes Client/SUB; an independently authorized server endpoint performs BackOffice operations.

### 3.3 `subContext`: optional platform specialization

`subContext` identifies a registered native/runtime specialization within a context. The motivating declaration is:

```text
runAt = Client
context = SUB       # optional for Client; resolves to SUB
subContext = Android
```

Proposed initial profile identifiers are `Browser`, `Android`, `iOS`, `Windows`, `macOS` and `Linux`. These are proposed architecture identifiers, not a support matrix. System/Headless MAY later use approved OS specializations; Server specialization requires an explicitly registered profile. No implementation may infer that every named profile is installed or qualified.

A concrete trusted environment either identifies a known subContext or records it as unknown. Unknown platform detection can match only platform-neutral candidates; it MUST NOT masquerade as Browser or any native platform. In a candidate declaration, an omitted subContext means platform-neutral eligibility. It does not mean that the runtime has no OS.

Hardware, OS/API versions, device features and adapter versions are separate compatibility facts. They MUST NOT be encoded into ad hoc context names such as `AndroidWithCameraAdmin`. For v1, subContext matching is exact. Family matching such as Linux distribution inheritance requires a future versioned profile graph; string-prefix matching is forbidden.

### 3.4 Naming and serialization boundary

This document uses **`runAt`** as the conceptual name requested in Almond-Lab. The implemented `wydgit.execution/1` contract uses **`runat`**. Case-sensitive values and field spelling MUST remain unchanged for that schema.

CIR v1 MUST introduce a negotiated metadata contract before accepting `System`, `subContext` or resolver fields. It MUST NOT silently add these to `wydgit.execution/1`, `wydgit/0.2`, existing manifests, interface declarations or static-library schemas. A versioned converter may map conceptual `runAt` to the selected wire spelling; accepting both spellings, duplicate keys or conflicting aliases is forbidden unless a future schema explicitly defines it.

## 4. Responsibility and trust boundaries

| Component | CIR responsibility |
| --- | --- |
| Wydgine | Validate server registrations and compatibility; resolve server implementations; enforce trusted placement and lifecycle. |
| WydClient | Resolve qualified client implementations and presentation/native adapters; preserve portable contract behavior. |
| Future System runner | Issue and retire headless bindings, identify tasks and enforce process/service/resource boundaries. Wydgine remains usable without this runner. |
| Trusted host registry/loader | Verify packages, publishers, interface implementations, inheritance, dependencies, profiles and immutable catalog generations. |
| SEAM | Enforce caller authority, visibility, scope, budgets and valid execution lifetime at every protected operation. |
| WydGate | Supply applicable identity, membership and application policy; CIR must not invent a second membership system. |
| WydStore | Enforce exact ownership and provider-independent logical access under existing lifecycle and authorization rules. |
| WydHosting | Future managed placement/provisioning and isolation; a CIR choice is not a provisioning command. |

Portable package data may request a target or restrict eligibility. Only trusted host/runtime code establishes the actual environment and authority. An ordinary containment parent, JSON copy of an execution object, user-agent string or package property cannot establish trusted placement.

### 4.1 Relationship to WydData

The [WydData architecture](wyddata.md) separates WydStore persistence from generic
Store-backed, REST and SEAM/computed resource providers and reusable Wydgit
presentation. CIR could later select a compatible provider or presentation adapter;
explicit approved bindings do not require CIR. This relationship does not accept
CIR's proposed resolver, enable System execution or add implementation to 0.3.
Selection cannot grant resource authority, rewrite canonical prototype identity or
switch providers to replay an indeterminate mutation. WydData's remote revision
and idempotency proposals require their own contract and qualification.

## 5. Contracts, interfaces and inheritance

### 5.1 Common contract

Each resolvable implementation MUST provide a qualified, versioned interface identity. A contract defines method signatures, inputs/outputs, state assumptions, errors, cancellation, side-effect semantics and required authority. Compile/registration checks MUST validate interface conformance using the platform's existing interface rules.

An implementation may add native features through separately declared extension interfaces. Callers must negotiate those extensions explicitly. The base interface MUST NOT return success while silently omitting a required native operation. If portable and native behavior cannot satisfy one contract, they require distinct contracts or an explicit optional feature in the contract.

CIR metadata belongs in a new resolver/implementation registration contract. It does not make execution placement a field in existing closed interface declarations.

### 5.2 One inheritance model

Implementations MAY use the existing single `extends` chain for shared behavior. For example:

```text
PortableCaptureBase                 abstract shared behavior
  -> AndroidCapture                 concrete Android implementation
  -> BrowserCapture                 concrete Browser implementation

AndroidCapture and BrowserCapture each implement ICapture/1.
An independently authored implementation may also implement ICapture/1.
```

The branches above are sibling alternatives, not multiple inheritance. An interface establishes substitutability; it does not require every provider to share a base class. Existing publisher restrictions, method override checks, visibility and abstractness rules remain in force.

An inherited execution restriction MUST be preserved or narrowed. A descendant cannot change Client to Server, BackOffice to FrontEnd, or an Android-only base to Linux. A neutral base can have platform-restricted descendants. Registration MUST reject cycles, missing bases, illegal cross-publisher inheritance and incompatible inherited constraints before any selection.

CIR chooses a concrete leaf whose complete ancestry is already registered and valid. It MUST NOT synthesize a chain by mixing methods from unrelated platform branches. Deeper inheritance does not create selection priority or additional authority.

### 5.3 Logical identity versus implementation identity

Portable application data MUST distinguish its logical object/contract from the concrete implementation binding. CIR MUST NOT silently rewrite a persisted `prototype` to a sibling subtype, change canonical ancestor membership, or make an existing type assertion change meaning across platforms.

The initial target is a factory/service binding or explicitly declared resolvable construction point. An object with an exact concrete prototype remains exact. Automatic substitution for arbitrary existing `NEW`, hydration, slot typing or method dispatch is out of scope until separately versioned and qualified. This keeps CIR compatible with canonical object identity.

## 6. Proposed resolution model

### 6.1 Immutable inputs

| Input | Required contents |
| --- | --- |
| Resolution request | Contract ID and supported version range; logical binding key; operation intent and required semantic features; explicit approved provider pin, if any. |
| Trusted environment | Concrete runAt/context; known or unknown subContext; runtime/adapter/OS/API facts; verified facility availability; host binding identity and generation. |
| Candidate catalog | Exact implementation/package versions and hashes; provided interfaces; concrete prototype; inherited constraints; dependencies; platform requirements; bounded preference value; catalog generation. |
| Policy and lock state | Allowed providers, exact dependency locks, scope/ownership constraints, policy revision, approved fallback mode and live authorization references. |

The selected contract version is an explicit negotiation result supported by caller and provider. Dependency locking chooses exact artifact versions before ranking implementations; CIR MUST NOT pick whichever version was installed last or dynamically fetch a newer one.

An implementation registration MUST identify all executable dependencies and native adapters before activation. Registries MUST bound candidate count, inheritance depth, metadata size and resolution work. v1 predicates are declarative comparisons, not executable expressions or package-supplied discovery code.

### 6.2 Illustrative candidate record

The following YAML is a design example, **not accepted manifest syntax or an existing schema**:

```yaml
schema: wydgit.cir-implementation/1-proposal
implementationId: example.capture/android
packageVersion: 1.0.0
contract: example.capture/ICapture@1.0.0
prototype: example.capture/AndroidCapture
target:
  runAt: Client
  context: SUB
  subContext: Android
requires:
  facilities: [capture.image]
  adapters: {android.capture: ">=1.0.0 <2.0.0"}
  grants: [capture.use]
preference: 0
```

IDs and facilities in this example are illustrative. Production names, capability scopes, allowed version-range grammar and metadata schema need registration and validation; this document creates none of them.

### 6.3 Availability, permission and consent

CIR MUST keep these facts separate:

- **Facility availability:** the adapter and underlying function exist and are compatible.
- **Authority:** the current principal is permitted to invoke the operation under SEAM and applicable Gate/Store/host policy.
- **Native consent:** the OS or user has granted access where required.

Detection MUST use trusted runtime/adapter facts and bounded, side-effect-free discovery. It MUST NOT prompt for consent, open files/devices, execute candidate constructors or grant capabilities during resolution. Browser claims cannot authorize server operations. Native consent never grants server, account or filesystem authority beyond the approved service contract.

### 6.4 Deterministic algorithm

Given identical canonical inputs and versioned resolver semantics, CIR MUST produce the same implementation identity or the same structured failure, independent of discovery order, filesystem enumeration, network timing or process startup order.

1. Validate the request, live trusted binding, schema/profile support and complete locked catalog. Reject invalid registrations rather than quietly treating them as absent. Check request-level authority and permitted contract intent before exposing candidates.
2. Apply an explicit approved implementation pin, if present. A pin restricts the candidate set to that exact identity/version. An unavailable, incompatible or unauthorized pin fails; it never triggers an unrequested substitution.
3. Filter candidates by interface/version compatibility, concrete implementation, exact locked dependencies, all inherited execution restrictions, native ABI/runtime/API constraints and required semantic features. Filter out providers prohibited by host policy. Missing facility support is an eligibility failure, not a reason to probe by executing code.
4. Match the trusted execution coordinates. A supplied candidate coordinate must agree with the concrete environment. An unknown environment subContext cannot satisfy an explicit platform restriction. Required request features remain mandatory for every fallback.
5. Rank remaining candidates lexicographically by the specificity tuple `(restrictedSubContext, restrictedContext, restrictedRunAt)`, with each component 1 for a matching effective restriction and 0 for neutrality; then by a validated integer `preference` (higher first). Effective inherited and normalized restrictions determine specificity. Client's implicit SUB and explicit SUB are equivalent, including ranking; serialization spelling cannot create priority. A platform match therefore outranks a portable candidate regardless of preference. Preference is immutable package metadata subject to host review.
6. Require a unique highest-ranked candidate. Equal top rank yields `CIR.AMBIGUOUS`; enumeration order, alphabetical ID, inheritance depth, version recency and number of requested permissions MUST NOT break the tie. An approved pin or a versioned catalog correction can resolve it.
7. Check the winner's complete required grants, scopes, live policy and applicable consent status without prompting. Denial yields a structured denial or consent-required result. It MUST NOT silently fall through to a provider that evades the denial.
8. Produce an immutable resolution plan identifying the winner, negotiated contract, dependency locks, input generations and diagnostic reason codes. Revalidate the relevant generations and authority at activation; a stale plan fails and may be resolved again before any side effect.

An empty eligible set yields `CIR.NO_IMPLEMENTATION` with bounded rejection categories. Missing facility support may permit a lower-ranked portable candidate only when the approved binding policy allows portable fallback and that candidate satisfies the full requested contract. A native-required request never falls back to portable behavior.

No fallback occurs after activation has begun or after an implementation fails, loses permission, is cancelled or may have performed a side effect. A new attempt is a new operation governed by explicit retry/idempotency semantics, not by CIR ranking.

### 6.5 Selection examples

Assume Android/SUB and Browser/SUB implementations, a portable Client/SUB implementation, and a Server/FrontEnd implementation of a common logical contract. All candidates are otherwise valid unless stated.

| Environment or condition | Required result |
| --- | --- |
| Client/SUB/Android with native facilities and authorization | Select Android implementation. |
| Client/SUB/Browser | Select Browser implementation. |
| Client/SUB with unknown subContext | Select the portable implementation only if fallback is allowed. |
| Android native facility absent; portable implementation meets all semantics | Portable candidate is eligible only under approved fallback policy. |
| Android native implementation selected, but permission denied | Deny; do not switch providers to bypass permission. |
| Android operation requires a native-only semantic feature | Unsupported if no native candidate meets it; portable fallback cannot dilute the request. |
| Two equally preferred Android candidates | Fail `CIR.AMBIGUOUS`, unless an approved exact pin selects one. |
| Exact pinned Android implementation incompatible | Fail; do not silently use a different version or provider. |
| Server/FrontEnd | Select eligible Server candidate; never a Client or System candidate. |
| System/Headless/Linux without a qualified runner/profile | Fail unsupported environment before loading candidate code. |

## 7. Lifecycle and state

### 7.1 Binding state machine

```text
Registered -> Resolved -> Prepared -> Active -> Draining -> Disposed
                 |           |          |
                 +-----------+----------+----> Failed -> Disposed
```

Registration and resolution execute no candidate code. Preparation allocates approved resources under a live binding; it may fail. Activation publishes the instance only after preparation succeeds. Preparation that requires OS consent must use an explicit user action through the approved adapter; after consent, authority and plan generations are revalidated before publication.

If preparation partially fails, the owner MUST dispose acquired resources in reverse dependency order within a bounded cleanup allowance. Cleanup should be idempotent. Failure cannot resurrect a stale binding, conceal an uncertain side effect or justify trying another provider automatically.

### 7.2 Ownership and lifetimes

Every binding MUST record its owning App/site or explicit future domain, package installation identity, implementation version, execution generation and lifecycle scope. Supported scopes must be explicit: invocation, client session, App or host-managed task. A process singleton is not a tenant-safe default.

System tasks require a trusted task identity, owner, cancellation source, finite work/lease policy, concurrency limits and shutdown handling. They have no ambient authenticated user or request context. A request may enqueue work only through an authorized service with explicit delegation and ownership; serializing an ExecutionContext does not transfer authority.

Methods retain the caller's authority. An implementation's independent grants MUST NOT be borrowed by its callers. Ending a binding fences future calls and cached handles; it does not reverse committed work or claim forcible cancellation of a native operation already in progress.

### 7.3 Replacement, restart and revocation

Replacement MUST stop admitting new work to the retiring binding, drain or cancel existing work under existing semantics, retire its generation and activate a separately validated replacement. No implicit hot swap occurs on platform-detection changes or capability revocation.

Persistent state MUST be contract-defined, versioned and portable or explicitly marked implementation-specific. Persist logical identity, data and approved lock information; do not persist opaque native handles, executable callbacks, consent tokens or host authority. Restart revalidates the environment and issues fresh bindings. Moving state between implementations requires an explicit migration/compatibility contract and existing backup/recovery barriers.

Package removal, replacement and policy reconciliation MUST preserve receipt, source-hash, stopped-App, stale-plan and interrupted-effects protections. An old process or cached resolution must not revive a retired installation.

### 7.4 Caches and generation fencing

Resolution caches MAY store immutable plans, never permission grants. Cache identity MUST cover the contract/intent, exact catalog/lock generation, environment/adapter profile, placement/ownership identity and policy generation. Live execution, membership, consent and permission checks still occur at activation and protected invocation boundaries.

Catalog replacement, adapter change, policy revision, placement retirement or runtime upgrade invalidates affected plans. Cache reuse across tenants or principals must not expose candidate details or reuse authority. v1 uses generation fencing and explicit re-resolution; it does not require live mutation of active objects.

## 8. Security requirements

1. **Trusted registration:** only approved loaders register implementations. Validate artifact integrity, publisher/namespace policy, dependency locks, interface conformance and native adapter provenance. A signature alone does not supply grants.
2. **No ambient escalation:** `System`, `HostAdmin`, Android and public/core inheritance do not imply root, shell, filesystem, camera, network or administrative authority.
3. **Existing mediation:** native operations go through approved bounded services. Preserve SEAM capability/scope checks, Gate membership, WydStore ownership and existing exact caller identity.
4. **Isolation:** logical labels do not isolate memory, processes, credentials, files or networks. Deployment isolation must be separately implemented and qualified for the relevant threat model.
5. **Cross-runtime calls:** Client-to-Server and Server-to-System communication uses explicit authenticated transports with validated schemas, independent authorization and cancellation/outcome contracts. CIR does not automatically create RPC, serialize live objects or move execution across trust boundaries.
6. **Revocation:** long-running bindings recheck live policy at protected boundaries. Stale consent or capability caches cannot authorize new work. Unrevocable in-flight effects retain truthful outcome reporting.
7. **Budgets:** resolution, preparation, execution, queues, native operations and cleanup remain bounded. Preserve existing deadlines and `SEWN.LIMIT`; context cannot select a larger allowance for itself.
8. **Safe observability:** expose bounded reason codes and authorized implementation identities. Do not emit secrets, raw payloads, SQL, paths, private catalog contents or membership data to public diagnostics.

### 8.1 Sessions and storage

`wydstore://system/sessions/{siteId}/{sessionId}` remains a possible configurable hosting storage option from Almond-Lab, not the default session backend and not a new URI authority created by CIR. Selecting System execution neither selects session storage nor grants access to a `system` namespace.

Any future persistent-session provider must separately specify tenant ownership, access, expiration, encryption/secret handling, locking, revocation, crash recovery and resource limits. Lower disk cost alone does not establish compatibility or security. CIR must not couple adoption of native implementations or headless tasks to a session-provider change.

## 9. Compatibility and adoption

### 9.1 Existing contracts remain authoritative

The implemented foundation accepts `wydgit.execution/1` with `runat`, optional `context` and the current supported Client/Server combinations. `wydgit/0.3` may carry that execution declaration; `wydgit/0.2` remains closed and neutral. System and subContext are not presently accepted fields/values under those contracts.

New CIR packages MUST declare a minimum compatible engine/client and resolver schema/profile version with reviewed upper bounds. An older engine must reject a CIR-required package rather than ignore metadata and run it generically. Unknown fields fail closed under their schema. Older packages remain exact-prototype packages unless explicitly migrated; omission of CIR metadata never enables automatic substitution.

Existing CLIENT authoring, package runtime targets, SEWN/WBasic grammar, WydSUB protocol and static-library/interface schemas remain independent. Their mappings to CIR require explicit versioned changes; no field in this document is new language syntax by implication.

### 9.2 Compatibility dimensions

Before activation, validate the interface version, resolver/schema version, engine/client version, package dependency locks, SEWN/protocol compatibility where used, adapter ABI/API, OS facilities and persisted-state version. A match on `Android` or `Linux` alone is insufficient.

Contract versions are compatible only by an explicit declared rule. Native adapters must preserve the common contract's behavior, failure and cancellation semantics. A provider that cannot honor them is incompatible even when method signatures match.

### 9.3 Migration procedure

1. Inventory concrete prototypes, execution restrictions, portable contracts, native dependencies and deployment policies.
2. Define the new metadata/wire contract and loader negotiation; reject unsupported combinations before package admission.
3. Release new immutable package artifacts and explicit lock state. Do not retrofit accepted bytes, receipts or historical client distributions.
4. Produce a dry-run mapping of logical binding points to candidates, conflicts, required grants and state migrations; obtain applicable existing policy review.
5. Apply through existing stopped-App migration/recovery mechanisms with backups, exact-source checks and generation retirement.
6. Requalify restart, rollback and negative authorization paths. Rollback requires an engine/package/state-compatible checkpoint; an older engine cannot safely read unsupported CIR state by ignoring fields.

This draft supplies no converter and performs no migration.

## 10. Outcomes and diagnostics

Successful resolution returns a plan containing resolver version, logical binding/contract, negotiated interface version, selected implementation/package hash, exact dependencies, placement and catalog/policy/environment generations. Authority remains opaque and host-issued, outside portable plan data.

Failures use the existing platform structured-result/error conventions. The following proposed CIR codes need integration with the existing error registry:

| Code | Meaning |
| --- | --- |
| `CIR.INVALID_DECLARATION` | Malformed, conflicting or unsupported metadata. |
| `CIR.UNSUPPORTED_ENVIRONMENT` | Unavailable runAt/context/profile or unqualified runner. |
| `CIR.INCOMPATIBLE_CONTRACT` | Requested interface/version/semantics cannot be negotiated. |
| `CIR.NO_IMPLEMENTATION` | No candidate survives compatibility and eligibility checks. |
| `CIR.AMBIGUOUS` | Multiple candidates share the highest rank. |
| `CIR.PIN_UNAVAILABLE` | Exact approved pin cannot be satisfied. |
| `CIR.CONSENT_REQUIRED` | Selected native function needs explicit consent before activation. |
| `CIR.STALE_PLAN` | Relevant generation changed between resolution and activation. |

Authorization denial, cancellation, lifetime expiry, resource exhaustion and native operation outcomes SHOULD retain their established subsystem codes, with a CIR stage annotation where useful. Diagnostics MUST preserve the original cause and distinguish resolution, preparation, activation, invocation and cleanup. No new code may convert an indeterminate write to success or authorize a retry.

## 11. Acceptance and conformance requirements

These are future implementation acceptance cases, not claims of tests run for this document.

| ID | Required evidence |
| --- | --- |
| CIR-01 | Existing Client/SUB normalization and explicit Server placement remain unchanged; System and subContext fail in old schemas. |
| CIR-02 | Valid System binding runs without HTTP/session state; unsupported runners and forged bindings are denied. |
| CIR-03 | Neutral ancestors can narrow to a platform; conflicting restrictions, cycles and illegal inheritance fail registration. |
| CIR-04 | Each provider satisfies the common interface's behavior, error, cancellation and side-effect conformance fixtures. Native extensions require explicit negotiation. |
| CIR-05 | Candidate enumeration permutations produce identical winners/failures. Ties fail; pins are exact; incompatible versions never win by install order. |
| CIR-06 | Known platforms select matching implementations; unknown platforms match only neutral ones. Facility absence and denied consent produce distinct results. |
| CIR-07 | Approved portable fallback preserves every required semantic feature. Native-required intent, permission denial and post-activation failure never trigger silent fallback. |
| CIR-08 | Resolution executes no candidate code or consent prompts; discovery and metadata processing stay bounded. |
| CIR-09 | Replacement, removal, restart, policy/consent revocation and stale cache/plan reuse cannot revive retired authority or cross App/site boundaries. |
| CIR-10 | Partial preparation disposes resources; cancellation and uncertain native writes retain truthful outcomes without provider retries. |
| CIR-11 | Logical object identity, ancestor membership, slot typing, concrete construction and historical serialization remain stable. |
| CIR-12 | Older loaders reject CIR-required packages; versioned migration and compatible rollback preserve accepted artifacts, receipts and lifecycle recovery. |
| CIR-13 | Cross-runtime endpoints independently enforce authentication, authority, schema bounds and ownership; no execution token is restored from JSON. |
| CIR-14 | Diagnostics are bounded, authorized and sanitized; private catalogs and native data do not leak through rejection explanations. |

Pure resolver fixtures can validate deterministic selection without native runtimes. Mocks do not qualify real device consent, OS isolation, adapters or managed-hosting security. Each claimed native platform needs integration evidence on supported configurations, including denial and lifecycle paths.

## 12. Milestone and release boundaries

| Workstream | Boundary |
| --- | --- |
| This document | Architecture draft and review artifact only. No runtime/schema change, release, deployment or task dispatch. |
| Current 0.3 foundation | Preserve existing context, site security, package and lifecycle contracts. CIR may inform later design; it is not added to current diagnostics. |
| 0.3-J | Remains Platform/App Administration. Shared BackOffice work remains in J; System/native CIR does not replace or renumber it. |
| `WYDGINE-0.3-HTTP-LIMIT` | Remains OPEN. CIR is not a demonstrated correction, deadline waiver or release qualification. |
| WydHosting 0.4 | Managed multi-tenant qualification, privileged account/provider work and the Debian VM experiment remain deferred here under accepted Decision 0003. Preserve all six outstanding security work packages and I5.6/I5.7/I5.8 obligations. |
| System runner | Separately scoped design/implementation increment. No implied privileged daemon, OS broker, scheduler or hosting deployment in 0.3. |
| Native client CIR | Later optional client/adapter program with a versioned resolver, contract conformance and explicit platform qualification. Neither 0.3 nor 0.4 gains an automatic delivery commitment. |

Wydgine remains independent of WydHosting and optional native adapters. System work that touches privileged hosting must satisfy the existing hosting boundary; using a headless runtime cannot bypass it. I5.6 remains incomplete, experimental and not security qualified. No milestone is marked complete by accepting CIR architecture.

## 13. Review and Spike E handoff boundary

### 13.1 Decisions to close before CIR implementation

1. Accept or revise `System/Headless`, subContext profile identifiers and the initial supported profile matrix.
2. Choose the exact versioned wire schemas, field spelling, loader negotiation and package compatibility requirements.
3. Confirm the initial binding surface: explicit factories/services rather than automatic substitution of arbitrary canonical objects.
4. Accept or revise specificity ordering, preference bounds, tie failure, provider pins and explicit portable fallback policy.
5. Specify capability/consent reporting and the System runner's owner, lease, cancellation and isolation contracts.
6. Assign a separate implementation milestone and supported platform evidence plan. Do not infer one from current release numbers.

These are CIR design review items. They do not require adding CIR implementation to the diagnostic spike or resolving every future native API before continuing unrelated diagnostics.

### 13.2 Spike E scope after a separate resumption

The Spike D record proposes one next investigation: partition the existing synchronous Form Clear body into **field traversal/form calculation versus runtime edit/commit**, using a deterministic single-request fixture. This is a diagnostic recommendation, not an already executed Spike E or proof that Clear causes the HTTP failure.

Any resumed Spike E must use its own bounded mission and baseline verification. Preserve the current 1,000 ms Page deadline, `SEWN.LIMIT`, caller/SEAM/Gate/Store authorization, lifecycle guards, native completion semantics and the distinction between commit and client receipt. Do not add CIR registrations, System execution, native providers, new permissions, schema migrations, scheduling changes or uncertain-write retries to that spike.

Document delivery precedes resumption. This task ends with the editable specification; no message to Cooter, test run or continuation is dispatched by creating it.

## 14. Source record

Sources were read for this draft on 2026-10-20. Repository documents are design/implementation records, not fresh runtime qualification. The linked source files remain unchanged.

- [Almond-Lab discussion](chatgpt-conversation://6ad18c85-970c-83e9-9a45-882e39081c9e): retrieved five recent exchanges establishing Client/SUB/Android, native inherited implementations, separate System execution and optional session persistence.
- [Execution-context implemented foundation](/home/brian/Projects/wydgit-platform/docs/execution-context-foundation.md): current `runat` schema, trusted placement, inherited restrictions, lifetime fencing and compatibility.
- [Execution contexts and administrative domains](/home/brian/Projects/wydgit-platform/docs/execution-contexts-and-administrative-domains.md): governing context/domain model, App identity and release boundaries.
- [Object model](/home/brian/Projects/wydgit-platform/docs/object-model.md): single inheritance, immutable prototype identity, exact construction and caller-owned method authority.
- [Founding architecture](/home/brian/Projects/wydgit-platform/docs/FOUNDING-ARCHITECTURE.md): App root, prototype identity, service dependencies and SEAM authority.
- [Decision 0003](/home/brian/Projects/wydgit-platform/docs/decisions/0003-defer-managed-hosting-qualification-to-0.4.md): accepted 0.3/0.4 split and retained security obligations.
- [0.3 release status](/home/brian/Projects/wydgit-platform/docs/milestones/0.3-release-status.md) and [long-term roadmap](/home/brian/Projects/wydgit-platform/docs/roadmap/long-term-platform-vision.md): administration, hosting, optional clients and qualification boundaries.
- [Spike D native completion gap record](/home/brian/Projects/wydgit-platform/docs/work-in-progress/http-native-settlement-gap.md): retained diagnostic evidence, open reliability issue and proposed next investigation.

## 15. Revision history

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-10-20 | Initial formal CIR review draft; separates confirmed direction, implemented contracts and proposed extension rules. Delivered before Spike E resumption. |
