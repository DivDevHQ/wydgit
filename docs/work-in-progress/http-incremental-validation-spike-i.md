# HTTP reliability Spike I — canonical validation reuse

2026-10-20. Starting baseline `b82a9809f72c9e99a1c733813f3864064f1a0221`,
`develop/0.3`. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.**

## Preimplementation audit and safety argument

Page's retained handle checks invocation, current Page membership/visibility,
response writability and member access. `createPageEdit` delegates to the portable
mutation factory. Setup, operation entry, object authorization and commit retain
their `checkContext` calls, including installed-package guards. SEAM capability,
visibility and edit grants remain live; service dispatch and WydStore ownership
are independent. No validation result certifies authority or filesystem state.

The H pipeline for M successful operations in one session is:

| Traversal | Input / invariant | Can input have changed? | Publication / portability |
| --- | --- | --- | --- |
| Setup dehydrate | Trusted immutable original; copy JSON, preserve sensitive values/schema | Original is frozen | Private isolation; portable factory |
| Initial index | Private copied envelope; original identities and reserved IDs | No | Change reports/ID reservations; portable |
| Per-operation copyEnvelope | Exact private accepted envelope; descriptors, JSON, bounds, cycles/aliases | No external alias; factory never edits accepted tree | Defensive candidate isolation; H server adapter |
| Candidate index and operation | Private copy; target lookup, authorization, clean input | Only this candidate changes | Existing error precedence; portable |
| Candidate hydrate | Changed untrusted values/subtrees; complete structure, identity, inheritance, placement restrictions, types, slots, global Form rules | Yes: this is a new state | Necessary; portable reference |
| Hydrate semantic tree + formTree | Newly constructed nodes; Form ancestry/configuration/name uniqueness | Same candidate, different invariants | Necessary global checks |
| Accepted dehydrate + ID index | Fully validated immutable candidate; canonical normalization and reserved IDs | No | Private accepted envelope; portable |
| changes indexes/stringifies | Original versus accepted values/direct child IDs | Different states intentionally | Net report; portable |
| Commit hydrate | Exact accepted envelope, next revision; reconstruct same content and derived relationships | Content unchanged since candidate hydration | Atomic new revision; portable reference |
| Page membership/archive/publication | Old/new Page trees, root type and request-reserved IDs | New runtime available only privately | Per-setter publication before return |
| Subsequent retained-handle reads | Current request runtime; invocation/visibility/placement guards and copied public properties | Runtime changes at each setter | Intermediate visibility retained |

Each hydrate also traverses nested JSON for descriptor/value cleansing/freezing,
builds nodes/parent/position/schema maps, resolves defaults and creates derived
Form trees. Dehydrate is canonical serialization to an envelope, not JSON text.
The factory also performs independent ID, subtree and change-report traversals.
These are not all duplicate validation and will remain. H performs M+1 full
hydrations and M+1 dehydrations, plus M defensive envelope copies. Separate
setters perform two hydrations each; every setter publishes independently.

Selected experiment: eliminate only the final duplicate content reconstruction.
Hydrate each changed candidate with the next revision, privately. Dehydrate it
normally. Associate that exact private envelope with that exact frozen runtime
inside this one edit session. At commit, after the factory's existing live-context,
conflict and exhaustion checks, return the associated runtime only if input identity
and requested revision match. An empty session still hydrates at commit. At maximum
revision, candidate validation uses the base revision so exhaustion still fails at
commit, after the existing conflict check. Candidate revisions are not observable
through `changes()`, dehydrate, property rules or Form validation.

This argument precedes implementation. Required proof obligations:

- Mutable aliases/nested objects/arrays: `clean` and `copyEnvelope` inspect data
  descriptors and copy caller data. Hydration constructs and recursively freezes
  nodes, nested properties, provenance, execution metadata and slot arrays.
  Dehydrate creates another isolated envelope. Only the factory sees that envelope;
  its operations mutate a fresh copy, never accepted state. No reference-identity
  inference is made about caller objects.
