# I2 — App resource governance and operational metering

I2 extends the existing [I0 host](../0.3-I0/README.md) and
[I1 routing boundary](../0.3-I1/README.md). Exact App ownership, package principals,
SEAM, shared nested SEWN/event budgets, services, sessions and routing remain the
security model. Governance does not grant capabilities or cross-App authority.
This is logical admission/accounting in a trusted Node process, not hard tenant
CPU, heap, scheduler, OS isolation or a commercial billing system.

## Terms and ownership

- **Limit:** maximum permitted amount or concurrency at an enforcement boundary.
- **Quota:** a limit on cumulative consumption in a defined accounting scope.
- **Meter:** measurement of actual attributable work at a stated boundary.
- **Reservation:** temporary allocation before consumption commits.
- **Admission:** permission to begin bounded work; this host has no waiting queue.
- **Usage snapshot:** cloned/frozen sanitized accumulated/current measurements.
- **Resource owner:** the trusted App/lifetime selected by the controller, not a
  caller-supplied App string, hostname, publisher, package or membership.
- **Host capacity:** shared infrastructure pressure not necessarily attributable or
  enforceable per App, including native worker pools and event-loop contention.

Meters are privately created for each validated inventory entry before activation.
They include attributed service calls during initialization/cleanup. They persist
in that controller's memory after stop/disposal for reporting. A new controller
starts a new accounting scope. **No durable counters, billing periods, reset API,
rolling windows, distributed reservations or restart-surviving outbound quotas.**

## Closed trusted resource policy

An optional `resources` object extends the existing App inventory entry:

```json
{
  "schema":"wydgit.multi-host/0.1",
  "maxPending":64,
  "apps":[
    {"id":"app-alpha","root":"app-alpha",
     "limits":{"sewnSteps":5000},
     "resources":{"maxPending":1,"httpConcurrent":1,"directConcurrent":1,"payloadBytes":100000}},
    {"id":"app-beta","root":"app-beta",
     "resources":{"maxPending":8,"httpConcurrent":4,"directConcurrent":4,"payloadBytes":1000000}}
  ]
}
```

Use the existing I1 `routing` object and a separately configured ordinary parking
App for a shared listener. The full runnable example supplies all three roots.
These technical profiles are not commercial subscription plans.

| Dimension | Default | Permitted range / enforcement |
| --- | --- | --- |
| Inventory `maxPending` | 64 | Existing 1–256 host ceiling |
| App `resources.maxPending` | Inventory ceiling | 1 through inventory ceiling; combined HTTP/direct work |
| `httpConcurrent` | App maxPending | 1 through App maxPending; admitted HTTP handlers |
| `directConcurrent` | App maxPending | 1 through App maxPending; trusted controller-bound direct service calls |
| `payloadBytes` | 1099511627776 (1 TiB) | 1–1 TiB; cumulative accepted response body bytes per controller/App lifetime |

All fields are positive safe integers. Unknown fields, null policies, negative or
unlimited sentinel values, invalid class reductions and values above ceilings fail
staging. `limits` retains I0's independent reductions of canonical SEWN/event maxima.
Ordinary per-App HTTP/service/provider settings remain authoritative; none can be
raised by these resources. Publisher metadata/query/form/content cannot change policy.
The controller clones/freezes trusted configuration and has no live policy-reset API.

The finite 1 TiB default is a compatibility-oriented lifetime allowance, not an
estimate of safe physical capacity. Operators must select useful explicit profiles.
Standalone `createApp` / `createHostApp` retain their previous behavior without an
I2 controller. A one-entry multi-App inventory supplies governance through the same
App execution kernel without changing application code.

## Admission and failure behavior

One combined I0 pool remains the source of pending-work ownership. Two supplemental
class caps permit reductions without a scheduler or queue. HTTP and trusted direct
service entries each consume one combined permit and their class permit. Canonical
services nested inside an admitted request/direct call are **not additional admission
entries**. Their actual registry dispatches are measured separately, including
implementation dependency calls. Acquisition checks and increments are synchronous;
private release callbacks are idempotent and cannot release a foreign App's permit.

