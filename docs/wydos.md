# WydOS platform independence foundation

**Status:** Proposed architecture and contracts; no WydOS implementation, manifest
extension, discovery endpoint or platform adapter is delivered by this milestone.
**Contract draft:** `wydos/0.1` (document identity, not a runtime requirement).

**Platform independence by default. Platform-specific behavior only through
explicit, controlled capabilities.** Target systems are Linux (including Almond
Linux), Microsoft Windows and Apple macOS. Targets are goals, not support claims.

## 1. Architecture and existing foundations

WydOS is an optional OS-facing services abstraction, not a replacement kernel,
distribution, execution engine or second authority system. Ordinary Wydgit
applications describe intent without knowing the host OS. Portable contracts define
behavior independently of adapters; trusted adapters translate approved operations
to native APIs. WydOS must not depend on Almond Linux, WydHosting or any desktop.
Almond is a possible reference integration, not the definition of portability.

The logical operation path is:

```text
Wydgit application → WBasic/SEWN → SEAM execution → WydOS services
                  → platform adapters → host operating system
```

This is a responsibility diagram, not a new executor or transport. WBasic compiles
to SEWN; Wydgine owns server execution and transport, WydClient owns client
execution/adaptation/presentation, and SEAM owns authority. Canonical libraries
remain optional dependencies, outside the small core. Inheritance defines identity;
dependencies provide services. Libraries provide capabilities; SEAM grants authority.

The browser desktop is an ordinary client of these services, never a privileged OS
component. A future local browser desktop and a remotely accessed webtop may share
contracts. Neither browser origin nor local loopback implies host authority. A
standalone WydClient application remains valid without Wydgine or WydOS; unsupported
services need an explicit fallback or a declared runtime requirement. WydClient
currently has no canonical server-service transport; this document creates none.

### Reconnaissance and contract ownership