- Inheritance/prototypes: resolved registry definitions are recursively frozen in
  private maps, with no mutation API. Registry implementation and JavaScript
  intrinsics are trusted host code. Ordinary Wydgits cannot replace their methods
  or prototypes. Every new candidate still resolves inheritance and execution rules.
- Parents/children/siblings/cross references: full candidate hydration rebuilds all
  relationship maps and slot constraints. The retained runtime is that complete
  immutable graph. Inert ID-valued properties are not rewritten by either path.
- Duplicate IDs/global uniqueness: every candidate retains complete ID/cycle/
  single-parent checks and global Form name/ancestry checks. No local-invariant
  approximation is used. Existing unrelated host/web validation remains.
- Serialization/normalization: candidate hydration applies defaults and canonical
  slot order; dehydrate includes sensitive/internal values and original schemas.
  Its output represents the same already normalized graph. Rehydrating this output
  changes only revision; it adds no authority. Differential round-trip tests must
  establish equality including descriptors, navigation and serialized output.
- Nonserializable values/invalid descriptors/cycles/getters/setters: caller inputs
  still take the existing cleansers and complete hydration. Accessors, symbols,
  sparse arrays, custom prototypes, nonfinite values and cycles retain existing
  failures without executing getters. Failed candidates never update the pair.
- Retained handles/concurrency: the pair lives only inside the existing private
  synchronous edit session. No cache spans Page setters, requests or executions.
  Published snapshots are immutable; Page handles resolve current request state.
- Generation changes: commit's currentRevision equality/exhaustion and context
  guards run before reuse. Installed catalog/source/receipt/policy inspections
  remain fresh at every existing guard, including `changes()` after construction.
  The pair cannot authorize anything or revive a stale handle.
- Failure/interruption: validation failure leaves the last accepted pair intact;
  a failed first operation leaves only the original runtime, so commit hydrates.
  Conflict leaves the session open as before. Abort closes it. Cancellation/lifetime
  termination fails through unchanged cooperative guards. No candidate is published
  before the factory and Page publication checks finish. Native commits and HTTP
  uncertainty remain independent; there is no automatic write replay.

Rejected alternatives: affected-path validation/subtree sharing cannot locally
prove Form/global uniqueness and would need a broader incremental graph design;
mutable candidates cannot be certificates; public or cross-request certificates
would widen trust; batching alters publication; installation integrity caching is
unrelated and unsafe without its own proof; shared-core changes alter frozen
WydClient artifacts. The portable implementation remains the behavioral reference.

## Retained implementation and evidence

The production diff is confined to `execution/canonical-edit.js`: retain the
accepted immutable runtime alongside its private envelope, construct candidates
at the next revision, and recognize that exact pair at commit. No shared object
model, client import, native operation reporting, provider, deadline, version,
CIR or System execution changes. Every existing Page setter remains independently
observable. Failed operations preserve the previous accepted pair; empty sessions
and sessions with only failures take the real commit hydrator.

[Machine-readable evidence](../../test-support/http-incremental-validation-spike-i-evidence-2026-10-20.json)
contains all distributions and window summaries. Its SHA-256-pinned
[source archive](../../test-support/http-incremental-validation-spike-i-source-2026-10-20.json.gz)
contains eight complete matrix captures, three paired hot controls, exact early
rejection visit counts, both 19-capture HTTP series, sources/hashes, packager and
exploratory failure logs. H baseline helper bytes match H's retained after archive.
Historical D–H evidence is unchanged. Generated verification results are recorded
[separately](../../test-support/http-incremental-validation-spike-i-verification-2026-10-20.json).

Environment: Node v24.21.0, Linux 7.0.0-38-generic, Ryzen 7 7735HS, 16 logical CPUs,
default four-worker libuv pool, local temporary filesystem. Timing captures ran
serially, without overlapping suites or other experiments. Host scheduling, GC,
CPU frequency and unrelated host load are uncontrolled. No statistical confidence
interval or production tail bound is claimed.

