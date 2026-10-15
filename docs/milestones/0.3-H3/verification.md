# H3 verification

Baseline: `69da819fb637ad1c1a6a6357e6bd293bcdba58aa`, WBasic/SEWN 0.20,
Wydgine 0.3.0-alpha.8, WydClient 0.1.0-alpha.5, WydSUB 0.1. Starting branch
`develop/0.3`; starting tree clean. Implementation is the H3 commit containing this
report (a self-referential commit hash is intentionally not embedded). This is
implementation verification, not the independent Barney audit.

## Results

- Baseline full repository suite: **736/736**; baseline content check passed.
- Final full repository suite: **755/755**, zero failures/skips/cancellations,
  using `npm test -- --test-isolation=none`.
- Focused Taskboard/shared-budget/Contact HTTP regressions: **25/25**.
- Executable client tests: **18/18**, plus **1** independent artifact conformance
  test exercising readable and minified distributions.
- Actual Google Chrome **155.0.8059.79**: **16/16** fixtures. Fourteen prior smoke
  cases are compatibility evidence; the two new H3 fixtures prove execution.
- Content checks, reproducible client builds, immutable-history tests, package
  dry run and final diff checks are part of the final gate.

The first implementation full run had three old exact API/bundle assertions and
a Contact HTTP 500 during concurrent execution. Exact API assertions now include
the new trusted accessor; bundle checks distinguish RE2's `eval` method and SEAM's
`require` method from forbidden JavaScript source evaluation/module loading.
Contact passed the isolated focused suite and the full rerun without changes to
its test, transport, deadlines or storage implementation. A subsequent default
rerun stopped reporting progress after Guestbook and was interrupted; it is not
counted as a pass. The complete suite was rerun with test-file isolation disabled.
Sandboxed socket/process
and Git-spawn failures were rerun outside the sandbox; they are not reported as passes.

## Actual browser acceptance

`taskboard.html` loads the new immutable alpha.6 artifact and static canonical JSON.
It verifies the initial two tasks, compiled navigation, a typed PageChanged event,
its private declared handler, authorized model/list updates, literal property-bound
rendering, retained keyed identity/Init count, removed-reference rejection and
Unload/reactivation. The trusted button/harness invokes approved methods; it never
implements Taskboard state transitions with JavaScript or H2 Set.

`taskboard-embedded.html` mounts two independent roots containing identical local
Taskboard IDs. It verifies foreign-token rejection, separate mutable state, unmount
during a pending invocation, invalidated old references, a surviving sibling's
navigation, remount rejection of old tokens and final teardown. DOM nesting does
not grant ownership; all prior embedded lifecycle fixtures remain green.

Warm preliminary isolated Chrome observations were approximately **46.7 ms**
bootstrap and **10.2 ms** navigation/render. A full-suite-concurrent run measured
**304.4 ms / 44.6 ms**. These single-run host measurements include browser scheduling
and are diagnostic observations, not a reliable performance claim or threshold.

## Server/browser conformance

The browser imports the same executor/controller kernels. Independent canonical
`test/fixtures/wydclient/conformance.json` runs through the Wydgine controller and
both actual browser bundle forms. `test/fixtures/taskboard/golden.json` independently
matches the compiled source family. The existing server Taskboard suite exercises
normal package installation and real TCP Page execution. Browser tests do not
compare frontend compiler output only to itself.

| Behavior | Wydgine / WydClient result | Evidence |
| --- | --- | --- |
| Typed values/parameters/returns | Equivalent; wrong types rejected | canonical probe, browser navigation denials |
| Arithmetic/Boolean/string | Equivalent | independent artifact probe |
| Arrays/collections/DateTime/regex | Equivalent | independent artifact probe and pinned static regex fixture |
| Method dispatch/declaring frames | Shared canonical implementation | Taskboard child calls, server OOP regressions |
| Visibility/hidden/requires | Shared enforcement; private hooks/handlers denied | executable negatives, canonical OOP/SEAM regressions |
| Interfaces/casts/reference identity | Equivalent supported views | independent artifact probe, retained interface suite |
| Static-library calls/private helpers | Equivalent pinned linked SEWN | independent artifact probe, static-library regressions |
| Construction/drafts/attachment | Shared bounded canonical kernel | Taskboard composition/repetition, retained construction suite |
| Instance references | Opaque and context/lifetime bound | cross-root, fake/serialized/stale/remount tests |
| Typed event emission | Equivalent nominal identity/payload checks | Taskboard and independent event fixture |
| Event ordering | Sequential registration and FIFO queued raises | independent ABC/ABCABC observations before/after Unload |
| Resource budgets | Shared terminal context ledger | browser event storm, shared-budget regressions |
| Lifecycle hooks | Init once, Preload/Render repeat, child-first cleanup | Taskboard, failure boundaries, server lifecycle regressions |
| Cancellation | Late work cannot mutate retired/inactive receivers | pending Unload/unmount, server awaited-service regression |
| Portable presentation updates | Equivalent public scalar values; literal browser text | Taskboard/injection tests; richer server HTML unsupported |
| Template repetition | Shared keyed reconciliation | reorder, invalid records, retired keys, Init count tests |
| Disposal/stale references | Equivalent permanent identity retirement | removed cards, unmount/remount and repeated cleanup |
| Services, storage, HTTP, Server/Session | **Unsupported** browser profile | staging rejection; no adapters or emulation |
| Server presentation/skins/Forms/markup each | **Unsupported** browser profile | closed portable presentation validation |
| Page events | Explicit host mapping, **not HTTP equivalence** | bootstrap/deactivation mapping documented in README |

