# HTTP reliability Spike G — PreRender, canonical mutation and installed integrity

2026-10-20. Started clean on `develop/0.3` at Spike F commit
`3242934d328917395d6441e6fdd920e0b6292410`.
**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** The retained correction removes decimal
string construction from installation stamps while retaining every fresh filesystem
inspection and validation boundary. It is a small computation improvement, not a
qualified HTTP reliability correction. No versions, client distributions, budgets,
completion contracts or CIR documents/implementation change.

The largest measured serial synchronous contributors are installed lifetime stamps
(29.461 ms median inclusive) and canonical hydration (16.289 ms). At concurrency
12, repeated lifecycle/handle/budget checks and tree-size × mutation-count work
compete for the event loop. Slow callback delivery persists with JSON and SQLite.
The observed syscall volume primarily comes from independent live context checks,
not recursive package traversal or rereading all source bytes at every mutation.

## Evidence and reproduction

[Machine-readable evidence](../../test-support/http-prerender-integrity-spike-g-evidence-2026-10-20.json)
contains summaries, distributions, paired overhead controls, canonical scaling,
installation negatives, and representative serial request records. The SHA-256-pinned
[source archive](../../test-support/http-prerender-integrity-spike-g-source-2026-10-20.json.gz)
contains all 44 final captures, their exact audited sources, three calibrations,
and the offline packager. Historical D/E/F evidence is unchanged. Historical hashes
are checked against captured sources; they never require today's runtime bytes.

Run alone, with installed dependencies, native local TCP/child-process access and,
for traces, permission to trace disposable children:

```sh
node test-support/prerender-integrity-probe.mjs --output /tmp/NEW-spike-g
node test-support/prerender-integrity-probe.mjs --trace-output /tmp/NEW-spike-g-trace
node test-support/installation-stamp-probe.mjs /tmp/NEW-stamp-cost.json
```

The first command produces 18 Contact windows and one micro/installation capture;
the second produces three strongly perturbed trace windows. Every destination must
be new. Before/after were separate sequential series with the original/string and
candidate/tuple guards respectively; restoring the archived baseline source is
necessary to reproduce the old implementation. Do that in a disposable checkout,
not by overwriting local work. The archive includes both implementations and the
offline packager's eight-argument usage. Three fresh calibration processes compare
both representations with alternating order, three warmups and nine samples each.

Environment: Node v24.21.0, Linux 7.0.0-38-generic, AMD Ryzen 7 7735HS, 16 available
logical CPUs, default four-worker libuv pool; local temporary filesystem type
61267, 4,096-byte blocks. Host load/preemption is uncontrolled. No suite or other
experiment overlapped a final capture. Each Contact window has its own worker,
installation, empty dataset, anonymous session, setup GET/CSRF and supervised
separate HTTP client. Gate is disabled in this fixture. Actual client/server/host
admission/Page-ledger overlap matches 12 for every observed concurrent window
(Page ledger has 1 ms resolution). Off observers cannot measure ledger overlap.
Workers are bounded to 45 seconds, series to six minutes, stdout to 16 MiB, and
accepted raw syscall traces to 24 MiB. All final captures completed and cleaned up
with zero drops, hook errors, stack overflows or unmatched syscall split lines.

Early sandbox Contact smoke could not complete setup/cleanup; native-access smoke
passed. An initial supervisor misinterpreted a false configuration flag as a
capture array; corrected before final source-pinned series. Exploratory captures
are excluded from the tables. No failure is substituted with a passing rerun.

## Actual path and clock boundary

Audit: `http/pipeline.js`, `repository.js`, `execution/page.js`, `execution/instances.js`,
`object-model/{index,mutation,construction,schema,validation}.js`,
`seam/context.js`, `packages/{index,state}.js`, `sewn/budget.js`, Store
`local-root.js`, `lifecycle-lock.js`, JSON/SQLite adapters and existing completion
instrumentation. [Mutation](../mutation-model.md), [SEAM](../seam.md),
[execution placement](../execution-context-foundation.md),
[package lifecycle](../package-lifecycle.md), [completion](../milestones/0.3-I5.6/operation-completion.md),
and [HTTP qualification](../http-concurrency-qualification.md) retain authority.

1. Host admission precedes pipeline work. The pipeline checks its catalog
   fingerprint, reloads/validates the installed catalog, rebuilds the prototype
   registry and hydrates the App. It resolves session policy and binds the Page's
   package principal from accepted grants/receipt, not request identity fields.
