# Modular BackOffice actions — 0.3-J increment 5

Platform/Wydgine/WydHosting **0.3.0-alpha.20**, Gate **0.1.0-alpha.6**,
Store **0.1.0-alpha.5**. WydClient remains alpha.11; canonical service API versions,
SEWN and persisted store/catalog schemas are unchanged. This records the site-level backend
framework at increment 5. [Increment 6](backoffice-http-and-ui.md) adds its secure
HTTP transport and generic action shell; full ADM-01 coverage remains incomplete.

Read with [execution domains](execution-contexts-and-administrative-domains.md),
[placement and lifetime](backoffice-placement-lifecycle.md),
[site policy and stores](backoffice-scoped-policy-and-store-authorization.md),
[reviewed native policy](reviewed-package-policy-reconciliation.md),
[package lifecycle](package-lifecycle.md) and [canonical services](canonical-services.md).

## Descriptor and contribution contract

An ordinary installed server package can declare optional `backofficeActions` in
its manifest. Packages using it must require `>=0.3.0-alpha.20` (normally also
`<0.4.0`) and declare only the server runtime. Accepted historical manifests and
resource bytes are unchanged. No independent mutable action registry exists.

Each declaration has exactly these fields:

| Field | Meaning |
| --- | --- |
| `id` | Local lowercase name, unique across this package's contributions |
| `owner` | Exact managed Wydgit instance ID with exact declared visibility |
| `title`, `description`, `category` | Bounded plain text and local navigation category |
| `context` | Exactly `BackOffice` |
| `permission` | Required live site WydGate permission |
| `capability` | Independent required SEAM capability, matching the trusted service |
| `scopes` | Nonempty subsets of declared logical library resource requirements |
| `service` | Fixed `{library, apiVersion, operation}` binding; omitted from discovery |
| `effect` | `read` or `write`, matched against trusted library classification |
| `input`, `output` | Closed bounded JSON value contracts |
| `confirmation` | Optional text; mandatory for write actions; invocation must explicitly confirm |

These are requirements and presentation metadata, never grants or approvals.
Neither declaring an administrator role nor naming a capability can issue authority.
There is no executable callback, filesystem/export selector, arbitrary service
selector from a request, new permission language or package JavaScript execution.
This first increment binds existing canonical services directly; custom action
workflows and multi-step orchestration are deferred.

Canonical ID: `package#instance/local-action`. Discovery returns
`wydgit.backoffice-action/1` descriptors with that ID, the local `name`, package
version, instance, metadata above (except implementation binding), and an exact
`wydgit.backoffice-reference/1` reference. The reference pins canonical App,
package, installation receipt ID, instance, local action, execution generation and
SHA-256 revision of declaration/receipt/policy revision. It is portable stale-check
data, not a bearer capability. Never silently refresh it during invocation.

Contracts support objects (`fields`, optional field-name list), bounded arrays
(`items`, `maxItems`), strings (`maxLength`), bounded safe integers (`min`, `max`),
booleans and null. Unknown fields reject recursively; input must be an object.
There are no coercions, regex expressions, executable validators, arbitrary JSON
values, floating-point contracts or UI widgets. Fields can use camelCase. Contract
nesting is at most six; objects have at most 32 fields, arrays 256 elements and
strings 4,096 characters. Declarations are bounded to 32 per package and 32 KiB.

## Trusted registration and service extension

The existing installer validates declaration shape, duplicate IDs, requirement
subsets, managed instance ownership, inherited prototype/instance restrictions and
fixed operation availability before publication. Unsupported update bindings fail
planning, leaving the source installation and action set usable. Package identity,
accepted artifacts, receipt, provenance and exact App come from the existing catalog.

Trusted canonical/approved libraries opt operations in through an exported frozen
`administrativeOperations` map (`operation: 'read' | 'write'`) and the corresponding
`administration` service-registration policy and an `administrativeAuthorize`
admission callback. The callback reuses the service's existing live policy for the
action's resolved required resources without modifying state. Installation checks the exported map,
manifest capability and API version; activation independently checks the actually
registered service. Adding an eligible operation is a trusted library change with
its own security review. Services must return authorized portable data; credential,
recovery-token, raw host-policy and native lifecycle APIs are not opted in.

Gate opts in `list-members` and `manage-member`. Store opts in its existing logical
record operations, preserving all ownership/scope/policy/concurrency checks. Opt-in
is availability metadata, never a SEAM grant. No ordinary package can register a
runtime library or provide handlers through this mechanism.

Native adapters import `createBackOfficeActions` from `wydgine/trusted/packages`:

```js
const actions = createBackOfficeActions({root, libraries, installationContext});
const discovered = await actions.discover({app, session: opaqueSessionToken});
const result = await actions.invoke({
  app, session: opaqueSessionToken,
  reference: discovered.value.actions[0].reference,
  input: {offset: 0, limit: 20}
});
```

