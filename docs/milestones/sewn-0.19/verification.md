# 0.19 verification — class authoring foundation

Starting commit: `15905895489e8db54cf3620d0d1ce1c0b5570fc1` on `develop/0.3`.
The starting tree was clean; fetched origin/develop/0.3 matched HEAD. Baseline
`npm test` passed 689/689, and `npm run check` passed. The first restricted
attempt encountered HTTP socket failures and was terminated; unrestricted runs
are the authoritative full-suite evidence. No failing tests were removed.

Platform remains 0.3.0-alpha.7; WydClient remains 0.1.0-alpha.3. No dependency,
manifest or lockfile version bump. Following prior language milestones, required
pretest regenerates the current client validation bundle and sizes. Historical
alpha.1/alpha.2 artifacts are unchanged. No new executable SEWN wire version:
`wydgit.definition/0.19` identifies build IR, not a runtime operation grammar.

## Files and contracts

- `wydgine/wydbasic/{parse,compile,index}.js`, new `class.js`: class parsing,
  typed Me resolution, metadata/property/method/interface/event/hook lowering,
  source locations, explicit unsupported event delivery and unchanged standalone APIs.
- `wydgine/definitions/index.js`: shared language-neutral IR lowerer; existing
  manifest, publisher verification, exact dependency pins and atomic registry acceptance.
- `wydgine/object-model/class-contracts.js`, `prototypes.js`: closed canonical
  abstract/virtual signatures, capability/hidden constraints, event owners,
  isolated lifecycle modules and exclusion of linked helpers from instance methods.
- `wydgine/sewn/execute.js`: live bound-node check before method dispatch.
- `wydgine/http/transport/hono.js`: explicit portable validator module allowlist.
- `test/wbasic-classes.test.js`, `test/fixtures/classes/{task-card.bas,golden.json}`:
  independent canonical golden artifact and reusable component source.
- Current WydClient alpha.3 distributions/sizes, CHANGELOG, canonical OOP,
  language reference, compiler documentation, SEWN documentation and this milestone.

## Executed checks

- Focused class conformance: **13 tests passed, 0 failed** using
  `node --test --test-isolation=none test/wbasic-classes.test.js`.
- Combined class/compiler/OOP check during implementation: 40 passed, 0 failed;
  later class cases are additionally included in the final full suite.
- Final `npm test`: **702 passed, 0 failed, 0 skipped/cancelled/todo**.
  Includes required `npm run build:client` pretest, all WBasic/SEWN, canonical OOP,
  interface, static-library, package/build, SEAM, current Guestbook HTTP/install/
  persistence, archived Guestbook/Taskboard source compatibility and WydClient tests.
  Archived source checks are not a complete historical host replay.