2. Binding reads seven fresh metadata stamps, validates accepted durable bytes,
   then restamps. Subsequent contexts share the opaque revocable lifetime. Page
   placement, trusted caller/App/session identity and current authority remain
   independent checks. Host activation already validated package bindings,
   capabilities, library/storage mappings and ownership.
3. `executePage` prepares handlers/presentation and independently dehydrates and
   hydrates the App. **Only then does it create the existing 1,000 ms Date ledger.**
   Repository loading, installed binding and Page preparation are outside this
   request's ledger, but can block callbacks for other admitted Pages.
4. Initialization, POST field adaptation, Load/Validate and Submit execute inside
   the ledger. Trusted `systemSet` performs a whole-App dehydrate/patch/hydrate for
   each bound field or validation update: six such calls in serial Contact.
5. Submit authorizes the session and invokes create through the completion tracker,
   library dispatcher and WydStore. SEAM capabilities/scopes, Gate policy where
   configured, exact App/publisher/package/principal/installation ownership,
   lifecycle barriers and precommit budget checks remain independent boundaries.
   SQLite's asynchronous ancestor/sidecar/lock inspections precede its synchronous
   transaction. JSON has its own serialized document/atomic rename/fsync path.
6. Spike E Clear proposes 11 property writes for two fields and submits only two
   changed candidates after live checks. Clear retains one validated commit. The
   acknowledgment is another ordinary edit. There is no Page-wide store transaction.
7. PreRender queries the provider, constructs one invocation-local draft per entry,
   validates draft defaults/Set/materialization, then uses ordinary canonical Insert
   and commit. Every inserted entry enlarges the App for later whole-tree passes.
   Request IDs, inheritance, placement and construction consumption stay checked.
8. Each canonical edit setup dehydrates the original. Each operation hydrates and
   dehydrates accepted working state, changes an isolated candidate, then hydrates
   and dehydrates it again. Commit hydrates again, checks revision/lifetime and
   computes a change report. IDs/prototypes survive; snapshots remain immutable.
   Failed candidates cannot modify accepted state. This publication is request-local,
   not persistent App publication; package installation publication is separate.
9. Rendering projects canonical state; Unload/cleanup and service settlement follow.
   New work is revoked on exhaustion. Admitted native I/O drains. A commit followed
   by failed Page execution produces indeterminate HTTP 500, not rollback or retry.

Date-based enforcement and `SEWN.LIMIT` are unchanged. Diagnostic `insideBudget`
marks work after the existing deadline is observed, including cleanup/settlement;
it does not imply permission to execute after exhaustion. This separates early
`prepare` work from the small amount of preparation after ledger creation.
Remaining-budget records subtract Date.now only from that existing deadline.

## What each installation check establishes

| Check | Facts / boundary | Freshness requirement |
| --- | --- | --- |
| Manifest, embedded resources and receipt | Closed schema, publisher/package/version, exact source hashes, approved mappings/grants, compiled-source receipt equality | Validate accepted catalog at load/bind and after observed changes; generation alone is insufficient |
| Base fingerprint | Exact configured repository/prototype/content bytes, safe paths | Current catalog validation rehashes the base files |
| Live metadata stamp | dev, inode, size, nanosecond mtime/ctime of catalog, config and five recovery/lifecycle artifacts; absence matters | Fresh seven-file lstat on every guarded context check |
| Installation binding | Receipt ID, App ID, placement and lifetime generation, active status; no pending retirement/review | Validate after metadata changes, then restamp before accepting |
| Caller/lifetime | Branded live context, shared revocation fence, placement and caller-owned ledger | Every existing context/member/event/service/mutation boundary |
| SEAM / WydGate / WydStore | Capabilities, object visibility/edit/traversal, current membership/policy, exact store owner | Existing live authorization boundaries; no positive cache added |
| Canonical candidate/commit | Envelope, schema/default normalization, inheritance, child types/cardinality, IDs, Form rules, revision and candidate isolation | Every operation and commit as before |

The executable package resources are **embedded in the catalog**. Editing the
original import directory is not editing the installed artifact. The negative
source case changes embedded installed bytes after prior validation and leaves the
receipt hash unchanged; it rejects. Sources are not reread independently on every
lifetime check. `readInstalledState` validates receipts/resources, fingerprints,
policy metadata and dependency graph. Dependency traversal is not on the ordinary
unchanged stamp path. Unchanged positive metadata suppresses durable-byte rereads
under the **pre-existing trusted local-filesystem writer model**, not a new cache.

