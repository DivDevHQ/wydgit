# HTTP reliability Spike H — canonical mutation

2026-10-20. Baseline `d674f304a818cf589980cb192f8b979cd013c79d`, branch
`develop/0.3`. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No version, deadline,
CIR, package artifact, native completion or uncertain-write contract changes.

## Audit and bounded correction

The portable `object-model/mutation.js` factory owns the edit session. Page handles
first check invocation/lifecycle/budget, Page ownership, writable response state
and member access. The factory checks the live context at setup, operation and
commit; authorization checks exact capability, visibility and edit grants before
reading/changing affected objects. Installation guards remain in `checkContext`.
There is no authorization cache. Unchanged values follow the same ordinary setter
path. Form Clear's previously qualified comparison helper is unchanged.

Setup dehydrates the original immutable runtime, builds its original-ID index and
reserves IDs. Each operation previously hydrated that private working envelope,
dehydrated the resulting runtime to obtain an isolated candidate, applied the
operation, hydrated the candidate and dehydrated the accepted result. Commit
checks revision exhaustion/conflict and hydrates once more with the next revision.
This is `2M+1` complete hydration/semantic validation passes and `2M+1` dehydrate
passes for M successful operations and one commit; initial setup contributes the
extra dehydrate, commit the extra hydrate.

The first per-operation hydration repeats established structural work. Its input
is either an internal dehydrate of the original validated runtime or an internal
dehydrate of the last successfully validated candidate. Neither is exposed or
changed in place. PrototypeRegistry's private definitions are immutable. Caller
inputs still enter only through `clean`/`copyEnvelope`, followed by complete
candidate hydration. Required candidate validation includes property types/defaults,
Form ancestry/unique names, execution restrictions, tree identity, containment,
slot type/cardinality and canonical limits. Commit validation/publication remains
independent. Failed candidates never replace accepted state.

The selected server Page adapter reuses the existing mutation factory and existing
`copyEnvelope` defensive copier. A private marker recognizes only the exact accepted
working envelope during its pre-operation copy. The copier still checks envelope
shape, descriptors, JSON values and containment bounds; it omits prototype resolution,
property normalization and semantic Form reconstruction of unchanged input. The
marker is never a public runtime, input envelope or execution handle. New candidate
outputs are not marked: they must pass full hydration before becoming accepted.
The next-revision commit always takes the real hydrator. No hydrated tree,
authorization result or installed-policy stamp is cached between operations.

Only Page's two edit setup sites use this adapter. `systemSet`, component-controller
edits, portable runtime edits and package lifecycle mutations retain their existing
paths. The shared instance controller is also part of the frozen WydClient import
closure; changing it or the portable mutation factory would require a separately
versioned client. This spike leaves that closure byte-for-byte unchanged. There
is no second mutation implementation, new transaction API or implicit batching.

Every ordinary Page setter still commits before returning, so retained handles,
subsequent reads, dependent operations and later callbacks see each intermediate
state. Form operations keep their existing single explicit session/commit contract.
Each committed snapshot is newly hydrated and immutable. Runtime revision remains
request-local and is not an authoritative persistent head. Native writes are
independent of Page snapshots: failure after native commit still yields an
indeterminate HTTP 500 and never an automatic retry or claimed rollback.

Rejected alternatives: bypassing unchanged setter authorization; updating published
nodes in place; skipping candidate or commit validation; retaining a mutable hydrated
candidate after a failed operation; Page-wide batching; generation-only installation
caches; editing frozen shared-client sources/distributions. All extend the proof
surface or change an existing boundary unnecessarily.

## Evidence and reproduction

[Machine-readable evidence](../../test-support/http-canonical-mutation-spike-h-evidence-2026-10-20.json)
contains distributions and every window summary. Its SHA-256-pinned
[source archive](../../test-support/http-canonical-mutation-spike-h-source-2026-10-20.json.gz)
contains all eight canonical captures, both 19-capture HTTP series, exact runtime
sources and the offline packager. Historical D/E/F/G evidence is untouched.

Run each experiment alone; every destination must be new:

```sh
node test-support/canonical-mutation-probe.mjs /tmp/NEW-canonical.json after off
node test-support/canonical-mutation-probe.mjs /tmp/NEW-observed.json after on
node test-support/prerender-integrity-probe.mjs --output /tmp/NEW-http
```