Admission runs before body collection, assets, Session creation or expensive Page
work. Saturated HTTP returns sanitized no-store 503 without Retry-After or parking
fallback. Direct overload throws `HOST.OVERLOAD`. Existing retired/configuration-drift
checks run first. Exhausted HTTP allowance rejects new HTTP admission with
`HOST.QUOTA` / empty 503 before creating Sessions. Direct non-HTTP service operations
remain governed by their own admission/canonical service limits, not outbound quota.

Permits remain occupied until server work and cleanup actually finish. A client
closing a connection does not imply the kernel has stopped a pending handler or
physical I/O. Aborted-response metrics can therefore appear before `work.current`
returns to zero. Existing event/deadline/lifetime guards bound portable work and
prevent late mutation. Stop rejects new entries, drains, and on timeout retires
contexts/disconnects responses. It does not reset consumption, refund accepted
payload, resurrect permits or stop siblings. A stuck trusted native operation can
outlive the deadline; logical cancellation does not kill arbitrary host JavaScript.

## Cumulative outbound allowance

The existing kernel HTTP output port now meters string UTF-8 bytes and binary view
byte lengths at `write`/`end`. Normal Pages, errors, CSS, generated skins, platform
runtime assets, canonical file/media transfer bodies and ranges use that port.
Incremental stream writes preserve backpressure and do not buffer entire transfers.
HEAD/204/304 bodies are suppressed and charge zero, irrespective of Content-Length.

The meter reserves the **entire next chunk** synchronously before the native write:

1. Count eligible attempted bytes.
2. Check the private App balance and reserve; no await permits concurrent oversubscription.
3. Invoke the native output operation.
4. On synchronous acceptance, commit the charge (including `write(false)`, which
   means accepted with backpressure). On synchronous throw, release the reservation.

No reservation survives an await or shutdown boundary. Later disconnect/native
errors do not refund accepted bytes. Concurrent responses cannot spend the same
balance. A chunk larger than the remaining balance is rejected in full; the unused
remainder is retained, so a smaller future response/range may still fit. This policy
never rounds or estimates a charge. A zero remaining balance blocks future HTTP
admission, including otherwise zero-body requests, under the documented policy.

Before headers are sent, quota failure removes stale length/range/ETag/cookies and
ends an empty no-store 503. After a response starts, the connection is terminated;
its already accepted prefix remains charged. No replacement error body is emitted.
This can interrupt a document or transfer; clients must handle partial delivery.
Small overload responses for a selected active App also pass the same output meter
and allowance, despite not being admitted application work. Quota-denial bodies
are empty, so denial cannot become a payload-quota bypass.

**Accepted application payload is not acknowledged delivery or wire bandwidth.**
No headers, chunk framing, TLS, TCP retransmissions, downstream proxy compression
or proxy-generated bodies are counted. Output is measured before external
compression. A socket can accept more bytes than the client receives. Unknown
hosts, malformed authority/origin, unavailable targets and Node parser failures
are host control traffic before App admission and are not assigned to an arbitrary
App meter. Trusted native code outside the App port is not sandboxed or metered.

## Trusted operational snapshots

```js
const all = host.usage();              // all configured owners, including stopped
const alpha = host.usage(alphaToken);  // one-element array; exact active token only
```

`status()` retains its prior small ID/state/pending shape. `usage()` extends that
same private controller; it is not a public library, HTTP endpoint or administrative
Wydgit API. J must design administrative authorization and UI separately.
Cloned/serialized/foreign/retired tokens and additional selector arguments reject.
Host-wide `usage()` remains readable after disposal for final accounting.

Each frozen JSON row contains ID/state/pending, existing execution-limit reductions,
and the following usage fields:

| Field | Exact semantics |
| --- | --- |
| `scope`, `ageMs`, `activeMs`, `transitions` | Controller/App scope, monotonic age/activation duration and actual state transitions (initial configured counts once); terminal active duration freezes |
| `policy`, `quota` | Approved limits and exact allowance/consumed/remaining; no ability to modify them |
| `work.current/peak/failed` | Combined admitted work still running, peak and failed completed entries |
| `classes.http/direct` | Admitted/completed/failed/current/peak, overload and quota admission rejections; completed is kernel work completion, not successful delivery |
| `traffic.attemptedBytes` | Eligible body bytes attempted at the port, including a denied chunk or synchronously rejected write |
| `traffic.acceptedBytes` | Bytes accepted synchronously by native output; includes selected-App overload bodies |
| `traffic.quotaRejectedWrites/Bytes` | Denied write attempts and full lengths of those attempted chunks, not bytes delivered or merely the excess |
| `traffic.reservedBytes` | Temporary synchronous reservation; zero between output calls |
| `traffic.completed/aborted/failed` | **Admitted** HTTP response finish versus premature close; failure means status >=400 or abort. Rejected admissions are separate class counters |
| `services.<canonical ID>` | Dispatch attempts, successful/failed results, current and peak dispatches for five fixed canonical libraries; no arguments/operation labels/results |
| `execution.pages/pageStepCharges/pageLimitFailures` | Closed Page execution ledgers, aggregate shared-ledger step charges and Pages reporting SEWN.LIMIT/EVENT.LIMIT (at most once per Page, including cleanup) |
| `overflowed` | A cumulative counter saturated at Number.MAX_SAFE_INTEGER; no wrap, unsafe integer or quota enlargement |

Service attempts include registered calls rejected by version/input/authority checks;
unknown library IDs do not allocate labels. Dependencies have their own canonical
library counts. A transfer dispatch succeeds when its handler returns; later stream
failure is HTTP outcome, not a retroactively successful-delivery claim. Calls during
App initialization/cleanup are included. Raw trusted implementation access outside
registry dispatch is not part of these counts.

Page step charges include the attempted step exceeding a bound. They are not
completed instructions, CPU time, all lifecycle execution or all possible trusted
SEWN entry points. Nested Page methods/events/static helpers use the original shared
ledger and are counted once at its close. No second budget, mutable ledger exposure
or reset is introduced. Server/Session hook and raw trusted executor aggregate steps
are not reported as if measured. Limit signals outside Page ledgers are not included
in `pageLimitFailures`; this narrower measurement is intentional.

Metric cardinality is fixed: at most 16 configured Apps, two entry classes, five
canonical library buckets and fixed scalar counters. No paths, operation strings,
users, packages, search terms or arbitrary labels become keys. Snapshots contain
no tokens, contexts, capabilities, secrets, sessions, stacks, roots or providers.
Counters saturate with an explicit flag; quota balances remain exact below 1 TiB.
No per-success logging or external telemetry dependency is introduced.

## Existing resource controls reviewed

This inventory groups enforceable resource knobs; canonical syntax/type validation
remains in its existing schemas. **L** = logical limit, **P** = provider physical
allocation control, **C** = concurrent, **A** = cumulative per operation/lifetime,
**S** = persisted state. Configuration persists in trusted files; most active
counters/reservations do not survive restart. Linked modules are authoritative for
all named dimensions and exact service-specific reductions.