No stronger hostile-filesystem/root-writer guarantee is claimed. An installation
generation cannot prove file integrity. In-place writes/replacements and recovery
barriers must remain observable. Broad positive-result caching, skipped stats and
mutable authorization reuse were rejected. The existing metadata→validate→restamp
sequence and its filesystem assumptions are preserved exactly.

## Attribution method, overhead and limits

The existing `runContactWindow` harness gains `synchronousAttribution`, off by
default. Explicit manual workers install strict source-anchored Node module hooks
**before** importing the application. Hooks wrap shared canonical functions in
memory; they do not write source, alter validation logic, wrap branded draft
handles or enter the production/browser import closure. Ordinary execution installs
no hooks, timers or diagnostic AsyncLocalStorage scope. Existing HTTP phase,
budget, Clear, native-stage, FSREQPROMISE and scheduling observations are reused.

Synchronous spans use performance.now. Per-request AsyncLocalStorage isolates
concurrent captures. A 128-frame stack subtracts **only immediate nested intervals
of the same synchronous invocation** to produce exclusive durations. There is no
async wall-time subtraction, sum of overlapping inclusive stages, or subtraction
of unrelated maxima. Inclusive mutation contains hydrate/dehydrate and live guard
work; installedStamp contains metadata. Metadata timing is a Node API bracket,
not exclusive kernel time. Native transaction brackets remain separate existing
observations. Untimed runtime work, GC/native execution and host descheduling
remain; these are elapsed-work measurements, not a complete CPU partition.

Static phase/stage/site/operation vocabularies bound aggregate maps. Retention
also caps artifacts at 256 (maximum configurable 1,024), boundaries at 32, and
requests at ordinals 0–12. Only static call-site names, numeric request/window and
bound-context ordinals, counters and timings are emitted. Within a single
installation capture, seven fixed guard artifacts have logical identities;
other paths become ephemeral keyed digests, discarded at finish. No private
paths, payloads, credentials, SQL, source bytes or durable receipt/generation UUIDs
are emitted by the collector. Archived runtime **source code** is separate from
observed package/user data. Numeric generations identify fresh fixture windows;
within a window, guard observations use the original bound context, so derived
contexts do not manufacture distinct generations. They grant no authority.

Observer cost is material. Serial existing→attributed Page elapsed, ms:

| Implementation | Round 1 | Round 2 | Round 3 |
| --- | ---: | ---: | ---: |
| Before | 75→89 | 80→93 | 76→93 |
| After | 76→92 | 76→79 | 78→98 |

These alternate order in fresh children and include run variance. Full-off
concurrent controls and canonical off/on pairs are retained too. Attributed
concurrency results are markedly worse than existing diagnostics; their absolute
times cannot be promoted to unobserved production costs or reliable fix estimates.

## Synchronous accounting and mutation scaling

Three serial SQLite attributed requests per implementation; medians in ms.
Counts are per request. **Rows overlap; do not add inclusive columns.**

| Stage | Before calls | Before inclusive / exclusive | After calls | After inclusive / exclusive |
| --- | ---: | ---: | ---: | ---: |
| Repository load, before ledger | 1 | 9.934 / .010 | 1 | 11.211 / .014 |
| Installed byte validation, nested in binding before ledger | 1 | 3.457 / .089 | 1 | 3.983 / .096 |
| Installed stamp | 868 | 29.461 / 16.235 | 868 | 28.265 / 15.118 |
| Instrumented synchronous metadata APIs, including base checks | 6,277 | 14.634 / 14.634 | 6,277 | 14.518 / 14.518 |
| Canonical hydration / validation | 19 | 16.289 / 16.289 | 19 | 15.506 / 15.506 |
| Whole-App canonical dehydrate copies | 19 | 3.881 / 3.881 | 19 | 6.525 / 6.525 |
| Mutation operation | 4 | 9.533 / .426 | 4 | 9.321 / .428 |
| Commit | 3 | 2.742 / .635 | 3 | 4.055 / .650 |
| Trusted systemSet | 6 | 6.087 / .106 | 6 | 6.292 / .125 |
| Draft validation, including empty construction setup | 5 | .335 / .256 | 5 | .299 / .236 |