Repeat the off capture in three fresh processes. The baseline canonical capture
uses the archived helper that delegates to `runtime.edit`; the HTTP baseline uses
the unmodified Spike G Page. Reproduce those bytes in a disposable checkout rather
than overwriting local changes. The archive retains the packager with its exact
argument usage. Canonical captured sources are hashed individually; HTTP sources
are pinned by the existing G supervisor. No source changes occurred during a
capture. The server helper is retained in the corresponding canonical sources.

Environment: Node v24.21.0, Linux 7.0.0-38-generic, AMD Ryzen 7 7735HS, 16 logical
CPUs, default four-worker libuv pool, local temporary filesystem. Host load and
preemption are uncontrolled. Restricted-sandbox HTTP workers could not produce
usable request evidence and were excluded; native-access workers completed with
no fixture failures, drops or hook errors. Initial harness assertions incorrectly
compared ordinary objects with normalized null-prototype JSON; corrected before
all retained captures. Two initial test expectations misunderstood shared lifetime
fences and Page finalization rejection; corrected without runtime changes. An
offline packager initially treated a false diagnostic flag as an array; fixed
before packaging. No passing rerun overwrites a captured HTTP failure.

## Deterministic canonical results

The 48 cases cross 7/69 nodes (2/64 Form fields), 1/16 edits, changed/unchanged
values, string/nested-object/array values, and one session versus individually
committed setters with immediate scoped reads. Nested property updates replace the
whole value, as before. A session's `changes()` is read between operations; its
original runtime remains unchanged until commit. Tree size and serialized bytes
are recorded per case; the large initial tree is 25,779 JSON bytes.

Each off case has three warmups and nine measured samples in each of three fresh
processes (27 samples). A separate observed process has the same warmups/nine
samples and existing G module hooks. No suite or other experiment overlaps a
retained performance capture. Off imports install no hooks; the benchmark's equal
performance.now brackets, read assertions and change reports remain in both paths.
Timings below are **off**, in ms, median / p90. Full min/p99/max, raw samples,
per-process medians and observed timings are in evidence.

| Nodes | Edits | Values / publication | Mutation before → after median | Total before median / p90 | Total after median / p90 |
| --- | ---: | --- | ---: | ---: | ---: |
| 7 | 1 | changed string, one commit | .473 → .197 | .838 / 1.585 | .409 / .474 |
| 7 | 16 | changed strings, one commit | 3.787 → 2.538 | 4.413 / 7.895 | 3.085 / 3.732 |
| 69 | 1 | changed string, one commit | 3.185 → 2.090 | 5.476 / 9.643 | 4.202 / 7.098 |
| 69 | 16 | changed strings, one commit | 59.565 → 35.193 | 67.040 / 81.090 | 41.220 / 42.961 |
| 69 | 16 | unchanged strings, one commit | 59.972 → 34.711 | 67.363 / 72.828 | 41.617 / 44.964 |
| 69 | 16 | changed nested objects, one commit | 58.007 → 38.013 | 64.811 / 69.529 | 44.509 / 48.139 |
| 69 | 16 | changed arrays, one commit | 58.741 → 36.907 | 67.110 / 73.681 | 43.410 / 49.037 |
| 69 | 16 | changed strings, 16 commits/reads | 60.162 → 39.071 | 95.589 / 112.395 | 70.235 / 78.916 |

For the large changed-string/session case, independent process total medians are
**69.242 / 59.216 / 69.180 before**, **41.327 / 41.048 / 41.220 after**.
The pooled median total improves **38.5%**, mutation **40.9%**. The retained change
therefore has a repeatable practical effect, rather than just altered counters.
Small/cold-case timing noise remains visible and no universal tail-latency bound
is inferred.

| Contract / edits | Full hydrate + canonical validation, before → after | Canonical dehydrate, before → after | Additional envelope copies after | Live context checks, before = after |
| --- | ---: | ---: | ---: | ---: |
| One session, 1 edit | 3 → 2 | 3 → 2 | 1 | 6 |
| One session, 16 edits | 33 → 17 | 33 → 17 | 16 | 51 |
| 16 separate setters + reads | 48 → 32 | 48 → 32 | 16 | 96 |

Counts hold for changed and unchanged values and every tested shape/tree size.
Full canonical property-validation node visits in the 69-node/16-edit session
fall **2,277 → 1,173**; the 16 defensive copies still inspect envelope shape/JSON.
Canonical dehydrate is serialization to an envelope, not JSON.stringify. Net change
report stringification is unchanged. The number of isolated envelope copies is
still `2M+1`: `M+1` dehydrates plus M shape copies. What disappears is M runtime
reconstructions, their property copies, semantic Form trees and immediate
re-dehydration. This remains O(tree size × mutation count), with a lower constant;
there is no claim of incremental hydration or removal of all whole-tree work.
Micro contexts have no installed guard, so lifetime counts are zero; they do not
qualify package integrity. Every measured live context-check count matches.