The 60-case matrix retains all 48 H cases: 7/69 nodes, 1/16 edits, changed/unchanged
string/nested-object/array values, one session or individual setters with reads.
It adds changed-string cases at 277 nodes grouped into sixteen containers, 100 nodes
with 31 additional nesting levels, and 517 nodes with 512 sibling fields. Every
case has three warmups and nine measured samples per fresh process: three off
processes (27 samples) and one separately observed process (nine samples), both
before and after. Typed fields exercise inherited properties. Additional captures
cover sixteen valid/invalid attempts, concurrent seven-node Pages with sixteen
setters each and interleaved reads, and actual Form Clear. Full min/median/p90/p99/
max, per-process medians, memory samples and raw rows remain available.

Two initial extended attempts were excluded, with logs retained: added Blocks
lacked required content; after repair, the two-Page 69-node microcase exceeded the
unchanged deadline. That concurrent semantic microcase was reduced to seven nodes.
Neither attempt produced a complete timing capture. The established Contact matrix
retains its actual twelve-way workload. No runtime limit or HTTP result was waived.

## Validation counts and stage timing

| Workload | Full hydrate passes before → after | Canonical node visits | Dehydrate passes, unchanged | Context checks, unchanged |
| --- | ---: | ---: | ---: | ---: |
| 7 nodes, 1 edit | 2 → 1 | 14 → 7 | 2 | 6 |
| 69 nodes, 16 edits, one commit | 17 → 16 | 1,173 → 1,104 | 17 | 51 |
| 69 nodes, 16 setters + reads | 32 → 16 | 2,208 → 1,104 | 32 | 96 |
| 69 nodes, 16 invalid attempts, commit | 17 → 17 | 285 → 285 | 1 | 35 |

There remain sixteen defensive `copyEnvelope` traversals in each sixteen-attempt
case. Candidate construction is still whole-tree copying, and full candidate
validation is still O(nodes × successful edits). A nonempty session saves exactly
one final hydration; independent setters save one each. Unchanged writes still
validate and publish normally. Form Clear retains its separate existing equality
elision. No global invariant is validated only locally.

The historical `hydratedNodes` counter counts completed structural traversals;
it does not include partially rejected traversals. The separate visit probe forwards
registry `get` through an observer-only counter: hydration calls it exactly once per
visited node; the setter's one descriptor lookup is counted separately. Sixteen
invalid label edits visit 6 through 21 nodes before rejection, plus 69 at commit:
285 actual visits in both implementations. Successful cases independently reproduce
1,173/1,104. Registry definitions and `isA` behavior remain unchanged. These micro
contexts have no installed guard, so installed-lifetime counts are zero; real
installed qualification is independent.

Observed stage times for the 69-node/16-edit session, median / p90 in ms (nine
samples, one separately instrumented process each):

| Stage | Before | After |
| --- | ---: | ---: |
| Defensive candidate construction | 7.596 / 11.770 | 7.272 / 9.619 |
| Full candidate validation | 18.963 / 24.892 | 19.053 / 23.757 |
| Commit validation/reuse callback | 1.132 / 1.283 | 0.001 / 0.003 |
| Canonical serialization to envelope | 6.911 / 9.288 | 7.081 / 10.079 |
| Whole commit including change report | 1.353 / 1.552 | 0.223 / 0.259 |

Commit callback after median is 0.000982 ms. Serialization is `dehydrate`, not
JSON text encoding; per-node JSON.stringify change comparisons remain unchanged.
Inclusive stages nest inside mutation/commit and cannot be added as CPU totals.
Observed total medians are 41.965 → 39.877 ms; comparable off medians are 48.290 → 40.516 ms.
Hooks are absent from off/hot captures. No estimated observer cost is subtracted;
cross-process variability can exceed the observer cost. Stage data establishes the
removed work; production speed claims use unhooked measurements.

