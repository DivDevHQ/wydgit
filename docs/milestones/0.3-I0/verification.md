# I0 verification

Baseline: `e8aa7f5218e5e23e5a4289c70811b85c2ae4d304` on `develop/0.3`.
Fetch confirmed matching local/remote SHAs and a clean starting tree. The completing
I0 commit contains this report; resolve it with
`git log -1 --format=%H -- docs/milestones/0.3-I0/verification.md`.
The final handoff supplies the committed/pushed SHA. This is internal verification,
not an independent security audit or a complete multi-tenant hosting product.

## Baseline and versions

- Independently reproduced baseline: **772/772** with ordinary `npm test`, default
  process isolation, no skips/failures/cancellations, approximately 20.4 seconds.
- Platform/Wydgine moves **0.3.0-alpha.8 → 0.3.0-alpha.9**, with matching root manifest,
  lockfile, runtime reporting, sample revision and version synchronization assertions.
- WydClient remains **0.1.0-alpha.8**; WydSUB remains **0.1**. No SEWN/object/service
  wire-schema change. Historical alpha.1–alpha.8 distributions remain byte-identical.
- Environment: Linux, Node **24.21.0**, installed workspace/native dependencies,
  local sockets, complete Git history and Google Chrome **155.0.8059.79**.

## Implemented components and changed files

`wydgine/multi-app.js` validates the closed host inventory and owns private App
entries, tokens, context provenance, configuration snapshots, provider claims,
admission tracking, explicit listeners, deadlines and terminal cleanup.
`app.js` reuses existing App composition and waits for readiness, with cleanup on
partial failure. `wydgine/host.js` forwards exact App/lifetime policy to library loading.

Server-only changes in `wydgine/libraries/index.js`, `http/pipeline.js`,
`http/transport/hono.js` and `execution/lifecycle.js` enforce App/lifetime context,
close caller/dependency bindings, reject late Session/lifecycle work and clean
resources on listener shutdown. Package principal resolution still occurs through
the existing installer/runtime. No second executor/object model or grant system.

Added `test/multi-app.test.js`, library cleanup/ownership regressions and a terminal
lifecycle regression. Existing version tests were updated to assert alpha.9 exactly.
`examples/multi-app/` provisions two disposable canonical Apps and runs real loopback
listeners. Current README, host/SEAM/events/library/service/package documentation
and changelog describe the new foundation; historical H reports remain unchanged.
See [contract and threat model](README.md).

## Acceptance evidence

| Area | Positive and negative evidence |
| --- | --- |
| Host identity | Exact canonical App root IDs; unique/case-collision checks; no publisher/hostname inference; unknown/stopped selection and forged/serialized tokens reject |
| Config/root staging | Duplicate IDs, overlapping/nested/missing/traversing/symlink roots, linked contracts, missing requirements, foreign resource/dependency owner, source-directory resource paths and recovery markers reject before activation |
| Real two-App operation | `app-alpha` and `app-beta` run under one controller/process with the same Page IDs, publisher/package, installation-looking names and logical store/collection names |
| WydStore | Concurrent creation of the same local record ID stores distinct values; independent reads/counts; wrong publisher/package/capability/scope and malformed foreign-App request fail; foreign context cannot bind another registry |
| WydGate | Same username registered independently, separate App memberships; independent logins; App A token cannot resolve or authorize HTTP in App B; A logout does not revoke B; anonymous cookies create independent sessions |
| Search / Stream / Files | Distinct actual Search results and Files presence, independent scoped media upload tickets/list operations using configured local canonical implementations; another App cannot complete a foreign ticket; foreign context binding rejects for each; exact private dependency App ownership retained |
| Resource aliasing | Local resource roots cannot escape into sibling/source roots; normalized conflicting S3 namespaces reject without network startup; shared provider factory code allowed, same mutable provider object across Apps denied |
| Actual package execution | Same existing WBasic Taskboard package installed through plan/apply in both Apps with independent receipts/catalogs and publisher approval; real HTTP executes compiled navigation and typed event/subscription logic, producing distinct task lists; survivor still works after sibling stop |
| Live objects/events | Concurrent same-ID Page handles are not equivalent; B's valid canonical member read succeeds, A's handle under B context fails OBJECT.ACCESS; foreign event source fails; local event registration order preserved |
| Caller ownership | Context factory cannot return another App; controller contexts cannot specify App; cloned contexts/tokens reject; old context cannot rebind into a fresh controller with the same App ID |
| Admission/budgets | Per-App pending bound gives 503 before application processing; sibling progresses; actual terminal SEWN exhaustion affects only the reduced-budget App; context reductions cannot raise maxima or another inherited reduction |
| Graceful stop | Accepted paused HTTP work completes within drain; new selection fails immediately; Server Stop once; repeated/concurrent stop idempotent; sibling requests/services continue |
| Forced stop | Drain deadline disconnects and retires App; late awaited Page.Set rejects; retained service binding rejects; failed state cannot reactivate |
| Initialization failures | Missing approved implementation fails only that App; Server Start failure sanitized and terminal; late startup after deadline cannot publish a token or resurrect state |
| Cleanup failure | Every initialized library stop hook is attempted once even if one rejects; failed library start attempts cleanup; Server Stop error still revokes bindings and reports failed state |
| Session terminal state | Stopped App lifecycle rejects restart and late Session transition; in-memory Session owner closes on App stop; no global persisted Gate revocation or SSO introduced |