| Resource / owner and scope | Enforcement and default → ceiling | Failure | Measure / reduce | Kind / restart / guarantee |
| --- | --- | --- | --- | --- |
| Apps / host | I0 inventory 1–16 Apps, 64 KiB; tree 8192 entries/depth32; I1 routes256/zones16 | HOST.* staging reject | Count; fixed ceilings | S config / yes / L |
| Startup/drain/cleanup / App | 10000/5000 ms; each 10–30000; existing controller phases | HOST.STARTUP/CLEANUP, retirement | Monotonic states/duration; host knobs | C deadlines / no active clock / L |
| Combined admission / App | 64 → 256, now App/class reductions | 503 / HOST.OVERLOAD, no queue | Exact current/peak/counts; resources | C / no / L |
| HTTP headers/duration / listener | 8192 B,64 headers,120000 ms → 16384,128,300000; strictest App on shared listener | Native reject/timeout or431 | Not claimed as body/CPU meter; runtime.http | Per request / config only / L |
| URL/form/cookie inputs / request | Path2048; form32768 decoded bytes,128 entries,key128,value8192; cookies8192 text,value4096 | REQUEST.*, sanitized400/500 | No new inbound meter; fixed parser bounds | Per request / no / L |
| Encoded body / transport | URL-encoded decoded32768 bytes incl inflation; multipart1 file, declared <=16 fields, metadata8192 overhead, 1024 field bytes | Decode/transfer error, cleanup | Provider transfer policy; no new upload quota | Per transfer / no / L |
| Output / response | Tree2 MiB characters; Markdown65536 input/262144 output characters; approved legacy file16 MiB | RESPONSE/FILE.LIMIT | I2 exact UTF-8 accepted payload; existing caps retained | Per response / no / L |
| Outbound quota / App | I2 1 TiB default/ceiling, explicit reductions | Empty503 or interrupted stream | Exact native-accepted payload; resources | A controller lifetime / **no** / L |
| SEWN / shared ledger | [MAXIMA](../../../wydgine/sewn/schema.js): steps10000,time1000ms,iterations1000,expressionDepth32,nesting16,variables64,valueNodes4096,string16384,serviceCalls32 | SEWN.LIMIT terminal | Page charges; I0 `limits` reductions | A shared operation / no / L |
| Procedures / shared ledger | Calls256,depth16,parameters16 | SEWN.LIMIT | Same existing ledger/reductions | A / no / L |
| Construction / shared ledger | Drafts64,depth32,nodes256,operations512,size65536 characters | SEWN/OBJECT.*; atomic validation | Existing ledger; I0 reductions | A / no / L |
| Date/regex/program schema / executable | All date/regex dimensions in MAXIMA; program8192 nodes/65536 serialized characters; RE2 bounded work1000000 | SEWN.LIMIT/validation | Runtime knobs reducible except fixed program size/nodes | Per operation/program / no / L |
| Events / context and shared ledger | Queue64,dispatches256,handlers2048,depth16,raises256,time5000ms; shared SEWN deadline may be stricter | EVENT/SEWN.LIMIT | Page limit signals; existing reductions | C queue+A chain / no / L |
| Objects/components / tree/controller | Canonical10000 nodes/depth64; component tree256/depth32, lifetime4096 allocations; immutable retired identity | OBJECT.LIMIT | Existing runtime counters; fixed profile bounds | Per tree/lifetime / no live state / L |
| Presentation / Page | Component requests4→16; template2048 elements/depth32/repeat256/output1MiB, form traversal10000 | COMPONENT/FORM.LIMIT | Existing policy/ledger; no new DOM estimate | Per render / no / L |
| Library JSON / registry+caller | Request/response64KiB,depth32,nodes4096; Store defaults17/33MiB,depth64,nodes262144; ceilings33/65MiB,nodes1048576 | SERVICE.* before/after handler | Dispatch outcomes only; host serviceLimits + caller reductions | Per invocation / no / L |
| WydStore data / owned store | Record16MiB; query/history32→64MiB; transaction request17→33MiB/result33→65MiB; operations64; depth64,nodes262144→1048576 | STORE.LIMIT, atomic write rollback | Exact logical UTF-8 guards, not new App storage meter; store limits/caller reductions | A operation + S data / limits checked after restart / L |
| Store collection/history / owner | 10000 records incl tombstones; query10000/history10000 versions; JSON document16→64MiB | STORE.LIMIT/CORRUPT | Existing provider validation; no new counters | S / yes / L |
| SQLite / owned database | max_page_count256MiB→4GiB in4096B pages | STORE.LIMIT | Base-file allocation bound; store config | S / reapply on open / P base file only |
| Files / App+mount+caller | file8→64MiB,quota64MiB→1GiB,chunk64KiB→1MiB,objects256→4096,transfers2→8,duration60→300s,retries2→5,page20→100 | FILES.QUOTA/LIMIT; bounded serialization/stream close | Inventory logical committed bytes; existing App/mount/caller reductions | C transfers+S contents / re-inventory / L |
| Media / App/resource+caller | file8→64MiB,quota64MiB→1GiB,staging16→128MiB,uploads2→8,deliveries8→32,duration60→300s,retention15→60min,page20→40,items128→256,metadata2048→4096 | STREAM.LIMIT/QUOTA, ticket/stream cleanup | Existing provider/ledger; media context reductions | C reservations+S ledger / partial recovery / L |
| Search / owned index | Query512→2048B,document16→64KiB,batch32→64,tokens2048→8192/query16→32,page20→50,results256→1024,snippet320→1024B,index1→4MiB/docs256→1024,work524288→8388608 | SEARCH.LIMIT | Dispatch outcomes; existing options.limits | A operation+S index / persisted index checked / L |
| Gate / App identity directory | Users256,sessions1024,members/invitations256,audit/challenges128; membership max256,password minimum15–128,recovery<=15min,invitation/session TTL<=24h; Argon2 active2 per password-service instance, fixed m19456/t2/p1; member page20→50 | GATE.LIMIT/BUSY/session rejection | Registry outcomes only; no password/CPU meter | C crypto+S directory / sessions persisted, active slots not / L |
| Anonymous sessions / App | 1024 entries,1h absolute TTL, request-driven expiry; parking has no persistent Sessions | EVENT.LIMIT; new sessions denied | Not included as identities in snapshots | C process map / no / L |