## Performance distributions and retention decision

Changed strings, sixteen edits; total duration median / p90, ms (27 off samples).
Mutation duration excludes commit; the reference mutation median is
39.254 → 35.666 ms for one session, 42.479 → 35.253 ms for separate setters.
Candidate phase timing above does not establish an inherent candidate speedup.

| Tree / publication | Before total | After total |
| --- | ---: | ---: |
| 7 nodes, one commit | 3.324 / 3.540 | 5.506 / 6.304 |
| 7 nodes, 16 commits/reads | 5.509 / 8.432 | 6.657 / 8.060 |
| 69 nodes, one commit | 48.290 / 52.518 | 40.516 / 44.361 |
| 69 nodes, 16 commits/reads | 78.500 / 100.240 | 46.408 / 51.665 |
| 277 nodes, one commit | 191.346 / 239.986 | 173.806 / 183.106 |
| 277 nodes, 16 commits/reads | 286.126 / 363.031 | 199.508 / 216.650 |
| 100 nodes, one commit | 55.165 / 67.225 | 53.885 / 57.249 |
| 100 nodes, 16 commits/reads | 89.408 / 105.709 | 59.932 / 68.202 |
| 517 nodes, one commit | 344.824 / 381.653 | 343.394 / 355.958 |
| 517 nodes, 16 commits/reads | 579.472 / 752.054 | 406.730 / 423.293 |

The early seven-node cases regress in the sequential matrix; these results remain
in evidence. To distinguish this from sustained setter cost, three additional
fresh processes alternate H/I in the same process using identical runtime modules,
20 warmup pairs and 27 measured pairs per case (81 measured pairs). H's archived
helper body is unchanged; only import locations are relocated. No hooks are loaded.

| Hot control, 16 edits | Before median / p90 | After median / p90 |
| --- | ---: | ---: |
| 7 nodes, one commit | 3.154 / 5.535 | 3.095 / 5.433 |
| 7 nodes, 16 commits/reads | 5.172 / 8.648 | 3.681 / 6.682 |
| 69 nodes, one commit | 42.080 / 46.411 | 40.765 / 44.752 |
| 69 nodes, 16 commits/reads | 67.658 / 75.163 | 47.649 / 51.481 |

All three hot-process medians improve for each case. For 69-node independent
setters, every measured pair improves: median paired delta −20.583 ms, worst delta
−10.685 ms. Median total improves 29.6%; independent process medians are
67.072/66.018/72.255 → 46.512/45.987/50.494 ms. The main sequential matrix improves
78.500 → 46.408 ms (40.9%) for the same publication contract. For one long session,
the hot improvement is only 3.1%, and the wide sequential session is effectively
unchanged. Do not attribute all sequential timing changes to the removed pass or
claim universal cold-case/tail improvement. Warmup sensitivity is observed; its
specific VM/host cause was not established.

Retention is justified by the repeatable independent-setter improvement, exact
removed work, narrow production diff and semantic/security equivalence. The
long-session benefit alone would not justify a broad incremental-validation system.

The adapter retains one additional accepted frozen graph during a session,
O(tree size), alongside the existing isolated envelope; it retains no graph history.
Reference off-session median process RSS is 331,747,328 → 332,591,104 bytes;
median heap delta is 4,606,632 → 3,036,352 bytes. Raw deltas include negative GC
samples and accumulated fixture/JIT state. These are practical observations, not
an allocation or leak proof. There is no assertion that retention costs no memory.

## Differential semantics, security and lifecycle

The focused canonical/SEAM/Form/authority/lifecycle selection passes **262/262**.
The final canonical/evidence/mutation/Form/installation selection passes **124/124**
before the final partial-visit evidence assertion (included in required final checks).
There are **51 dedicated Page adapter tests**, including 32 added in I, with no
removed/weakened security assertions. Six generated seeds execute 360 operations
in 36 committed batches, comparing each success/error, error details/order, net
changes, snapshots, descriptors, revisions, serialization, identity and navigation.
Canonical data is compared directly, without normalizing differences away.