The foreign-handle test includes a successful local read with the same program and
valid production registry, so denial is not merely missing registry setup. Native
host callbacks are used only to pause/instrument real Page/lifecycle execution.
Taskboard application behavior is compiled WBasic/SEWN, not a JavaScript simulation.
Direct service calls use existing branded contexts and canonical dispatch, not mocks.

## Verification matrix

| Check | Result |
| --- | --- |
| Complete default-isolation repository suite | **794/794**, no failures/skips/cancellations |
| Focused App/library/lifecycle tests | Passing; complete suite includes all new cases |
| WBasic/IR/SEWN/SEAM/OOP/static/library regressions | Included in complete suite |
| WydStore/Gate/Search/Files/Stream and package/recovery tests | Included in complete suite, JSON/SQLite and supported local provider fixtures |
| Single-App HTTP/Guestbook/Taskboard, signals and concurrent requests | Included in complete suite; retained original entry points |
| Standalone client tests | **90/90** |
| Actual Chrome | **20/20**: compatibility/execution 16 + native local/signed/embedded/quick-start 4 |
| Content checks | `npm run check`: **3 pages, 42 internal links**, unique anchors |
| Immutable browser artifacts | History guard verifies 22 versioned files; all 23 distribution files including the current size pointer match H5 exactly |
| Build compatibility | Standard pretest rebuild reproduces pinned alpha.8 bytes; no new client distribution or source closure change |
| Package dry runs | All workspace packages; no publishing |
| Public example | `node examples/multi-app/run.js` starts two loopback listeners; both return 200 with own App title; Ctrl+C exits 0 and cleans disposable roots |
| Final review | Git status/stat/full source diff, version metadata, documentation targets and `git diff --check` reviewed |

Initial integration full run: **778/782**, with four stale alpha.8 version assertions
following the platform bump (mutation, Gate metadata and two signal-entry tests).
Those assertions were updated to alpha.9, not weakened. A subsequent full run passed
**791/791**, followed by **792/792** after the terminal lifecycle regression. Final
coverage includes remote namespace/root conflicts and direct listener-close retirement. Early focused
runs exposed example configuration omissions (prerelease pins, preprovisioned local
directories, Files schema and explicit Search source), a shutdown admission race,
and a new test expecting a rejected promise where the canonical service returns a
structured denial. These were corrected without relaxing production authority.
No test isolation setting was changed to suppress failure. A restricted nested-Git
comparison attempt failed EPERM; the successful unrestricted artifact check is
the evidence reported here. Final review also added direct-listener retirement,
retirement on configuration drift and a post-await Session owner check. The
new ticket test initially expected STREAM.DENIED; the existing App-local media
namespace correctly returns STREAM.NOT_FOUND for a foreign ticket, with no private
metadata. The test now asserts that exact result and STATE for its own pending ticket.

The ordinary `npm test` pretest still runs the established browser build/history
guard. Server-only changes do not enter that closure; unchanged build output is
verification evidence, not an unnecessary new WydClient version. Browser sizes
remain **505495 readable / 312395 minified / 100332 gzip / 86775 Brotli bytes**.

## Limits and I1 readiness

I0 is logical App ownership/lifecycle isolation in one trusted Node process.
Application budgets and pending admission are not hard CPU, heap, event-loop,
Argon2 job-pool or OS isolation. Trusted arbitrary host JavaScript/adapters can
bypass hidden-state discipline; obvious shared provider objects are rejected but
this is not sandboxing of native implementation code. Worker/process scheduling
and hard quotas remain later work.

No hostname/domain/HTTPS/proxy routing, cookie-domain provisioning, cross-App SSO,
shared grants, dashboards, billing, orchestration or production deployment. Different
loopback ports in the fixture are not browser cookie-origin isolation; wrong-App
credentials are denied by actual Gate/App ownership. I1 must define trusted routing,
origin/proxy policy, assets and cookie boundaries before public multi-site hosting.

I0 supports the five canonical server libraries. External lifecycle-instance and
legacy raw file adapters are rejected in the multi-App profile; existing single-App
APIs retain compatibility. The same package may be installed per App, but the
one-package-principal-per-Page rule remains. Reconfiguration/recovery/catalog changes
require a new controller. Stop has bounded phases and may first wait for bounded
initialization. Physical external writes already accepted may complete after timeout;
commits are not rolled back. A stuck trusted cleanup hook can outlive its deadline.
No durable exactly-once cleanup is claimed.

Local service fixtures are not a live external S3 deployment audit. No test here
certifies hostile OS mutation or complete third-party security. With these boundaries
explicit, I0 is ready as the foundation for scoped **I1 routing/origin work**.