| Existing foundation | Observed contract and WydOS consequence |
| --- | --- |
| [Canonical services](canonical-services.md); `packages/wydgine/src/engine/libraries/` | One host-approved registry, declared operations, exact service API versions, caller-bound dispatch and bounded JSON results. Extend this machinery; do not introduce another registry or arbitrary imports. |
| [SEAM](seam.md); `packages/wydgine/src/engine/seam/` | Host-issued execution context, exact three-segment capabilities, scoped resources, limits and deny by default. Discovery cannot construct contexts or grant authority. |
| [WBasic](wydbasic.md), [SEWN](sewn.md), [static libraries](wydgit-static-libraries-spec.md) | Existing literal `SERVICES.Invoke` compiles to validated SEWN. Utility/static libraries cannot confer authority. No new `OS` global is implemented or required. |
| [WydFiles](wydfiles.md); `packages/wydfiles/src/contract.js` | API 1.0.0 virtual paths, scoped mounts, binary transfers, declared provider semantics and quotas. Reuse these instead of a second filesystem. |
| [WydStore](wydstore.md) | API 1.0.0 logical stores/collections, resource mappings, JSON/SQLite providers and explicit concurrency/durability limits. Reuse for application records; keep file bytes in WydFiles. |
| [WydGate membership](wydgate-membership.md), [identity assurance](wydgit-identity-assurance-spec.md) | App-scoped identity/session contracts; authenticated identity and membership never grant SEAM authority or OS identity. Reuse rather than creating WydOS accounts. |
| [Events](events.md), [packages](packages.md) | Existing lifecycle/event dispatch and staged install/activation. Reuse those boundaries; neither is a general durable scheduler. |
| [Founding libraries](FOUNDING-ARCHITECTURE.md#14-canonical-wyd-libraries) | WydNotify, WydQueue and WydAPI are proposed library families. Their notification, background-task and network contracts below are proposals, not implemented providers. Gate lifecycle notifications are not desktop notification delivery. |
| [WydHosting I5.6](milestones/0.3-I5.6/README.md) | Private Linux provisioning/control, not a public canonical service. Existing broker/manager protocols must not become application APIs. |

This document owns the proposed cross-platform semantics, discovery model,
portability analysis and roadmap. Existing service specifications remain authoritative
for implemented APIs; the [founding architecture](FOUNDING-ARCHITECTURE.md), SEAM and
WydHosting containment contracts remain authoritative for their boundaries. Future
code should reside in the owning canonical library/provider; residual OS-specific
services may use a host-approved `wydos` library under existing package conventions.
No package, npm name or core module is reserved or created here.

### Existing platform assumptions

WydFiles uses slash-separated **logical** case-sensitive paths with conservative
ASCII syntax, not POSIX host paths. Its local provider uses trusted Node filesystem
operations and encoded backing keys; S3 has separate limits. Neither is evidence of
Windows/macOS integration compatibility. Preserve its syntax, logical case behavior,
non-atomic copy/move and lack of persistent empty directories. Native mapping must
handle case collisions, reserved host names, confinement and links without changing
application-visible identity or silently aliasing resources.

WydStore's JSON/SQLite capacities and persistence guarantees differ; native Node
dependencies need per-platform verification. WydClient's browser storage/interaction
and Wydgine's server runtime targets remain explicit. WydHosting's Unix sockets,
SO_PEERCRED, descriptor-relative Linux operations, systemd, cgroups and SELinux are
controlled implementation details, not portable WydOS primitives. Existing Linux
qualification evidence does not qualify another OS or distribution.

## 2. Portable service contracts

### Shared boundary rules

Reuse canonical service IDs, literal operation names and exact API versions.
Resources use existing logical names or opaque JSON identifiers. IDs identify
resources; possession of an ID never authorizes access. Host mappings choose local
or remote providers. Do not expose drive letters, host paths, Registry keys,
systemd units, launchd labels, native handles, PIDs or arbitrary command arguments.
No universal `execute`, shell, filesystem, SQL, socket or npm escape hatch exists.

All new operations must declare closed input/result schemas, capability and scope
requirements, size/time/concurrency limits, and safe errors before implementation.
Use existing `{ok:true,value}` / `{ok:false,code,message,details:{}}` envelopes,
JSON copying and existing `SERVICE.*` / `SEAM.DENIED` errors. Domain-specific codes
below are proposals, not additions to the implemented dispatcher. Unsupported
behavior must fail explicitly, never fall back to a stronger or weaker native API.
Do not leak host paths, secrets, stacks or inaccessible-resource existence.

Each adapter must preserve the advertised API's semantics and limits. Optional
features need separate discovery entries; OS branding cannot imply them. Specify
mutation outcomes and safe retry rules; a timeout does not prove an operation did
not occur. Preserve existing storage completion contracts. No cross-service
transaction, hard native cancellation or exactly-once side effect is implied.

### Service families and minimum semantics

Operation names for new families are design candidates, not final published APIs.
Existing families retain their actual names and API 1.0.0 until explicitly revised.

| Family / owner | Portable interface and result | Authorization and failure semantics |
| --- | --- | --- |
| Files / WydFiles | Retain `stat`, `exists`, `list`, `read`, `read-range`, `write`, `delete`, `copy`, `move`, using logical `path` and existing binary transfers. User-selected files may later use scoped virtual mounts or opaque selections translated into WydFiles resources. | Existing `files.storage.read/write/list/delete`, accepted path scopes, host grants and mount policy all apply. Proposed `files.user.read` is a separate user-selection operation, never an alias granting storage or arbitrary host reads. No native path returned; selection cancellation grants nothing. Preserve `FILES.UNSUPPORTED` for `mkdir` and existing partial-move behavior. |
| Application storage / WydStore | Retain logical stores, collections, record IDs, query/update/transaction APIs and concurrency results. Distinguish transient, client-local and server-authoritative state. | Existing exact `store.records.read`, `.create`, `.write` and `.delete` capabilities and logical mappings remain. Host binds App and accepted installation identity where required. No cross-App data, raw database handles, SQL or implicit local/server synchronization. Quota, conflict and durability semantics follow WydStore. |
| Identity and sessions / WydGate + trusted Session | Reuse safe current-identity projections and Gate API 1.0.0 login/logout/session operations; opaque App-scoped account/session references, expiry and revocation. | Trusted Session supplies identity, never request owner fields. OS login and Gate accounts are distinct. No automatic federation, desktop SSO or credential export. Local/remote rules are in section 4. |
| Notifications / proposed WydNotify | Candidate `send({channel, title, body})` returns an opaque delivery reference and `accepted` state. Host binds a logical channel to the intended user/session and presentation destination. | Proposed `notifications.messages.send` plus channel/user/App scope. Bounded plain text, no arbitrary executable actions, host URLs or cross-user broadcast. Acceptance is not display/read confirmation; suppression, disconnected sessions and unavailable destinations have explicit outcomes. No delivery guarantee or durable queue implied. |
| Application lifecycle / existing package and event machinery | Candidate status and close-request operations address a logical App/installation or current session. Report running/closing/stopped only where observable; close request is not a process kill. | Separate exact observation/control capabilities and App/installation/session scopes must be specified before publication. Preserve provision-first/activate-last and owner dependency consent. Session close, package disable and backend stop are different actions. No universal self-install, restart-host or arbitrary launch command. |
| System information / proposed WydOS service | Candidate `information({fields})` returns bounded semantic facts such as supported contract versions and effective resource limits, with explicit units and unknown values. | Proposed `system.information.read` and approved field scope. Prefer operation discovery to host identification. No hostname, OS fingerprint, account list, environment variables or raw process inventory in the portable baseline. |
| Authorized service management / proposed WydOS service | Candidate `service-status({service})`, `service-restart({service})` use a host-issued logical service identifier and return observed state or a tracked operation reference. Restart completion requires an explicit completion result. | Proposed `system.services.read` / `system.services.restart`, exact service scope, per-user/App policy and separately authenticated management authority. Host maps approved resources to fixed operations. No caller-selected units, executable, configuration or shell. Unavailable unless a separately reviewed management boundary exists; I5.6 exposes none to Wydgits. |
| Background tasks / proposed WydQueue | Candidate `submit({task,input})`, `status({job})`, `cancel({job})` address registered task definitions and opaque jobs. States: queued, running, succeeded, failed, cancelled; cancellation may remain pending while running. | Proposed `tasks.jobs.submit/read/cancel` plus task/job/App/installation scope. Host constructs a fresh limited context and rechecks authorization at execution; queued requests do not retain obsolete session grants. No uploaded executable, indefinite session lease or native scheduler identifier. Delivery/retry/durability profiles must be explicit, with idempotency before retries. |
| Network / proposed WydAPI, existing approved network libraries | Candidate bounded `request({endpoint,operation,input})` uses host-approved logical endpoints and operation schemas. Reuse existing semantic libraries (e.g. WydStream) for their domains. | Proposed `network.requests.send` plus endpoint/operation scope, request/response budgets and concurrency limits. Host validates destinations, DNS resolution, redirects, TLS and secret injection; deny SSRF/private or metadata destinations unless separately approved. No raw sockets, arbitrary proxies or browser-origin authority inheritance. |

`storage.application` is a useful discovery **family label**, not a valid SEAM
capability: the existing grammar requires exactly `domain.resource.action`.
`notifications.send` is likewise a two-segment intent label; the proposed grant is
`notifications.messages.send`. Discovery can map that intent to the exact capability;
this metadata is never an alias or wildcard grant. `files.user.read` and
`system.services.restart` fit the grammar but remain proposed grants, not accepted
manifest additions. Existing file/store grants stay unchanged. New names require
canonical ownership review before publication.

### Illustrative WBasic usage — proposed services, not runnable examples

Keep the existing literal `SERVICES.Invoke` form. This example proposes a discovery
operation and notification service; neither service below is installed. `1.0.0`
is an illustrative future API version, not an implemented WydOS version.

```basic
EVENT Page.Load
  DIM support AS Object = SERVICES.Invoke("wydos", "1.0.0", "describe", {"intent":"notifications.send"})
  DIM sent AS Object = {}
  IF support.ok THEN
    FOR EACH entry IN support.value.entries
      IF entry.state = "available" THEN
        sent = SERVICES.Invoke("wydnotify", "1.0.0", "send", {"channel":"current-user", "title":"Task saved", "body":"Your task is ready."})
      END IF
    NEXT entry
  END IF
END EVENT
```

The host must bind `current-user` to the authenticated intended destination, not
trust that string as identity. Discovery may fail or be denied. Successful discovery
never removes invocation authorization; the send may still fail. The example's
fallback is the existing in-App status, with no notification side effect. Current
WydFiles calls such as `SERVICES.Invoke("wydfiles", "1.0.0", "stat",
{"path":"/documents/task.txt"})` retain their implemented server-only contract.
No example establishes a client transport, parser extension or SEWN version change.

## 3. Versioned discovery and capability negotiation

Extend the existing trusted registry's `list/get/capabilities` metadata with an
App/context-bound, bounded discovery projection through the same canonical dispatch.
Do not expose raw handlers, registry objects, private services or host configuration.
A proposed `wydos` `describe` operation at illustrative API `1.0.0` accepts a single
intent identifier or a bounded explicit list; no global host enumeration is required.
It requires a separately approved `system.capabilities.read` capability and App scope.
Its implementation must not probe privileged operations or install providers.

Illustrative result value (proposed wire schema):

```json
{
  "schema": "wydos.discovery/0.1",
  "revision": "opaque-snapshot",
  "entries": [{
    "intent": "notifications.send",
    "state": "available",
    "service": "wydnotify",
    "apiVersion": "1.0.0",
    "operation": "send",
    "capabilities": ["notifications.messages.send"],
    "executionTarget": "server",
    "resourceLocation": "session-client",
    "portability": "portable",
    "limits": {"messageBytes": 4096},
    "reason": "SUPPORTED"
  }]
}
```

The example's limit is illustrative; each published API must define effective
bounds and units. State is `available` (configured provider offers the exact
operation/profile), `unavailable` (known operation not offered) or `unknown` (not
recognized/cannot determine safely). A known unsupported API returns the existing
version failure; unknown discovery schema versions fail explicitly. Unavailable
entries may use stable reasons such as `PROVIDER_ABSENT`, `VERSION_UNSUPPORTED` or
`TARGET_UNSUPPORTED`; redact sensitive metadata. An unknown result is never support.

Version negotiation means comparing advertised exact API versions with the caller's
explicitly supported versions and selecting an exact match. Do not implement ranges,
concurrent providers/versions or automatic highest-version fallback here: the current
registry exposes one exact API version per library. Discovery schema, service API,
library package, platform runtime and adapter implementation versions are distinct.
A future registry extension needs its own compatibility decision.

Discovery reports availability, **not effective permission grants**. It must not
return a synthetic `authorized:true` promise. Invocation checks the live context,
exact capability, resource policy, user/session state, limits and adapter enforcement
every time. Revision is a cache hint, not an authority token. Provider removal,
revocation or changed session destination can invalidate a result immediately;
handle explicit denial/unavailability after discovery without escalating authority.

Platform-specific entries must declare `portability:"platform-specific"` and a
platform profile, using distinct grammar-conforming names (for example a future
`linux-services.units.inspect`). They cannot alias a portable intent unless they
meet that portable contract in full. Optional portable capabilities can be absent
on any OS; even Linux branding never implies service control or notification support.
No adapter may silently substitute host-specific effects for portable behavior.

## 4. Authorization, sessions and containment

All authority is least privilege and deny by default. Capability approval, resource
scope, authenticated user/domain policy and native enforcement are independent gates.
Host-issued context fields (App, publisher, package, principal, installation, identity,
scopes and limits) remain authoritative. Missing required installation/user/session
identity denies; request fields cannot replace it. An owner role, OS account,
trusted publisher or supported capability never grants SEAM authority.

No privilege laundering through libraries, platform adapters or background tasks is
permitted. Existing host-bound inter-library dependency contexts remain separately
approved infrastructure authority. A service using such a dependency must first
authorize the originating request/resource and restrict the downstream request to
that approved operation; it cannot make arbitrary resources available just because
its dependency context has wider grants. No caller may request an elevated context.

Privileged operations require an independently authenticated, narrowly scoped
management boundary, fixed validated operations and auditable request/outcome records.
Audit records bind actor, App/installation, logical resource, operation, policy
revision, correlation ID and outcome (including indeterminate results), without
credentials or native paths. Required audit failure must refuse admission; recovery
must reconcile operations whose completion is unknown. No public portable API may
accept arbitrary shell commands, scripts, executable paths or native manager data.

Local sessions need authenticated App/origin binding, expiry, revocation and protection
against other local users and browser origins; loopback is not authentication.
Remote sessions need authenticated encrypted transport, origin/CSRF/replay defenses
where applicable, bounded lifetime and explicit server/user/device destination binding.
A webtop notification or file selection must identify whether it concerns the server
or the session client, without returning native paths. Disconnect/reconnect must not
transfer grants or user selections to a different session. Keep session secrets in
trusted Session/transport state, not portable properties, logs or discovery output.
No new desktop SSO, remote management transport or session federation is specified.

OS adapters enforce the contract through reviewed native controls appropriate to
each OS; SEAM checks are not substitutes for kernel containment. Linux adapters must
respect SELinux, DAC, scoped identities and the existing privileged-manager architecture.
Missing confinement must fail closed for profiles that require it. Never disable
SELinux, broaden worker authority or fall back to an unconfined helper for portability.
Windows/macOS enforcement designs and implementations are future work.

The [I5.6 broker](milestones/0.3-I5.6/broker-security.md),
[SELinux model](milestones/0.3-I5.6/selinux.md) and
[constrained manager design](milestones/0.3-I5.6/constrained-systemd-authority.md)
remain authoritative. The manager has offline foundation slices, not an activated
containment transition; indirect broker manager authority remains an unresolved gate.
This milestone neither exposes that authority nor claims it is fully contained.
Do not modify, restart, reconfigure or weaken the I5.6 guest, broker, manager, systemd
integration or SELinux policies. WydHosting stays independent of WydOS; its private
operations cannot be reused by merely adding a public capability name.

## 5. Package portability validation

Extend the proposed [package validation architecture](wydgit-package-distribution.md)
and [`wydgit validate`](wydgit-cli-spec.md#validate), not the active manifest schema
or installer. The future validator should consume package requirements, inspect
source/validated SEWN and linked static-library dependencies without execution,
and compare them with versioned target service profiles. Validation must not load
untrusted providers, provision adapters or grant permissions. Source-only analysis
must report that compiled/link-time evidence is missing rather than imply completeness.

Proposed requirement records should identify service ID, exact API version, operation,
intent/capabilities, required versus optional use, client/server target, resource
location, fallback reference and platform-profile restriction if any. This is a
conceptual extension, **not accepted manifest syntax**. Retain existing runtime targets,
`platform` runtime ranges, `requires.libraries`, requested `permissions.capabilities`
and scopes; an OS name must not overload the existing platform-version field.

The analysis must:

1. Compare required WydOS operations and semantics/limits with each target profile;
   distinguish unsupported, unknown and supported-but-requiring-authorization.
2. Detect platform-specific service calls and follow dependencies, including static
   libraries and trusted provider/native dependency declarations. Hidden or unresolved
   dependency behavior produces unknown evidence, never a portable conclusion.
3. Check Wydgine/WydClient, SEWN, service API and dependency version requirements,
   and whether the target runtime can reach the required service/resource location.
4. Check optional adapter availability without installing it. Packages request approved
   services; host policy selects adapters and controls native dependencies.
5. Check that optional calls have linked fallback implementations or an explicit
   safely disabled feature. Analyze fallback calls/dependencies too. A comment or a
   manifest fallback label alone is insufficient. If reachability cannot be established,
   report uncertainty; static control-flow analysis cannot prove all runtime behavior.
6. Produce per-target explanations, evidence gaps and remediation. Keep signature,
   trust, SEWN validity, installation approval and runtime authorization as separate gates.

### Portability tiers and reporting

| Tier | Requirement |
| --- | --- |
| Portable | Uses only supported cross-platform Wydgit/WydOS contracts in the declared runtime/profile matrix, with no required host-specific calls or dependencies. Support still depends on required capabilities being deployed and authorized. |
| Conditionally portable | Optional capabilities/adapters, explicit fallbacks or safely disabled features are needed on some targets; report exactly which features and conditions differ. |
| Platform-specific | A required path depends on host-specific capabilities unavailable elsewhere, with no compatible fallback. Report the restricting platform/profile. |

Report a tier separately from evidence state (`static-candidate`, `integration-tested`,
`unknown`, `incompatible`) for each target and feature set. A missing required
portable provider can make one deployment incompatible without making the App
intrinsically platform-specific. Unknown dependencies must prevent an unconditional
portability conclusion. Optional native integrations do not taint the baseline if
the verified fallback preserves its declared functionality; report their conditions.

For example, a report might state: “Windows desktop baseline: incompatible;
`packages/report/export.bas`, required `wydfiles` API 1.0.0 `write` has no provider in
the supplied profile. Bind a conforming provider or supply an export fallback.” A
separate diagnostic might say: “Linux-only service inspection required through
`linux-services.units.inspect`; replace it with a portable status contract or make
the feature optional and provide a fallback.” Authorization pending is not “OS
unsupported”; a denied operation is never permission to try a stronger adapter.

Machine-readable reports should include report schema/tool version, package artifact
hash, dependency lock identity, target-profile versions, diagnostic code/severity,
source or dependency chain, affected feature, reason and suggested change. Test
evidence should bind the same artifact/dependencies, runtime, adapter and OS versions,
profile, features, outcomes and date. Changing them requires reassessment.

Adding Linux/Windows/macOS names to a manifest is only a claim. Static validation is
not proof of runtime compatibility. A universal claim across these targets eventually
requires platform-specific integration tests of the declared feature/profile matrix,
including case/path behavior, storage conflicts, unavailable capabilities, denial,
session expiry, resource limits and native containment. Until then, report an
untested static candidate, not universal compatibility or security qualification.

## 6. Phased roadmap and open decisions

| Phase | Deliverable and exit condition |
| --- | --- |
| Foundation (this milestone) | Document responsibilities, service reuse, discovery/authorization separation, portability rules and unresolved decisions; documentation review and required repository checks. No runtime changes, version bump, release or deployment. |
| Contract stabilization | Review operation schemas, capability ownership, errors, limits and target/destination semantics with existing library owners. Define discovery schema fixtures and target profiles; retain exact registry API semantics. Approve future manifest changes explicitly. |
| Tooling foundation | Add read-only portability analysis to the proposed validation toolchain, with dependency/fallback diagnostics and evidence-bound reports. Exercise unsupported/unknown/denied distinctions without privileged host operations. |
| Linux adapter proof | In a separately authorized milestone, reuse existing services and implement the smallest unprivileged adapter/conformance suite on Linux including an Almond reference profile. Resolve native path and semantic mismatches explicitly; do not depend on WydHosting qualification. Privileged service management remains unavailable pending its own manager/security gates. |
| Windows and macOS adapters | Future independent implementations of the same reviewed contracts and OS-specific enforcement, tested on actual supported systems. No implementation or native dependency introduction in this milestone. |
| Desktop/webtop integration and qualification | Separately review local/remote session binding and transport; integrate ordinary WydClient surfaces. Run per-platform integration/security tests before compatibility claims; privileged profiles need independent containment qualification. |

Unresolved questions intentionally requiring later evidence:

- Which residual OS operations belong to a `wydos` library versus WydNotify/WydQueue/
  WydAPI, and what are their final capability owners and exact API schemas?
- How should user-selected files map to existing WydFiles scopes, selection lifetime
  and revocation without exposing native paths or weakening mount confinement?
- What task retry/durability and notification delivery profiles can each adapter
  actually promise? How should lifecycle requests interact with active sessions?
- Which client transport/session destination binding supports both local desktops and
  webtops without turning a server response into unintended local OS authority?
- What minimum OS/runtime/adapter matrices and test-evidence expiry rules justify
  compatibility claims? How will case-sensitive virtual identity be maintained on
  each native filesystem?
- How will the future constrained manager be qualified and independently authorized
  before any public service-management contract can be enabled?

These are gates for later specifications and implementation, not permission to
invent a runtime, weaken containment or change the existing application model.