Real Page Form Clear (27 off samples per row) keeps the same 5F+1 proposed writes,
0/F submitted edits for unchanged/changed fields and one commit. Its Clear total
and runtime-edit medians, ms:

| Fields / changed | Clear total before → after | Runtime edits before → after | Whole-Page hydrate / dehydrate before → after |
| --- | ---: | ---: | --- |
| 2 / no | .263 → .257 | .021 → .021 | 6 / 8 → 6 / 8 |
| 2 / yes | .729 → .549 | .548 → .356 | 10 / 12 → 8 / 10 |
| 24 / no | 1.386 → 1.342 | .339 → .322 | 28 / 30 → 28 / 30 |
| 24 / yes | 37.249 → 24.534 | 36.218 → 23.572 | 76 / 78 → 52 / 54 |

Clear totals are its existing observation boundary, not full Page elapsed time.
Remaining Page validation/systemSet work explains the other whole-Page passes.
Unchanged Clear already skipped candidates in Spike E and gains no pass reduction.

Instrumentation is separated, not subtracted as an estimated CPU correction.
Large-string/session off versus observed medians are 67.040 versus 61.147 ms before
and 41.220 versus 47.732 ms after; cross-process noise can exceed observer cost.
The three serial Contact existing→attributed pairs are 67→100, 73→88, 77→101 ms
before and 80→96, 74→95, 63→90 ms after. All speed claims above use unhooked runs.

## Separate-client HTTP qualification

Each window uses a fresh worker, installation, empty dataset and anonymous
session/setup GET/CSRF, with the established Contact installer and a separate
supervised HTTP client. Gate is disabled in Contact, so it is not a Gate security
test. Three comparable windows per row, 12 POSTs/window; serial controls also have
three fresh windows. All clients completed. This is the existing bounded G matrix,
including its additional legacy canonical/installation microcapture; that legacy
micro uses portable edits and correctly retains `2M+1` passes after H.

Each table entry is **HTTP 200 / HTTP 500 (indeterminate)**, in window order.

| Provider / observers | Before windows | After windows | Before → after aggregate |
| --- | --- | --- | --- |
| SQLite, existing diagnostics | 4/8, 5/7, 7/5 | 7/5, 10/2, 9/3 | 16/20 → 26/10 |
| SQLite, synchronous attribution | 4/8, 2/10, 3/9 | 5/7, 2/10, 4/8 | 9/27 → 11/25 |
| SQLite, all observers off | 9/3, 9/3, 9/3 | 12/0, 12/0, 10/2 | 27/9 → 34/2 |
| JSON, synchronous attribution | 2/10, 3/9, 3/9 | 4/8, 2/10, 5/7 | 8/28 → 11/25 |

Every observed concurrency row has **36 reported native commits and 72 completed
native operations** before and after. Off observers cannot report those counters.
Deadline exhaustion counts are 20→12 (SQLite existing), 28→27 (SQLite attributed)
and 29→26 (JSON attributed). Exhaustion can also be observed during cleanup after
a successful response: it is not interchangeable with HTTP 500 count. Every
reported 500 remains indeterminate; none is reinterpreted as an uncommitted write.

Pooled Page elapsed **median / p90 / max**, ms: SQLite existing **1002 / 1004 /
1005 → 941 / 1003 / 1041**; attributed **1004 / 1006 / 1052 → 1003 / 1006 / 1094**;
JSON attributed **1003 / 1005 / 1006 → 1003 / 1006 / 1009**. Off observers supply
HTTP outcomes/durations but no Page ledger. Maximum callback sampler lateness
across the existing SQLite windows is **666.483 → 524.592 ms**; attributed SQLite
**521.351 → 582.540 ms**, JSON **501.985 → 519.480 ms**. These observed scheduling
values do not establish a queue bound or a reliability correction.

Per-Page synchronous medians from attributed concurrency windows (inclusive rows
overlap; do not sum them):