- `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- `node packages/wydclient/browser-smoke.js`: **14/14 passed** on
  Google Chrome 155.0.8059.79, including both trusted H2 instance fixtures.
- `git diff --check`: clean. Final status, stat, source/new-file and generated-artifact
  diffs inspected before the authorized commit/push.

Full HTTP tests and Chrome require outside-sandbox sockets. No tests were excluded
from the successful full run. Firefox, Safari, native targets and remote CDN were
not verified. Chrome fixtures test retained bootstrap/host behavior; they do not
exercise source-authored class events or lifecycle execution.

Current client validation bundle bytes: readable 100815; minified 61977;
gzip 20511; Brotli 17980. Baseline 93473 / 56947 / 19196 / 16848, respectively.
The increase is shared canonical declaration validation. H2 still rejects executable
class definitions; no source parser, compiler, build IR lowerer or package tooling
is added to the browser dependency closure.

## Positive and hostile coverage

The 13 class test groups cover deterministic output and manifest separation;
public/nonpublic typed defaults and required properties; generic serialization
redaction; a hand-authored JSON/SEWN golden definition with equal execution;
abstract construction denial, concrete completion and virtual dispatch through an
inherited method; original declaring-owner private access; canonical interface
conformance, Cast/Implements and stable identity; exact static imports, pinning
and helper isolation; isolated validated lifecycle modules; typed event contracts,
inherited owners and delivery rejection; caller capability/depth/count budgets
and stale bound references; scalar enums and abstract capability-preserving overrides.

Negative cases cover forged publisher approval, source/build identity/version
conflicts, incomplete manifests, unsupported META fields, reserved root names and
identity properties, unknown/foreign/cyclic inheritance, incompatible or nonvirtual
method overrides, inaccessible inherited private members, interface mismatch,
unsupported persisted types, invalid defaults/enums/required flags, duplicate and
colliding names/parameters, event type/arity/name errors, host-family metadata
injection, lifecycle calls through ordinary methods, malformed hook wire, prototype
pollution, arbitrary host-code names and unknown SEWN operations. Existing suites
retain friend/protected authorization, installation trust, serialization redaction,
recursive event bounds, cancellation, SEAM, construction and resource adversaries.

No source declaration grants authority. JSON inputs receive the same canonical
validation. Two execution boundary findings were corrected: method dispatch now
checks a bound adapter's live node, and linked static procedures no longer appear
as instance methods. Neither change adds a new authority or budget source.

## Exact runtime evidence and limitations

Ordinary compiled methods execute on the existing portable SEWN server executor
with canonical registry dispatch, typed frames and caller authority. Golden JSON
and WBasic artifacts produce equal results. TaskCard validates as a Block descendant,
materializes in a canonical App/Page/Section graph and redacts hidden/private state.
The build validates an existing application manifest and returns canonical JSON for
its existing resources.prototypes path; no new installer or automatic source-file
installation convention is added.

Lifecycle hook modules are validated and stored separately from methods; calling
Me.Init/Dispose cannot execute them. **No universal instance state controller or
automatic hook execution is implemented.** Init-once, Preload cancellation/failure,
activation/reload, repeated Render, Unload/Dispose sequencing, partial initialization,
child cleanup ordering and cleanup-exception guarantees remain unverified runtime
requirements. Existing H2 trusted removal/unmount tests remain unchanged and do
not prove application-hook execution. The README states the required controller
policy and all transition tests needed before enabling it.

Custom event contracts compile, including typed parameters, access and derived
owners. RAISE EVENT checks names/types/arity then fails explicitly with
WYDBASIC.UNSUPPORTED for all current targets. Direct class EVENT.Raise is rejected.
**No typed class event is emitted, subscribed or dispatched by this implementation.**
Accordingly there is no executable positive emission fixture, new event-storm path,
subscription-lifetime guarantee or new cross-instance emitter. Existing dispatcher
handler runs each get a separate executor budget; using it directly would not meet
the work order's shared-chain budget requirement. This is the reason for deferral,
not evidence that canonical class events execute in WydClient.

The universal root is an implicit abstract authoring contract, not an installed
prototype with runtime transitions. Existing JSON prototypes and static libraries
remain compatible. One source file defines one prototype; a trusted build script
compiles dependencies in order and writes ordinary prototype JSON. Persisted
Integer/Float/DateTime/reference properties, full composition/presentation, child
references, declarative handlers and App/Server/Session/Page wiring are unsupported.

## 0.20 handoff and delivery

The README maps each composition/binding/template/subscription requirement to its
existing JSON support or a genuinely missing runtime/schema contract. Reuse the
shared definition lowerer, canonical validators and existing package receipts.
Implement authenticated instance bindings, a trusted lifecycle controller and
one shared event-chain budget before enabling typed emission or hook execution.
Do not adapt H2 host() into a source facade. No speculative placeholder fields,
new frontend, dynamic imports, release, tag, merge or deployment are introduced.

This delivery establishes class authoring and validated contracts with the explicit
runtime deferrals permitted by the work order. It does not claim full Wydgit source
authoring, working browser class execution or the deferred positive emission and
lifecycle-transition acceptance tests. The implementation commit is identified in
the final handoff; verification cannot embed its own commit hash without changing it.