The fixed first baseline serial request has 866 guard calls, 865 subsequent checks
against the same binding, 868 stamps, **6,076 guard lstat calls**, 26 distinct
logical artifacts overall, and 857 nodes visited in each of the hydration and
dehydrate-copy counters. Extra bind stamps explain stamps = guard calls + 2.
Its measured nested synchronous coverage is 61.980 ms; its Page ledger is 89 ms.
Coverage includes work before the ledger, so these numbers cannot be subtracted
to infer unaccounted Page CPU. Its two SQLite synchronous transaction brackets
total 13.651 ms, including a cold first transaction; they are not filesystem waits.

For that request, PreRender has 272 stamps (9.146 ms), one constructed/Set/materialized
entry, one Insert, one commit, and three full hydrations (2.021 ms). The mutation's
1.944 ms and commit's .906 ms include their hydration work. Query return to
construction and callback timelines remain in the archived window.

Of the 6,076 guard stats, only **91** are nested under mutation or commit;
42 are edit setup and 91 are draft/construction paths. Most are outside these
measured edit/build paths, in lifecycle/handle/budget/service checks. At concurrency
12, before medians rise to **1,093 guards, 1,095 stamps and 37 hydrations** per Page;
after medians are 1,147 / 1,149 / 40. Requests reaching more result entries perform
more work; failed Pages stop at different boundaries. These are not equal-work
before/after per-Page speed comparisons.

Canonical microcases use forms with 2/8/24/64 fields (7/13/29/69 total nodes),
1/4/16 sequential property intents, changed and unchanged, four warmups and nine
off/on samples with alternating order. Repeated writes may address the same field;
evidence separately reports unique properties and changed/unchanged intent counts.

| Nodes | Intents | Changed | Hydrate / copy passes | Unobserved median ms | Observed validation ms |
| --- | ---: | --- | ---: | ---: | ---: |
| 7 | 1 | yes | 3 / 3 | .525 | .336 |
| 69 | 1 | yes | 3 / 3 | 4.830 | 3.389 |
| 7 | 16 | yes | 33 / 33 | 7.061 | 4.696 |
| 69 | 16 | yes | 33 / 33 | 56.335 | 40.952 |
| 7 | 16 | no | 33 / 33 | 4.645 | 3.484 |
| 69 | 16 | no | 33 / 33 | 55.654 | 40.556 |

Both implementations preserve **2M+1 hydration and 2M+1 dehydrate passes** per
single edit with M operations and one commit. Each visits the whole T-node App:
the measured dominant scaling is **T × M**, with commit/index/change-report and
data-shape costs too. Unchanged ordinary writes are not free. These microcases
have unguarded host contexts and do not measure installed security or storage.
Draft subtree copies/normalization and hydration's semantic Form-tree construction
are nested work, not additional counted whole-App dehydrate copies.

The pre-operation hydrate reconstructs an already validated private working tree;
that is repeated structural computation. Removing it needs a separately qualified
isolation-preserving copying path and the shared-client artifact contract. Shared
canonical code/client artifacts are intentionally unchanged here. Post-operation
and commit validation, draft completeness and fresh authority checks cannot simply
be removed. No bulk mutation, snapshot cache or alternate object model is added.

## Metadata call sites and installed repetition

Every unchanged `guardInstalledExecution` stamp inspects catalog, configuration,
install lock, recovery lock, infrastructure marker, effects journal and operation
journal. Most boundary checks observe the same state, but must still detect a
replacement, in-place write or new barrier. `safeRead` separately checks path
components, file type/link count/size and realpaths. Base fingerprint rehashing
and startup catalog validation therefore inspect other logical artifacts too.
Store's asynchronous root/sidecar/lock checks serve different owner/recovery and
filesystem-identity boundaries; they are not duplicates of the package stamp.

Controlled installed fixture, within one live bound context:

| Work | Guard calls | Guard stats | Hydrate / copy passes | Full byte revalidations during measured work |
| --- | ---: | ---: | ---: | ---: |
| 20 independent scoped reads | 20 | 140 | 0 / 0 | 0 |
| 8 unchanged edits, each committed | 40 | 280 | 24 / 24 | 0 |
| 8 changed edits, each committed | 40 | 280 | 24 / 24 | 0 |
| Byte-identical catalog replacement | 1 | 14, plus validation's checks | 0 / 0 | 1 |

