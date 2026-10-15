# WBasic / SEWN 0.20 verification

The supported **server authoring/execution path** completes the intermediate
`04447a026806d18e187645dc5ce4fce5e1394b62` checkpoint on `develop/0.3`.
That checkpoint had 714 passing tests and explicitly unfinished runtime gates.
The prior 0.19 prerequisite (`bb0af8e`) and immutable-distribution correction
(`127f919`) remain in history. Origin was fetched and matched the checkpoint before
final delivery. No H3 implementation or release is included.

## Implemented support matrix

“Yes” means observed execution in tests, not merely accepted compilation. All new
source constructs here compile for server. Browser “rejected” is intentional capability
failure, not an unavailable test environment. Existing H2 host trees/literal content
continue working independently of these executable component contracts.

| Capability | Compiles | Validates | Server executes | Browser executes |
| --- | --- | --- | --- | --- |
| Complete class metadata | Yes, retained 0.19 | Canonical registry + trusted build | Methods and inherited contracts | Executable classes rejected by H2 |
| Child composition | Yes | Slot/initializer/finite-default/whole-tree checks | Installer templates and NEW defaults, opaque child lookup | Component contract rejected |
| Presentation | SERVER subset | Existing presentation schema + target profile | Escaped scalar text, sanitized canonical Markdown, native ordered children | SERVER target rejected; H2 literal presentation retained |
| Property/data bindings | One-way public property reads; typed provider methods | Exact public types/visibility | Reevaluated render and separately authorized data methods/services | Executable bindings rejected |
| Reusable templates/repetition | Typed INPUT/KEY/BIND, explicit LIMIT | Closed component metadata + typed records/keys/bounds | Canonical child creation/update/reorder/removal | Component contract rejected |
| Custom event emission | Typed RAISE EVENT | Declared owner/signature + live runtime authentication | Existing queued dispatcher, caller SEAM, common ledger | No authenticated emitter; rejected |
| Child event subscriptions | Declarative BIND EVENT | Ownership/event/handler contract | Active-only registration, original source, teardown | No authenticated callbacks; rejected |
| App/Server/Session/Page bindings | Actual Page names; Server/Session with trusted build policy | App pseudo-source rejected; privileged names/root policy checked | Page native queue; explicitly authorized verified App-root Server/Session bridge | Server/Session impersonation rejected; Page execution awaits H3 |
| Init / Preload / Render | Isolated hook modules | Canonical lifecycle + opaque entry | Init once per hydration, activation policy, repeated render | No authenticated controller; rejected |
| Unload / Dispose | Isolated hook modules | Canonical lifecycle + runtime lifetime | Detach/invalidate, child-first cleanup, idempotent disposal, cancellation | Only retained H2 host cleanup, no application hooks |
| Complete Taskboard family | Six source classes + existing manifest | Full build/installer/reload + independent golden | Full supported acceptance below | Executable family rejected pending H3 |

There is no canonical App event family to implement. App roots are eligible owners
of genuine Server/Session subscriptions only through trusted host configuration.
These are not ordinary Page/child events and do not transfer authority. Cleanup is
best effort at crashes/network loss, not durable exactly-once delivery.

## Taskboard acceptance: all supported-server checks pass

`test/wbasic-taskboard.test.js` contains **17 passing groups**. The six source classes
are TaskRecord, TaskModel, TaskCard, TaskList, Navigation and Taskboard. Their
existing manifest requests authority independently approved by the installation host.

| Required acceptance | Evidence |
| --- | --- |
| Package compilation | Trusted build helper compiles all six `.bas` files in dependency order; deterministic canonical resources |
| Prototype validation | Canonical registry checks public typed properties, inheritance, slots, presentation, events/templates/subscriptions |
| Installation | Existing planner/apply pipeline installs generated resources into a temporary application; reload works after source package removal |
| Instance construction | Canonical entry template hydrates; ordinary NEW also constructs default Model/List/Pager children before attachment |
| Child order/slots | Model, List, Pager source order; dedicated TaskList blocks slot accepts TaskCard, max 8; incompatible/overfull/cyclic contracts fail |
| Typed properties | Required Key/Title/Status and Status enum; Integer event argument validation; wrong values rejected |
| Presentation | Actual native server response contains bound task titles/status, escaped scalar templates and native child rendering |
| Data binding | Public typed LoadTasks method populates List.Tasks; template binds each validated record into public TaskCard properties |
| Typed emission | Pager.GoToPage raises PageChanged(Integer) with authenticated original receiver/declaring event |
| Subscription/handler | Taskboard private handler receives typed payload, updates CurrentPage and calls Model/List children under caller SEAM |
| TCP host integration | Packaged WBasic Page.PreRender navigation executes over real HTTP on repeated independent requests; absent host publisher verification returns 403 |
| Changed rendering | Page 1 has two cards; page 2 has one different card; page 3 is empty. Real Page.PreRender invocation yields updated response |
| Ordering | A later native Page.PreRender handler observes old selection before the queued class event; final rendering observes updated selection |
| Lifecycle | Card InitCount stays 1, Stage follows Preload/Render/Unload/Dispose; activation is idempotent, Unload/reactivation preserves identity |
| Removal/disposal | Removed cards become disposed before reuse; keyed reorder retains identity, reappearing removed keys get new identity; child teardown precedes parent |
| Unauthorized operations | Missing edit/construct/event capability/scope, cross-App context, wrong payloads, direct private/hook calls and forged entries fail closed |