`installationContext` is an independently issued, exact-App native host context
with `packages.lifecycle.manage` and `packages.placement.manage`. It stays private;
it is never the contributed operation's caller. The factory builds an immutable
snapshot from installed active BackOffice placements, with at most 256 active
actions per site. FrontEnd and retired placements contribute no registrations.
Neutral packages may retain dormant declarations when relocated to FrontEnd;
declarations do not establish BackOffice placement. AccountAdmin/HostAdmin reject.

Rebuild the factory and library registry after stopped-App lifecycle/configuration
changes. Old factories fail closed for changed installations; they never resolve
an old reference to a replacement instance. Registration is reconstructed from the
catalog, so recovery cannot accumulate duplicate mutable registry entries.

## Discovery, invocation and principal preservation

`discover({app, session, offset?, limit?})` returns a structured result containing
`wydgit.backoffice-discovery/1`, App, authorized action descriptors, offset, limit
and total. Default/max page size is ten, offset is 0–256. The response is bounded
to 64 KiB. Unavailable actions expose neither descriptors nor denial details.
An invalid/expired session fails the request. The trusted service also authorizes
the contribution's required resource scopes before disclosing metadata; a weaker
package-declared permission cannot bypass protected service policy. Operation-specific input/target checks
still occur at invocation; discovery does not promise a future request will succeed.

Every request resolves the opaque token through this site's real Gate session
service. Request fields cannot supply identity facts, roles, another principal,
execution context or a service name. A narrow native session-resolution binding
has only `gate.sessions.use` for this exact App; it is never used for the action.

For each contribution, execution acquisition validates current exact installation,
active BackOffice generation, complete accepted tree and inherited restrictions.
Its capabilities and concrete scopes come from the approved receipt. Only host
resource-limit reductions are inherited. The resolved initiating identity is
attached unchanged. The action checks its capability, approved logical scope subset
and live Gate permission before dispatch. Trusted operation admission independently
checks Gate roster requirements or Store ownership and collection policy on the
required scopes. Discovery snapshots grant nothing.

Invocation repeats those checks, compares the complete reference, validates input
and confirmation, then invokes only the installed fixed binding through existing
versioned caller-bound service dispatch. The underlying service checks its own
capability, exact scope/owner tuple, current Gate policy and operation rules.
Store access cannot borrow the native operator's identity, private Gate binding or
another package's storage authority. After the service settles, lifetime and current
Gate policy are checked again before publishing a successful result.

The first version executes one fixed canonical operation. It charges the existing
SEWN execution ledger's `serviceCalls`, checks its existing deadline/lifetime, and
applies existing reducible service request/result JSON limits. The outer request
is at most 48 KiB, depth 12 and 2,048 nodes, before copying/access. Service limits
can further reduce it. Input/results are copied, deeply frozen and validated;
accessors, non-JSON values, dangerous keys, cycles, handles, extra output fields and
oversized output reject. Native service trust remains necessary: a contract cannot
recognize a secret hidden inside an otherwise valid authorized string.

`invoke` returns `{ok:true,value}` or `{ok:false,code,message,details:{}}`, never a
successful wrapper around a failed service result. Framework codes include
`ACTION.DENIED`, `ACTION.STALE`, `ACTION.INVALID_REQUEST`, `ACTION.INVALID_INPUT`,
`ACTION.INVALID_RESULT`, `ACTION.CONFIRMATION` and `SEWN.LIMIT`. Existing service
failure codes remain available with generic text; host exceptions/details do not.

## Mutation, host authority and lifetime

Write actions require explicit `confirmed:true`. This expresses user intent only;
it is not review, host approval, idempotency or revision evidence. Required record
versions and any service review/stopped-App rules remain mandatory. No universal
transaction, retry, approval or reconciliation executor is added.

Native package-policy plan/review/apply remains completely outside action services.
An ordinary BackOffice execution cannot call those native functions with its
package context, mint host capabilities, manufacture approval or turn a Gate role
into host authority. No fake proposal/review bridge is provided.

Each admitted discovery/invocation holds the existing same-process App execution
lease until all work and final authorization checks settle. Stopped-App replacement
and policy maintenance refuse while an action is admitted. Durable catalog/config
fences additionally reject obsolete generations, retained removal, recovery
barriers and foreign installations. Compatible updates, same-context replacement,
relocation, retirement and reinstall use existing lifecycle journals and fresh
execution acquisition; retention preserves data, never execution authority.

The lease is not a distributed/process lock. Trusted operators must stop and drain
other processes. A deadline/fence cannot undo an already admitted native side
effect. Post-operation denial, output failure or lost response can follow a committed
write; inspect the underlying service state before retrying. Publication, recovery and rollback now use the same stopped-App reservation as
reviewed policy; legacy install and general package operations cannot cut through
an admitted action. Underlying Store
optimistic concurrency and Gate audit behavior remain intact. No background action
scheduler, forced provider cancellation or distributed hot replacement is claimed.

## Demonstration and future UI integration