| Stage | SQLite before → after | JSON before → after |
| --- | --- | --- |
| Hydrate count | 40 → 33 | 40 → 33 |
| Dehydrate count | 39 → 32 | 39 → 32 |
| Full hydration ms | 27.144 → 23.797 | 26.022 → 22.253 |
| Canonical operation ms | 21.438 → 17.781 | 20.966 → 15.857 |
| Commit ms | 8.564 → 10.622 | 8.337 → 9.816 |
| Installed lifetime checks | 1,147 → 1,271 | 1,147 → 1,271 |

These are **unequal-work Pages**, not matched microbenchmarks: later/faster Pages
can process more PreRender results; failures stop at different boundaries. The
larger after guard count is not a change in guard policy. Matched serial attributed
Contact retains exactly **866 guards, 868 stamps, four operations, three commits
and six systemSet calls**; hydration/dehydrate each falls **19→15**, median
operation time **9.169→5.802 ms**, full hydration **14.447→10.745 ms**. Its guard
still performs 6,076 fresh artifact inspections per Page. Four defensive envelope copies replace the four avoided pre-operation
hydrate/dehydrate pairs, including the two existing Clear edits.

The ordinary SQLite/off windows improve in this series, but failures persist and
attributed/JSON results remain near the unchanged 1,000 ms deadline. Sequential
before/after experiments with uncontrolled host scheduling do not qualify closure.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** No retry, deadline extension, version bump,
provider change or deployment is introduced.

## Semantic and security qualification

Nineteen new direct/real-Page/installed tests compare the old and adapted factory
operation-by-operation, including structured failures/change reports; types,
descriptors, nested object/array aliases, defaults, failed insertion ID reuse,
revisions/abort/exhaustion; containment/navigation and inherited method dispatch;
unchanged denied setters and ended contexts; individual intermediate reads and
later callbacks; concurrent Pages; cancellation and an already-expired Page budget;
byte-identical installed replacement, embedded source tampering and retirement.
A failed candidate never alters prior state or the caller's original runtime.

Cancellation/lifetime revocation is cooperative at existing live guards; it does
not preempt a synchronous tree copy. Ending a context may reject Page finalization
with SEAM.CONTEXT, as before; the test preserves this existing distinction. New
validation or traversal checks are not presented as an OS isolation guarantee.

Existing focused regressions additionally exercise SEAM caller authority, Gate
policy revocation, cross-site/package/owner denial, package source/receipt and
replacement generations, shared budgets, concurrent providers, rollback/recovery
and native writes committed before HTTP failure. Actual installed integration,
provider, process-supervision and Linux unprivileged boundary qualification are
recorded separately. No mock establishes filesystem tamper resistance or OS
isolation, and local Unix-boundary tests do not qualify managed hosting, hostile
root writers, power loss or network filesystems.

## Verification and remaining cost

Final commands/results are recorded in the accompanying verification JSON and
Git handoff. Focused canonical/security selection passed **228/228** before the
last inheritance/concurrency cases; the final focused selection passed **90/90**,
including all **19** dedicated Spike H semantic/security cases and **two** evidence
integrity cases. No regression was removed or weakened to retain the optimization.

Local private-tarball qualification passed **380/380** installed five-library
integration tests, **35/35** provider tests, **20/20** actual installed process
supervision tests and **25/25** Linux boundary tests, all with zero skips.
Service-free binary/HTTP/assets/restart and closed configuration passed; all three
independent consumers reject development-checkout imports and contain exactly one
installed engine. Final `npm run check` and `npm test` results are recorded in
[the verification record](../../test-support/http-canonical-mutation-spike-h-verification-2026-10-20.json).
All authored code, tests, evidence and documentation precede these required checks;
the verification record records their output afterward.

Remaining synchronous costs include every seven-artifact installation stamp at
existing live boundaries, complete candidate/commit hydration and Form validation,
private envelope copying/cleansing, draft normalization/materialization, indexes
and change reports, trusted systemSet and shared component-controller edits.
After serial Contact still spends median **28.596 ms** in installed stamps,
**10.745 ms** in full hydration and **6.019 ms** in systemSet (inclusive, overlapping).

Next bounded correction: use a fixed twelve-entry PreRender result to measure
candidate hydration's Form semantic reconstruction and property cleansing apart
from defensive copying. Qualify reuse of immutable registry-derived validation
structure in the server path, with the same candidate/commit checks and no cached
authority. Optimizing the shared component-controller path requires a separately
versioned client or another proven server-only seam; do not modify frozen bytes
or silently batch independently observable writes. Installation-check consolidation
across cancellation/policy/filesystem boundaries is not justified by this spike.