Deterministic cases cover nested arrays/objects and caller aliases, inherited
properties and dispatch, defaults/select normalization, sensitive redaction,
unknown/invalid properties, accessors without execution, hidden/symbol/custom
prototype values, cycles, sparse/nonserializable values, duplicate/multiple-parent
identities, malformed incoming envelopes, structural moves/insert/clone/remove,
failed candidate rollback/ID reuse, unchanged writes and immediate reads, conflicts,
exhaustion, empty/failed sessions, abort, retained handles and concurrent real Pages.
A trusted injected registry lookup failure exercises full commit-validation fallback
with no accepted candidate; it leaves the session repairable. Published runtime
nodes/nested properties are frozen and cannot be invalidated by retained aliases.
The accepted pair is inaccessible outside the factory/adapter closure.

Installed tests mutate the actual installed catalog after successful candidate
validation, then attempt commit directly: embedded source tampering, symlink
substitution, same-size source tampering with exactly restored mtime, retirement,
revocation and byte-identical catalog replacement. Tampering/retirement/revocation
reject; restored files never revive fenced bindings. Byte-identical replacement
still triggers ordinary fresh validation and may commit. Existing installed
scope/policy tests preserve revoked authority, cross-site/package/owner denial,
package receipt/generation changes, budget exhaustion, cancellation, native commit
uncertainty and process/drain boundaries. No candidate certificate substitutes for
any of these checks. Existing guards remain cooperative rather than preemptive.

Actual private-tarball qualification passes **412/412** five-library integration,
**35/35** provider, **20/20** real installed process-supervision and **25/25** Linux
boundary tests, zero failures/cancellations/skips. Service-free installed binary,
HTTP/assets/restart and closed configuration pass. Three independent consumers
reject all development-checkout imports and contain exactly one installed engine.
This qualifies local Unix boundaries, not hostile root writers, network filesystems,
power loss, production deployment, browser accessibility or managed WydHosting 0.4.

## Separate-client HTTP qualification