Counts match before/after. The initial bind's complete byte validation is outside
these measured operations, not bypassed. The fixture's no-service library stub
does not prove WydStore authorization; separate real provider/Gate regressions do.

Traced scheduling windows include setup GET and all POSTs. Actual statx/newfstatat
counts (not logical API counts) are:

| Implementation | Total syscalls, windows 1 / 2 / 3 | Main-thread calls to seven guard artifact names |
| --- | --- | --- |
| Before | 59,773 / 60,347 / 60,471 | 54,587 / 55,161 / 55,273 |
| After | 61,793 / 61,006 / 57,489 | 56,582 / 55,805 / 52,305 |

About 91–92% target these artifact names; that category also includes startup
validation's checks, not exclusively stamps. Per-call-site observations establish
the stamp path directly. Other calls include safeRead realpath internals and Store
preflight/SQLite. Node realpath can issue multiple syscalls; logical API counts
cannot be equated with syscall totals. readlink and other syscall families are
outside this established tracing filter. Raw path-bearing traces are removed with
the worker scratch tree. Syscall count alone establishes neither excessive elapsed
time nor safe redundancy. Unequal traced admission/progress explains differing totals.

## Retained optimization and its qualification

`packages/installation-stamp.js` compares the **same five freshly read BigInt
fields** in the same fixed seven-file order, including missing files. Previously
each observation converted every field to decimal strings and joined the array.
No stamp field, metadata call, full validation trigger, restamp, error/revocation,
caller check or authorization boundary changes. Accepted metadata is still compared
against fresh observations on every guard invocation. Direct equality preserves
nanosecond precision; converting to Number would not.

Three independent calibration processes, nine samples each:

| Scope / iterations per sample | Before medians ms | After medians ms |
| --- | --- | --- |
| Representation only / 50,000 | 40.723 / 41.687 / 41.568 | 15.966 / 16.751 / 16.178 |
| Same seven fresh lstat calls / 1,000 | 11.174 / 11.443 / 11.771 | 10.824 / 10.765 / 10.999 |

The isolated computation improvement repeats; complete inspection medians improve
about 3.1%, 5.9%, 6.6% (roughly .35–.77 microseconds per synthetic check). The
synthetic fixture has three present and four absent files. Representation-only
mode is incapable of authorizing protected work and is not a production bypass.
The actual installed 20-read capture is effectively unchanged (.843 ms both), and
its eight-write captures do not improve consistently. This tiny optimization is
retained for eliminated representation work, not an inferred application speedup.
It does not address the number of guards or whole-App rebuilds.

Negative captures reject changed embedded source/receipt mismatch, removed and
malformed catalogs, installation barriers, stale retirement generations, and reuse
after repair or retirement cancellation. A new post-cancellation binding succeeds.
Byte-identical inode replacement forces a fresh full validation rather than reusing
a generation-only success. Direct tests additionally cover every stamp field,
absence transitions, nanosecond distinctions, modified source with restored mtime,
same-byte replacement and symlink substitution. No untrusted replacement can reuse
a new positive cache: none was introduced.

The strengthened source adversary preserves inode, exact byte length and exact
nanosecond mtime; ctime changes and the old binding rejects the receipt mismatch.
Its first draft accidentally reformatted the catalog and failed its own size
assertion (3/4 tests passed). The corrected fixture preserves the original bytes
apart from the equal-length source edit and passes 4/4. This was a test-fixture
correction, not a runtime integrity failure.

## HTTP qualification and remaining risk

Three windows per row, 12 POSTs/window except serial controls. HTTP 500 and
indeterminate are equal in the untraced concurrent rows; observed commits/native
calls remain independent from successful HTTP delivery.

| Mode | Before 200 / 500 | After 200 / 500 | Before→after reported commits / completed native | Before→after deadline exhaustions |
| --- | ---: | ---: | --- | --- |
| Serial SQLite, existing | 3 / 0 | 3 / 0 | 3/6 → 3/6 | 0 → 0 |
| Serial SQLite, attributed | 3 / 0 | 3 / 0 | 3/6 → 3/6 | 0 → 0 |
| SQLite 12, existing diagnostics | 17 / 19 | 21 / 15 | 36/72 → 36/72 | 19 → 15 |
| SQLite 12, attributed | 8 / 28 | 10 / 26 | 36/72 → 36/72 | 29 → 27 |
| SQLite 12, observers off | 28 / 8 | 30 / 6 | Unobserved | Unobserved |
| JSON 12, attributed | 9 / 27 | 10 / 26 | 36/72 → 36/72 | 28 → 27 |
| SQLite 12, traced + attributed | 5 / 31 | 4 / 32 | 13/49 → 14/49 | 35 → 33 |