The independent handwritten `test/fixtures/taskboard/golden.json` contains canonical
JSON plus SEWN for the **entire** family. Normalized artifacts compare exactly with
source output. Both families execute the same activation, navigation, rendering and
cleanup sequence with equal observable state/output/errors. This is a reusable
frontend conformance fixture, not a static screenshot or compiler-output snapshot
masquerading as an independent implementation.

## Security, resources and compatibility

Four shared-budget test groups verify exact-context opaque tokens, cumulative SEWN
steps across separate handlers/nested raises, fatal exhaustion, actual shared service
and NEW construction limits, cancellation of awaited work, and effective event depth
across nested native dispatchers/default boundaries. The latter cannot reset depth
by creating another dispatcher. A Page request shares one ledger through all phases,
defaults, hooks and cleanup. Standalone host operations share a ledger across their
nested work. Independent operations receive independent ledgers, as documented.

Taskboard negatives and retained 0.19/family/security suites cover unverified publisher
claims, metadata disagreement, invalid inheritance/slots/prototypes/initializers,
private/hidden/restricted bindings, malformed/null arrays, serialized owner spoofing,
prototype-pollution keys, dependency/composition cycles, missing bounds, key collisions,
wrong record types/enums, unsupported targets, inaccessible methods, context/entry
forgery, event recursion, disposed/expired receivers and late async mutation.

Init/Preload failure invalidates the owned tree. A throwing child Dispose cannot
skip parent/host cleanup; errors do not disclose the thrown secret. Repeated Dispose
is harmless, subscriptions do not survive Unload/Dispose, retired identities cannot
be reused, and queued work cannot resurrect an object. Existing member visibility,
caller-authority static libraries, package approval/receipts and SEAM contracts remain.
No historical security assertion was removed or weakened; the old emission-rejection
expectation is replaced by actual authorized lowering plus server runtime tests.

Canonical validators, not just the compiler, reject hostile component metadata and
finite-default cycles/cardinality errors. Compiler family diagnostics retain file,
line/column, error code and declaration for invalid typed templates/repeat limits.
No token/native-reference/private-value details are serialized in diagnostics.

## Final verification

- Full `npm test`: **736 passed, 0 failed, 0 skipped/cancelled/todo**.
- Focused native events + Taskboard + shared budgets: **32/32 passed**.
- `npm run check`: **3 complete pages, 42 internal links and unique anchors**.
- Actual Chrome 155 alpha.5 smoke fixtures: **14/14 passed**. These prove retained
  H0/H1/H1b/H2 behavior, not browser execution of the Taskboard.
- H2 test explicitly rejects component metadata before exposing a mounted host.
- Full suite includes WBasic parser/compiler, 0.19/family/golden fixtures, canonical
  validators, closed SEWN execution/schema, OOP/interfaces/static libraries, SEAM,
  events, presentation/server rendering, package planning/install/rollback, Guestbook,
  archived Taskboard/Guestbook, WydClient and immutable-artifact guard regressions.
- Repeated alpha.5 builds reproduce the same bytes; existing committed alpha.1–alpha.4
  distributions and versioned size reports remain byte-identical. Missing history
  still fails closed; no guard bypass is introduced.
- `git diff --check`, complete source/test/doc diff and final file inventory reviewed.

An earlier full run hit the unchanged S3 65 ms deadline test's exact phase-count
assertion under load (735/736). Its isolated suite passed **33/33**, and the final
full rerun passed **736/736** without changing that test or its deadlines. Inherited
default composition also received a regression correction before this final pass.

Sockets, Git-history operations and Chrome use authorized outside-sandbox execution.
No required suite is being marked unavailable or skipped. Firefox/Safari/native
execution, production deployment and an independent exhaustive security audit were
not performed and are not claimed.

## Versions and deliberate limits

Platform **0.3.0-alpha.8** is the executing compatibility floor for the new closed
component contract; older runtimes must not silently accept inert metadata. Root
manifest, lockfile, README and content revision agree. Shared IR is deliberately
`wydgit.definition/0.20`; canonical component schema is `wydgit.component/0.20`.
Existing SEWN wire schemas and presentation schema remain unchanged.

Shared browser-validator dependency changes require new immutable **WydClient
0.1.0-alpha.5** files and current example references. Its standalone closure rejects
server component metadata and contains no H3 controller. WydSUB stays 0.1. Measured
alpha.5 bytes: readable **102395**, minified **62799**, gzip **20792**, Brotli **18218**.
There is no tag, public release, publication, deployment or merge to main.

Supported source presentation is SERVER-only. Foreign package default templates and
arbitrary visual slots retain existing installer/renderer restrictions. Source Form
presentation replacement with composed fields/blocks is explicitly rejected until a
native placement contract exists. There is no two-way generalized binding or durable
lifecycle guarantee. Earlier successful state/service changes are not rolled back by
later handler/reconciliation errors. These are explicit limits, not silent rendering
fallbacks or claimed browser parity. See the [H3 handoff](wydclient-handoff.md) for
precise browser enforcement points and conformance work; no H3 work is implemented here.