`examples/backoffice-members` is an ordinary server package contributing the genuine
current-site member roster. Install through the existing package lifecycle with
trusted `serverPlacement:{app: canonicalAppId, context:'BackOffice'}`, approve its
exact declared grants, and use an existing provisioned Gate membership service.
The caller needs an active administrator/owner membership, live session, explicit
`gate.members.manage` permission and independently approved capability/site scope.
The action returns bounded membership facts, never credentials or session data.
It uses the same declarations, installer, discovery and dispatcher as other packages.
The example adds no UI and performs no identity bootstrap or self-approval.

Future renderers can group by `category`, display metadata, render the small closed
input contract, submit the exact reference, show structured results/errors and ask
for `confirmation`. A future HTTP adapter must use the existing exact-origin,
CSRF, credential-cookie, transport/admission and response controls. This increment
adds no HTTP entry point, navigation page, browser credential surface, alternate
administration product, AccountAdmin, HostAdmin or managed hosting qualification.

## Qualification and acceptance

`test/backoffice-actions.test.js` and its real installation fixtures cover:

| Mission cases | Evidence |
| --- | --- |
| 1–7 | ACT-01/04/05: installed ownership, native admission, dormant FrontEnd, inherited restrictions, unknown references, collisions, malformed/unsupported declarations |
| 8–13 | ACT-01/02/06: authorized/private discovery, stale discovery, real dispatch, missing current permission/capability/scope |
| 14–20 | ACT-01/02/05/11: wrong context/site, forged request principal and receipt, expiry, revoked membership/session and role/group changes |
| 21–26 | ACT-01/03/09: pinned contract/generation, retired/relocated/removed references, replacement, retained reinstall and SIGKILL recovery on both providers |
| 27–29 | ACT-01/08/13: malformed/oversized/accessor input, closed output and invalid host values, reducible budgets |
| 30 | ACT-10 plus existing scoped Store suites: independent protected service policy, exact private-store ownership and create/update revision conflicts remain mandatory |
| 31 | ACT-05/07: unsupported native operation binding, package caller denied native policy authority |
| 32–34 | ACT-03/09/10/11: canonical site/session/reference isolation; JSON/SQLite lifecycle and recovery |
| 35 | Existing full public HTTP/client regression suites; FrontEnd relocation also retains ordinary execution profile |
| 36 | ACT-04 plus existing execution-context/placement suites: AccountAdmin/HostAdmin unavailable |
| Additional | ACT-07 explicit mutation failure/confirmation; ACT-12 admitted-action maintenance exclusion and pre-service revocation; ACT-13 service/deadline budget reductions; ACT-14 independent modules; ACT-15 weaker declaration cannot bypass service discovery policy |

ADM-01 is **partial**: backend modular registration/discovery/dispatch is qualified;
graphical administration and end-user transport remain deferred. CTX-05/CTX-06,
GAT-02/GAT-03, STO-02 and LIF-01 are qualified only for the implemented site/backend
and existing local lifecycle subsets. No wider domain, OS containment, production
migration, cross-process drain or full administration UI claim follows.

Existing installations pinned to earlier library releases require the normal reviewed
library/package upgrade workflow and fresh registries; this release does not edit
accepted receipts or silently bless dependency drift.

Validation on Node 24.21.0:

- Baseline full suite: **1,429 passed / 3 failed / 1,432 total**. Failures were
  the existing JSON/SQLite Contact and hosting operational HTTP 500 cases.
- Full integration suite after implementation: **1,455 passed / zero failures**.
- Dedicated action suite: **23 passed**, including real protected Store mutation
  conflicts and separately installed module contributions.
- Focused action/lifecycle/policy/launcher/HTTP run: **148 passed** before the
  last discovery strengthening; subsequent action/library/protected Store run:
  **61 passed**. These are separate runs, not additive totals.
- `npm run check`: three complete pages, 42 internal links, unique anchors.
- Dependency graph, whitespace, relative documentation links and generated-artifact
  checks passed. Historical client and regex artifacts remain unchanged.

An expanded local-tarball trial, run concurrently with the full suite, passed all
23 installed action cases but had **174 passed / 5 failed / 179 total** in its
broader integration set: Guestbook, JSON/SQLite Contact and hosting HTTP failures,
plus a bounded file-transfer timeout. Deadline/budget assertions were preserved;
this is retained reliability evidence, not a closure claim. The unchanged expanded
set subsequently passed **179/179** when run separately, including all 23 action
cases through installed package exports; the installed provider set passed **35/35**.

The first full implementation run had 1,448 passes and five failures: the new
admission regression exposed the missing general lifecycle reservation, and four
launcher/transport fixtures still expected alpha.19. Publication reservations and
release expectations were corrected without weakening assertions, followed by the
complete passing run. A later isolated Store fixture syntax error was corrected
before its passing qualification run. Sandbox listener/native-process failures
are not functional qualification evidence; suite counts use authorized local
execution with the required listener/subprocess access.

The existing
[SEWN.LIMIT HTTP reliability issue](milestones/0.3-reliability.md) remains open even
when a complete run passes.