Untraced existing-diagnostic per-window 200:500 changes from 6:6 / 5:7 / 6:6 to
6:6 / 8:4 / 7:5. Serial unextended Page elapsed is 75/80/76 → 76/76/78 ms;
there is no repeatable serial Page latency gain. Tracing changes admission and
commit opportunities; its indeterminate totals are 13→14, not all failed HTTPs.
Some successful Pages exhaust during cleanup, explaining excess exhaustion counts.

In extended SQLite windows, installed stamps total 459.492/466.177/478.064 ms before
and 457.896/453.463/446.917 ms after, while hydration totals
348.695/353.410/330.175 → 354.367/378.472/374.927 ms. Completed work differs;
these synchronous aggregates are not per-request CPU or equal-work speed ratios.

10 ms scheduling histogram maxima remain 454.296/524.550/497.287 →
460.587/507.249/668.991 ms, with only 11–17 samples/window. Longest observed
filesystem init→callback deliveries remain 615.971/614.448/669.243 →
648.074/656.263/665.565 ms. The retained same-interval callback-span intersections
are 363.274/363.754/391.228 → 376.280/384.993/400.638 ms, with zero poll idle
over each interval. Their subsequent observed callback→continuation gaps are
.020/.035/.042 → .018/.028/.034 ms. This supports continued event-loop pressure,
not precise worker-ready timestamps or exclusively JavaScript CPU. Spike F's
controlled early-kernel-return result remains separate causal evidence.

JSON uses different provider serialization, filesystem and commit behavior; it
shares Contact application intent, not identical storage execution. Its failures
support a common Page workload problem, without exonerating provider-specific
costs. Before/after HTTP differences are within the observed noisy workload and
do not qualify a reliability correction. No automatic retry, timeout extension,
System execution or speculative cache is justified. **The issue stays OPEN.**

## Verification and next bounded investigation

Focused canonical/Clear/placement/new-guard/diagnostic tests: **77/77 pass**, zero
skips. Diagnostic-only initial tests separately passed 8/8 with native process
access; restricted sandbox attempts could not provide normal test child output.
No semantic regression was suppressed. Installed local tarball verification:
**335/335** five-library integration tests, **35/35** provider tests,
**20/20** actual process-supervision tests, **25/25** Linux boundary tests, all
zero skips. It also passes service-free binary/HTTP/restart, forbids checkout
imports and verifies exactly one installed engine per consumer. The installed
selection now includes the new stamp adversaries and existing placement tests.
No publication/deployment occurs.

These suites cover changed/unchanged properties, failed-edit atomicity, inheritance
and ID preservation; malformed receipts and package inputs; replacement/retirement,
recovery and killed lifecycle writers; current Gate membership and revoked authority;
cross-App/package denial; concurrent provider operations, cancellation/budget
exhaustion; committed writes preceding HTTP failures. Contact with Gate disabled
and the no-service installed microfixture alone do not establish those properties.
Power loss, hostile root writers, network filesystem semantics and production
deployments remain outside this local qualification.

After final authored edits, run `npm run check`, `npm test`, and the focused
package/provider/lifecycle/authorization selection. Exact final totals and any
failures are retained in the Spike G verification record and delivery handoff.
Immutable client prebuild and historical evidence validation remain required.
Review status, complete intended diff and remote divergence before the authorized
normal commit/push; leave versions and historical artifacts untouched.

The next bounded investigation should isolate a **fixed twelve-entry PreRender
result**, independent of scheduling/dataset arrival, and qualify one existing
canonical operation's redundant pre-hydration against private defensive copying.
Measure draft normalization, accepted-tree copying, candidate hydration and commit
separately with the same real authority checks. Respect the immutable shared-client
contract before retaining a shared-code correction; avoid a duplicate server object
model. Independently classify why lifecycle dispatch asks for so many context
checks, but do not consolidate them across async, cancellation, policy or filesystem
mutation boundaries without an explicit proof. The present measurements justify
that target, not a generation-only integrity cache or CIR implementation.
