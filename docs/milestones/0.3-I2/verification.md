# I2 verification

Baseline **7a223b94ad7826b8bc49e82b9ce6c48e92cca43f**, branch `develop/0.3`.
Fetch confirmed matching local/remote state and a clean working tree. Independently
reproduced baseline: **808/808**, ordinary default-isolation `npm test`, no skips or
cancellations, 24.3 seconds. Baseline client90/Chrome25 were inherited I1 evidence;
they were independently rerun against the final implementation as described below.
The completing commit contains this report; resolve it with
`git log -1 --format=%H -- docs/milestones/0.3-I2/verification.md`.
Internal review/test evidence is not independent security certification.

## Versions and scope

Platform/Wydgine **0.3.0-alpha.10 → 0.3.0-alpha.11**. Root package/lockfile, runtime
reporting, sample revision, exact version assertions and current docs agree.
WydClient remains **0.1.0-alpha.8**, WydSUB **0.1**; no SEWN/object/protocol schema
change, browser compiler, network capability, third-party dependency or new frontend.
All historical browser distributions remain byte-identical.

Existing controls and storage guarantees were inspected in the host/controller,
HTTP output/forms/transfers, SEAM, shared SEWN/event ledger, object/controller,
canonical library dispatch and five service implementations. The
[contract inventory](README.md#existing-resource-controls-reviewed) records defaults,
maxima, ownership, enforcement, reduction options, measurement, persistence and
logical/physical distinctions. No second SEWN or storage quota system was added.

## Implementation and files

- `wydgine/governance.js`: closed finite policy reductions, private fixed-cardinality
  meters, atomic synchronous output reservations, saturating counters, lifecycle
  duration and frozen snapshots. No reset or caller-supplied ownership/label API.
- `wydgine/multi-app.js`: reuse exact App entries, combined I0 pending ownership,
  supplemental HTTP/direct caps, trusted `usage()` reporting and state transitions.
- `app.js`, `wydgine/host.js`, `libraries/index.js`: host-only canonical registry
  dispatch observation including dependencies and transfers, preserving all original
  capability/resource/identity checks. Nested dispatch does not reacquire admission.
- `http/metered-output.js`, `http/transport/hono.js`: incremental native-accepted
  payload accounting and quota enforcement through the existing output port,
  HEAD/304 suppression, empty503/partial-disconnect behavior and outcome observation.
- `execution/page.js`, `http/pipeline.js`: observe closed existing Page ledger step
  charges and Page limit signals once, including shared nested methods/events and
  cleanup. No global executor/ledger redesign or browser budget-code change.
- `test/governance.test.js`, `test/tenant-governance.test.js`: focused policy,
  metering, ownership, concurrency, binary delivery, cancellation and real host tests.
- `examples/hostname-host/governance.js`: runnable disposable technical resource
  profiles using installed Taskboards, actual canonical Files provider work and
  the I1 shared hostname listener.
- `scripts/verify-hostname-browser.js`: repair test-only closed-upstream race during
  HTTPS-to-local-HTTP fixture transition. No production proxy/origin policy change.
- Current README, changelog, host/SEAM/HTTP/service/example docs and I2 reports;
  historical I0/I1/H reports preserved.

## Exact accounting and quota semantics

Policy dimensions are combined `maxPending`, `httpConcurrent`, `directConcurrent`
and cumulative `payloadBytes`. All are finite positive safe integers; concurrency
only reduces the existing inventory ceiling. The outbound default/ceiling is
1 TiB per controller/App lifetime, with explicit smaller demonstration/test policies.
Counters include actual attributed startup/cleanup dispatches and remain readable
through trusted host-wide usage after disposal. Only a new trusted controller starts
a fresh accounting scope. No persistent/monthly/distributed billing meter.

Payload means UTF-8 strings/binary bytes **accepted synchronously by the native
output boundary**, before external compression. It excludes headers, framing,
TLS/TCP, retransmissions and confirmed delivery. Whole chunks reserve/commit without
await, refund only synchronous native rejection and never oversubscribe. Accepted
bytes are not refunded after disconnect. A denied chunk retains unused remainder;
exact zero blocks new HTTP work before Session creation. Unknown/invalid/foreign-
origin routing input is host traffic, not accepted tenant work. Selected-App
admission-overload bodies are charged through the same port; quota-denial bodies
are empty. No buffering of streamed responses.

Service counts are canonical registry attempts and result outcomes, including
validation/denial/dependency calls. Transfer handler success does not claim successful
stream delivery. Page step charges include the attempted exhausting step and are
not CPU time or all possible Server/Session/raw host SEWN execution. These narrower
measurements are explicitly named and documented, not represented as global totals.

## Acceptance and hostile evidence

| Area | Production-path or focused evidence |
| --- | --- |
| Closed policy | Unknown/null/negative/nonfinite/over-ceiling dimensions reject; class caps cannot raise combined admission; original limits remain enforced |
| App ownership | Private controller entries issue all meter bindings; foreign/cloned/serialized/retired tokens deny; same names in another controller do not transfer authority or consumption |
| Output correctness | Actual Pages/errors/assets/ranges, UTF-8 writes, HEAD/304 and canonical Files binary delivery use one output boundary; no Content-Length estimate |
| Cumulative quota | Exact ten-byte exhaustion before further Session creation; streamed chunk denial retains committed prefix; eight individually affordable concurrent responses spend one shared allowance without oversubscription |
| Alternate entry | A second explicitly bound App listener cannot evade the same shared-listener allowance; new trusted lifetime resets its own meter and rejects old tokens |
| Cancellation | Client disconnect during asset streaming retains accepted bytes, releases real file/permit cleanup, records abort; disconnect before output charges zero while still-running work remains admitted |
| Shutdown | Stop during paused work retires App, rejects stale token, preserves balance/reservation accounting, and late completion releases only its old permit; sibling continues |
| Reservation safety | Native-write throw refunds only uncommitted allocation; write(false) commits; idempotent release cannot produce negative/double completion; synchronous stopping transition leaves no pending reservation |
| Sibling survival | Real held canonical Files.stat saturates limited App; excess HTTP503 and direct HOST.OVERLOAD occur without Session creation or parking fallback; sibling executes installed WBasic Taskboard, Gate login/session resolution and owned Store record operations |
| Restoration | Releasing actual provider work restores limited-App admission; independent stop leaves sibling and parking operational |
| Dispatch/budgets | Service denials counted as failures, with no data/unknown labels; actual compiled SEWN exhausts a reduced shared Page ledger and reports charges/limit failure |
| Snapshots | Deeply frozen cloned fixed-key data, no paths/providers/tokens/contexts/identities/secrets; unknown selectors deny; safe-integer saturation reports overflow rather than wrapping |
| Parking/routing | Parking bytes belong only to parking App, which emits no credentials; unrelated/foreign-origin requests are not admitted or assigned to another tenant |

I0/I1 regressions retain cross-App object/event/context/service denial, independent
Gate/storage/Files/Stream/Search scopes, exact proxy peers/origins, CSRF, host-only
cookies, installed package authority, unavailable-host denial and bounded drain.
The new service hold is trusted instrumentation around a real local Files provider,
not a mock-only isolation claim or JavaScript Taskboard implementation.

## Verification matrix

| Check | Result |
| --- | --- |
| Final complete repository suite, default process isolation | **823/823**, no failures/skips/cancellations |
| New governance unit/integration tests | **15/15** focused, no skips |
| I0/I1 focused compatibility | **33/33**, initial integration run |
| WydClient unit tests | **90/90**, existing client-runner isolation unchanged |
| Existing Chrome smoke | **16/16** actual versioned alpha.8 |
| Existing Chrome controls/signing/embedded/public CLI | **4/4** |
| HTTPS/local HTTP routing Chrome | **5/5** |
| Total actual Chrome | **25/25**, Google Chrome155.0.8059.79 |
| Content validation | `npm run check`: **3 pages,42 links**, unique anchors |
| Package dry runs | **7/7** workspace packages; no publishing |
| Immutable history guard | **22 versioned files**, existing fail-closed history policy |
| Full browser distribution comparison | **23/23 files** byte-identical to I1, including size pointer |
| Reproducible browser build | Existing repository/client pretests rebuild pinned alpha.8 identically |
| Public resource-profile example | `node examples/hostname-host/governance.js` exits0 after actual overload, quota, sibling/parking, snapshots, stop and cleanup assertions |
| Final review | Full source/security/new-file/version/doc diff and `git diff --check` |

Environment: Linux, Node **24.21.0**, installed workspace/native dependencies, complete
Git history, authorized local sockets and Chrome subprocesses. Browser HTTPS uses
real loopback TLS with a disposable self-signed certificate validation exception,
not public CA or domain-ownership validation. No cloud or live public DNS dependency.

The first focused run passed7/10: tests needed canonical INPUT.JSON acceptance for
nonfinite JSON, an actual multi-statement SEWN workflow rather than a nonexecuting
literal Page, and waiting for server-side stream cleanup after client abort.
Those corrections retained strict quota/authority assertions. The first full run
passed **821/821**. After adding binary coverage, a full run was **821/822** because
one new normal-asset test assumed one event-loop turn completed asynchronous file
cleanup. It now waits for the actual pending counter to release, still requiring
zero and exact byte totals. Disconnect assertions deliberately distinguish native
acceptance from client-received bytes rather than requiring false equality.

The binary fixture initially failed closed on a missing required canonical Block
content property; the fixture was corrected without changing validation. Final policy review also corrected null-valued optional
resource dimensions so they reject instead of silently selecting defaults. The first
routing browser rerun exposed an existing test proxy dereferencing a closed
upstream during fixture transition. It now returns503 for that late test request;
all original HTTPS/origin/cookie/browser assertions remain. An intentional late
cancelled response also exposed noisy fallback writing to a destroyed output; the
transport now returns its already-ended response without a second write. A later full run was **822/823**, with a500 from the existing concurrent JSON
Guestbook submission regression. Its focused suite passed **4/4**. Inspection found
an orphaned Chrome process from the earlier uncaught proxy-fixture crash; that
specific disposable process/profile was cleaned up. A subsequent unchanged default
run passed **823/823** (22.2 seconds). The precise cause of the Guestbook transient
was not established; neither a fixed timing defect nor permanent reliability is
claimed from a rerun. This remains a recorded test-contention observation, not a
weakened execution deadline. No tests
were removed/skipped or repository isolation changed to conceal failures.

Browser bytes remain **505495 readable /312395 minified /100332 gzip /86775 Brotli**.
No client version bump or historical artifact overwrite.

## Findings, limitations and I3 readiness

- Reliable per-App concurrency and lifetime output quotas are implemented. Fair
  admission means independent logical slots, not guaranteed CPU scheduling, latency,
  event-loop availability, heap isolation or hard physical network bandwidth.
- SQLite synchronous work, JSON/search serialization, Argon2/native worker pressure,
  filesystem/network and trusted adapters still contend process-wide. Dedicated
  workers/processes/containers/deployments need future explicit isolation design.
- No durable usage reset period, cross-provider aggregate storage quota, distributed
  reservation, billing, admin endpoint, dashboards or new providers. Existing Store,
  Files and Stream logical/physical limits are assessed in the contract; temporary
  files/WAL/journals/external writers are not hidden inside a false allocation claim.
- One existing concurrent JSON Guestbook full-suite transient remains an unconfirmed
  test-reliability observation; focused and later default runs passed unchanged.
- Global Server/Session/raw trusted executor step totals are not measured. Page-ledger
  charges and reported Page limit failures are the trustworthy implemented subset.
  Direct raw trusted native implementation calls outside canonical registry/HTTP
  boundaries are not sandboxed or represented as metered portable execution.
- Host control traffic rejected before App binding is not tenant bandwidth. Native
  output acceptance is not acknowledgement; partial responses may be interrupted.
- Forced retirement is logical and bounded; a noncooperative native operation may
  finish later. No exactly-once crash cleanup, rollback of committed external writes
  or production/independent-audit certification.

I3 may build operational lifecycle/capacity controls on these explicit policy and
snapshot contracts, or design stronger process boundaries. Durable accounting,
commercial plans and J administration authorization remain separate work. No
unresolved authority-model change was required for I2.