Full service dimensions are in [Store limits](../../../packages/wydstore/src/resource-limits.js),
[Files](../../../packages/wydfiles/src/contract.js),
[Stream](../../../packages/wydstream/src/index.js),
[Search](../../../packages/wydsearch/src/index.js),
[HTTP](../../../wydgine/http/policy.js), [library JSON](../../../wydgine/libraries/limits.js)
and [SEWN MAXIMA](../../../wydgine/sewn/schema.js). No duplicate storage quota kernel.

## Storage assessment and operational contention

Store record/transaction budgets measure logical UTF-8 JSON, not total physical
allocation. JSON caps the entire owned document (metadata/history included), writes
a synced temporary file then renames, and uses cooperating-process locking; peak
disk can include old/new/temp data. SQLite max_page_count bounds the database base
file, not all journals/WAL/backups/filesystem overhead or aggregate App storage.
No cross-store durable allocation quota is claimed or added.

Files re-inventories committed object lengths and serializes cooperating mutations
inside a registry. Replacement subtracts the previous committed size before quota
checking; deletion releases logical capacity on the next inventory. Atomic local
rename does not make peak temporary disk usage equal committed quota. Hidden staging
files, external writes and independent registry/process writers require operational
coordination. S3 accounting is not a distributed transactional reservation. Crash
cleanup and provider metadata are not a durable unified App usage ledger. Existing
resource/ownership/atomicity regressions remain the verification baseline; no
established storage contract defect requiring redesign was found in this review.

Admission gives each App independent logical slots, **not equal CPU scheduling or
latency guarantees**. Node's event loop, native worker pool, synchronous SQLite,
JSON serialization/indexing, filesystem/network backpressure and trusted library
implementations remain shared capacity. Argon2 has its existing local concurrency
bound but uses shared native workers. Search/media/Files have existing bounded work
and concurrency; I2 does not add decorative per-service scheduler knobs. A trusted
native callback can block the process despite SEWN deadlines.

Later stronger isolation can place the same canonical App/service ownership in a
dedicated worker, process, container or deployment. I2 implements none of those,
nor persistent metering, distributed rate limits, billing, dashboards or new service
providers. J may wrap the trusted snapshots in an independently authorized admin API.

## Example and handoff

```sh
npm ci
node examples/hostname-host/governance.js
```

The command provisions two installed WBasic Taskboards and ordinary parking in a
fresh temporary directory, runs one real hostname listener, holds a canonical
Files call to demonstrate overload, exhausts the limited App's output allowance,
checks sibling/parking survival, prints sanitized snapshots, stops and cleans up.
Host instrumentation only pauses real provider work; application behavior remains
compiled WBasic/SEWN. It requires no cloud, public DNS or production certificate.
See [verification](verification.md) for browser/full regression evidence.

Platform alpha.11; WydClient alpha.8 and WydSUB 0.1 unchanged. I3 can build on this
explicit accounting boundary; durable accounting and stronger physical isolation
need separate designed contracts. No production or independent-audit certification.