Actual H versus I: three fresh windows per configuration, twelve POSTs/window,
fresh installation/dataset/session/setup GET/CSRF, separate supervised client,
unchanged Contact payload and 1,000 ms Page ledger. Three serial controls per
observer mode also pass. The I-only optional extended attribution adds strict
source-hook brackets around candidate construction/validation and commit validation;
both implementations use the same brackets. Existing and off modes do not load them.
All 38 captures (including each series' legacy portable microcapture) complete;
no fixture failures, observation drops or hook errors. Legacy portable edit counts
remain unchanged. Contact disables Gate; it is not a Gate policy qualification.

Each entry is HTTP 200 / HTTP 500 (indeterminate), in window order:

| Provider / diagnostics | H windows | I windows | HTTP 200 aggregate |
| --- | --- | --- | ---: |
| SQLite, existing | 12/0, 10/2, 11/1 | 10/2, 12/0, 12/0 | 33 → 34 / 36 |
| SQLite, observers off | 12/0, 12/0, 12/0 | 12/0, 12/0, 12/0 | 36 → 36 / 36 |
| SQLite, extended attribution | 6/6, 6/6, 4/8 | 9/3, 9/3, 10/2 | 16 → 28 / 36 |
| JSON, extended attribution | 5/7, 5/7, 3/9 | 9/3, 7/5, 9/3 | 13 → 25 / 36 |

Each observed concurrency configuration has **36 reported native commits and 72
completed native calls**, before and after. Observers-off windows cannot supply
these counters, Page duration or guard/validation attribution; missing evidence is
not inferred. Deadline exhaustion counts: SQLite existing **5→2**, attributed
**20→11**, JSON attributed **24→12**. Cleanup can exhaust after HTTP 200, so these
are not identical to failed-response counts. Every observed 500 remains indeterminate.

Page elapsed median / p90 / max, ms: SQLite existing **844/1004/1007 →
766/880/1097**; attributed **1002/1032/1043 → 962/1004/1036**; JSON attributed
**1002/1005/1008 → 963/1004/1007**. Maximum callback sampler lateness is respectively
**375.664→449.090**, **678.862→666.619**, **481.210→469.058 ms**. These observations
include scheduling/descheduling and do not establish a queue, physical-I/O or
thread-pool causal model.

Attributed concurrency medians, inclusive ms per Page:

| Stage / count | SQLite H → I | JSON H → I |
| --- | ---: | ---: |
| Whole-Page hydrate passes | 35 → 23 | 33 → 23 |
| Canonical node visits | 1,707 → 1,113 | 1,595 → 1,113 |
| Full hydration time | 23.599 → 16.524 | 21.795 → 15.493 |
| Candidate validation time | 9.133 → 10.553 | 8.715 → 9.435 |
| Commit validation callback | 8.052 → .010 | 7.455 → .010 |
| Installed lifetime checks | 1,363 → 1,680 | 1,271 → 1,680 |

These are unequal-work Pages: faster/later successful Pages consume more PreRender
results, and failures stop at different boundaries. Increased guard counts do not
represent changed guard policy; all checks remain. Matched serial Contact retains
**866 live guards, 868 stamps, 6,076 fresh artifact inspections, four operations,
three commits and six systemSet calls** per Page. Its hydrate passes fall **15→12**,
node visits **677→541** and dehydrate stays **15**. Commit median falls
**2.893→.753 ms**; mutation median **5.263→5.063 ms**; full hydration
**9.617→8.069 ms**. Installed stamps remain **27.945→28.724 ms** at the median.

Historical H publication reported existing/off/attributed SQLite 26/34/11 and
attributed JSON 11 successes out of 36; those historical captures remain separate.
This spike reruns the actual H adapter under comparable current-process conditions,
rather than pairing I with favorable or differently instrumented historical rows.
Host/series variability is substantial. Better response counts alone do not prove
causality or HTTP reliability. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.**

## Reproduction, final gates and next correction

Run each capture alone, each destination new:

```sh
node test-support/incremental-validation-probe.mjs /tmp/NEW-off.json before off
node test-support/incremental-validation-probe.mjs /tmp/NEW-on.json before on
node test-support/prerender-integrity-probe.mjs --incremental-output /tmp/NEW-http
node test-support/incremental-validation-control.mjs /tmp/NEW-hot.json
node test-support/incremental-validation-visits.mjs /tmp/NEW-visits.json
```

Use an isolated checkout of b82a980 for before, current I bytes for after; preserve
shared probe/hooks from the archive. Repeat off captures in three fresh processes,
hot controls in three more; repeat observed once. The offline evidence packager's
usage specifies eight microcaptures, three hot controls and one visit capture plus
both HTTP directories. The source archive retains exact raw captures and sources;
no runtime file needs to be overwritten in a working checkout for reproduction.

Required final gates are `npm run check`, `npm test` (including frozen WydClient
artifact rebuilding/comparison), evidence integrity tests and `git diff --check`.
The generated verification record and final Git handoff supply exact final results.
No versions/manifests/lockfiles, frozen artifacts, historical evidence or downstream
projects change. Work is authorized for normal commit/push to origin/develop/0.3;
no release tag, package publication or deployment is part of the spike.

Next bounded correction: profile defensive envelope copying and canonical
serialization with a fixed twelve-result PreRender fixture, separately from global
Form/property validation and installed stamps. Investigate eliminating redundant
private JSON copies only when alias isolation, descriptor rejection and failed
candidate recovery can still be proven; keep full global validation where local
proof is unavailable. A general incremental graph/cache, CIR/System execution,
integrity-check caching, batching, larger deadlines and uncertain-write retry are
not justified by this spike. Remaining HTTP scheduling/installation costs still
require separate attribution and qualification.