## Adversarial coverage and boundaries

Executable browser tests cover hostile/unknown SEWN, malformed component metadata,
forged declaring owners, unverified publisher assertions, missing execution approval,
missing edit/construct/event authority, private/protected/lifecycle invocation,
wrong payload/parameter types, fake serialized receivers, wrong-root references,
remount reuse, event storms, shared event-chain exhaustion, retired keys, duplicate
keys, invalid record types/enums, literal injection, unsupported presentation,
restricted content, forbidden service/context operations, prototype-pollution keys,
Init/Preload/Render failure, failing Unload/Dispose cleanup and pending cancellation.

The retained full suite includes WBasic classes/families, independent canonical
fixtures, OOP/interfaces, friend/override rules, SEAM, event ordering/cancellation,
lifecycle, static libraries, package validation, Guestbook/Taskboard regressions and
all historical client/immutable-artifact checks. This does not claim an exhaustive
browser-specific attack test for every canonical operation, malicious same-realm
host JavaScript isolation, Firefox/Safari/native verification or external auditing.
No unrestricted host facade, DOM, filesystem, SQL, socket, npm or source-eval surface
is available to SEWN.

## Distribution and compatibility

New artifact: `packages/wydclient/dist/wydgit-client-0.1.0-alpha.6[.min].js`.
Package, lockfile, runtime-reported version, examples and size snapshots agree.
WydSUB remains 0.1; server/platform version remains 0.3.0-alpha.8. Executable browser
consumers require alpha.6; alpha.1–alpha.5 remain immutable historical distributions.
The existing Git-history guard stays enabled, including missing-history failure.
Build metadata rejects compiler/IR/HTTP/server renderer dependencies in the browser
closure. Repeated builds compare exact output hashes; packaging needs no runtime npm
dependencies.

| Bytes | Alpha.5 | Alpha.6 | Growth |
| --- | ---: | ---: | ---: |
| Readable | 102395 | 485308 | 382913 |
| Minified | 62799 | 300278 | 237479 |
| Gzip | 20792 | 96505 | 75713 |
| Brotli | 18218 | 83803 | 65585 |

Growth contains the real shared execution engine, numeric/string/collection/date
semantics, bounded RE2 regex engine, mutation/hydration, lifecycle/event controller
and ledger. The build excludes the source compiler, lowerer, authoring/installer,
HTTP machinery, server renderer and storage adapters. Further footprint tuning is
appropriate after functional conformance; no security validator was removed to
meet an arbitrary byte target.

## Remaining work

This closed profile rejects general services, storage/network operations, Server and
Session contexts, Page.Validate, non-Section/Block visual placement, presentation
attributes/expressions/service bindings/skins, markup-local repetition, raw HTML/CSS
and expanded Markdown. The WBasic frontend still emits its existing server package
claims; the browser example exports reviewed canonical definitions through the
existing browser manifest rather than silently treating a server installer manifest
as a client package. General client-target authoring/package tooling is future work.

Render rebuilds DOM while preserving canonical keyed object identity. Earlier
successful state changes are not rolled back after a later event/render failure,
matching current canonical server behavior. Root unmount invalidates synchronously;
application cleanup hooks settle best effort and may fail after budget exhaustion.
No durable delivery/cleanup guarantee is claimed on browser termination.

Recommended H4: semantic browser action/control adapters and explicit client-target
package authoring, followed by approved service profiles and footprint analysis.
Cross-origin embedding and the independent security audit remain separate work.
No tag, release, deployment, main merge or downstream edit is authorized here.
