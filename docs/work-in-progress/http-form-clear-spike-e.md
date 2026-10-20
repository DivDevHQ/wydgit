# HTTP reliability Spike E — Form Clear cost and reset qualification

2026-10-20. Started clean on `develop/0.3` at `350ce00` (including the unrelated
CIR proposal). Node v24.21.0, Linux. CIR was neither implemented nor modified.
No versions, manifests, lockfiles, Page limits, native transactions, authority,
HTTP outcomes or release state changed. **WYDGINE-0.3-HTTP-LIMIT remains OPEN.**

Clear contained avoidable whole-App copy/validation work for unchanged property
writes. Retained a small server-only helper used by Page Form Clear. The shared mutation
implementation and immutable standalone client artifacts remain unchanged.
**No initialization snapshots, saved snapshots, Reset operation or dirty-field
tracker were added.** Clear empties values; restoring initial values would change
its documented semantics.

## Audit: implemented behavior and callers

The authoritative [Form contract](../forms.md), [mutation contract](../mutation-model.md),
[events/lifecycle contract](../events.md), [object model](../object-model.md),
[SEAM](../seam.md) and founding architecture govern this investigation.
The [Spike D intervals](http-native-settlement-gap.md) overlap: its 46.280820 ms
Clear is inside 55.238447 ms Page continuation→dispatch, which is inside
55.720757 ms native completion→inspection. Those numbers are never added.

- `prototypes/objects.json` defines the inherited portable `Clear()` method as
  `Me.FormState("clear")`. SEWN admits this closed kernel operation through
  `sewn/bindings.js`. The shared rules live in `object-model/forms.js`.
- `execution/page.js` owns the measured request-local Page implementation.
  `examples/guestbook/submit.bas` calls Clear only after SaveEntry reports success,
  then changes acknowledgment content. This is the installed Contact workload.
- `execution/instances.js` also hosts FormState for server components and the
  standalone WydClient execution controller (`packages/wydclient/src/execution.js`).
  It uses the same rules and ordinary runtime edits, with controller publication.
  Its callers remain unchanged and do not opt into this optimization.
- The HTTP-served adapter `packages/wydgine/runtime/wydclient/index.js` hosts the
  same Form methods on its semantic node projection. It resolves all proposed
  properties before updating semantic values and writing native controls in order.
  Its parent-linked traversal, control writes and event paths remain unchanged.
- `packages/wydclient/src/controls.js` separately implements presentation-control
  reset/success handling using existing primitive `record.initial` values and
  input drafts. This is not semantic Form Clear or saved-state restoration. It
  contains DOM references and must not become a generic serializable snapshot.
  BackOffice's separate UI cleanup functions likewise are not Form Clear.
- Direct shared-rule callers in `test/forms.test.js` exercise canonical edits;
  other Page, package, client and settlement tests reach these same bindings.
  Private construction drafts expose no alternate FormState reset implementation.

Canonical hydration's `resolveProperties` establishes declared defaults, overridden
by authored properties. Each Page starts by hydrating an independent canonical
App copy, including trusted preservation of transient sensitive values. Bind and
POST adaptation then change current values. There is no Form initialization cache,
last-saved baseline, generic Restore method or automatic persistence. A distinct
semantic Reset remains deferred. Applications can explicitly Bind selected values;
this does not establish a confirmed durable saved baseline.

Clear visits every descendant in lexical slot/canonical child order, including
intermediate layout objects, disabled and hidden fields. Server traversal is bounded
to 10,000 nodes and reducible by `formNodes`; the served client bound is 1,000.
Nested Forms and duplicate names fail canonical validation. Repeated typed fields
with distinct names are supported; repeated submitted multi-choice values bind
arrays through the existing adapter.

For every discovered field, shared calculation validates configuration and name
uniqueness, finds its inherited field kind and emits five ordered property writes:
value, valid, validationMessage, errors, warnings. Values become `""`, `false`,
`null` or `[]` according to current type/multiple configuration. Validation becomes
true/empty without rerunning required/length rules. Form validity is then set true;
Form errors/warnings and all other configuration remain as before. Validate is a
separate operation and can subsequently reject a required empty value. Thus Clear
restores neither authored values nor even nonempty prototype defaults.

Before the optimization every one of these `5*n+1` property writes called
`createEdit.apply`: hydrate+dehydrate the entire accepted App, edit a candidate,
then hydrate+dehydrate the entire candidate, even for an identical primitive or
empty array. Edit creation additionally dehydrates/indexes the App; commit hydrates
again and computes a sorted net change set by comparing serialized local state
for every node. This is deliberately conservative mutation validation, not a
persistent Store transaction. For two fields: 11 candidate edits, 22 candidate
hydrations, plus commit hydration. No repeated initial/current comparison or
special field dirty tracker existed.

All writes require a live branded context, edit capability, exact visible/editable
object grants and declared properties. Page guards reject stale invocation handles,
read-only/Unload/committed-response edits and lost session/request lifetimes.
Canonical IDs/prototypes/provenance and containment remain stable; commits produce
new immutable node snapshots as before. There are no per-property Change events
in Page Clear, no notification queue and no I/O/persistence stage. Normal handler
and phase sequencing observes the final atomically accepted runtime. The mutation
change set is net dirty state, not an audit log or saved baseline. Client native
control writes and component controller publication are separate existing paths.

Canonical field properties are bounded plain JSON validated by `clean`, with no
privileged native objects, accessors, cyclic references or prototype instances.
Password values are private transient strings; ordinary reads/exports redact them.
Runtime/member/lifecycle handles and DOM/control references live outside canonical
properties. Snapshotting those host structures would be unsafe, and preserving
another copy of sensitive field initialization data is unnecessary here.

## Observed measurements: focused baseline and comparison

[Machine-readable evidence](../../test-support/form-clear-evidence-2026-10-20.json)
retains all raw measured rows, resulting public field envelopes, source hashes,
HTTP windows/series summaries, first failures and artifact hashes. A rejected
shared-code candidate is [archived separately](../../test-support/form-clear-shared-candidate-evidence-2026-10-20.json.gz)
and excluded from all final comparison tables below. The initial
exploratory text+checkbox run is explicitly excluded from comparisons. A restricted
HTTP worker failure with no captured requests is also retained separately.

Reproduce serial measurements alone, once for each implementation:

```sh
node test-support/form-clear-probe.mjs /tmp/NEW-clear-capture.json LABEL
```

The fixed fixture is Page → Form → Section → Block → 0/2/8/24 fields, retaining
ordinary App metadata outside the Page. Two fields are text input/text area,
representative of Contact's two text values. Larger forms repeat text input,
text area, checkbox, radio group, checkbox group, single select, multiple select
and password with unique names. Authored changed values are nonempty; unchanged
values are the relevant empties. Validation is initially clean in the timing
fixture; dirty validation is covered separately by semantic differential tests.
All fields are changed or all unchanged as indicated. Configuration is identical.

Each of three fresh processes per implementation executes four warmups then
15 recorded fresh isolated Pages per case (45 recorded Clears per case and
implementation). No concurrent HTTP load or other suite runs during these captures.
Only `execution/form-clear-edit.js` differs among paired source hashes; Page,
shared mutation code, observation and fixtures are identical before/after. The
baseline helper calls `edit.setProperty(id,name,value)` and returns true, exactly
preserving the original candidate behavior. The evidence retains its complete
source so the baseline can be reproduced in a temporary local copy of this helper,
then restored to the final implementation. There is no runtime benchmark switch.
Every resulting public field envelope matches before/after, including
configuration, types and validation. Sensitive values are separately checked by
trusted semantic tests, never exported into these diagnostics.

Median total Clear milliseconds for each independent run:

| Fields | Changed | Before runs 1 / 2 / 3 | After runs 1 / 2 / 3 | Applied edits before → after |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0.479303 / 0.487549 / 0.497537 | 0.263707 / 0.223130 / 0.305676 | 1 → 0 |
| 0 | 0 (changed case) | 0.424710 / 0.379465 / 0.392510 | 0.191862 / 0.178747 / 0.265630 | 1 → 0 |
| 2 | 0 | 3.054465 / 3.146548 / 3.248189 | 0.354267 / 0.273395 / 0.280719 | 11 → 0 |
| 2 | 2 | 2.871831 / 3.006334 / 3.270942 | 0.793916 / 0.846244 / 0.925013 | 11 → 2 |
| 8 | 0 | 25.716793 / 25.475335 / 26.372454 | 0.505372 / 0.564483 / 0.664823 | 41 → 0 |
| 8 | 8 | 25.081105 / 23.884879 / 25.109094 | 5.349747 / 6.216370 / 5.581243 | 41 → 8 |
| 24 | 0 | 169.890485 / 168.763700 / 165.227454 | 1.312051 / 1.384378 / 1.601688 | 121 → 0 |
| 24 | 24 | 167.485683 / 172.949322 / 164.718092 | 34.358459 / 36.216479 / 37.462687 | 121 → 24 |

For example, two changed fields, run 1, median constituent milliseconds:

| Interval | Before | After |
| --- | ---: | ---: |
| Traversal + field visibility | 0.009157 | 0.008456 |
| State/configuration calculation | 0.006863 | 0.006022 |
| Edit setup (App copy/index) | 0.039204 | 0.040306 |
| Property operations | 2.648921 | 0.574442 |
| Commit (validation/change report) | 0.125747 | 0.139693 |
| Total Clear | 2.871831 | 0.793916 |

Constituent spans are disjoint, nested inside total Clear. Independently computed
medians must not be added to reconstruct a median total. Per-row residual time
contains Page guards, bookkeeping, loop overhead and synchronous observation.
There is no invented notifications or persistence interval. The evidence contains
all minima/medians/p90/maxima and individual rows, rather than a favorable sample.
Elapsed spans include scheduling/GC and timing overhead; they are not CPU profiles.
Absolute small-fixture times do not predict installed Contact's larger App cost.

## Proven inefficiency and retained optimization

The source path and deterministic work counts establish redundant whole-App
validation/copying for identical writes. The repeated large reduction in the
property-operation span supports retaining a narrowly bounded correction.
It does not establish a defect in native settlement or Page deadline accounting.

The server-only `execution/form-clear-edit.js` helper checks the same live branded
context, edit capability and visibility/edit grants for every generated property
write, then validates JSON input. It compares that property with the current
canonical runtime immediately before this Clear. Each generated patch contains a
property once and each canonical field ID occurs once, so this comparison remains
valid throughout the single fresh Clear edit session. It is not a general setter
and must not be used for arbitrary multi-write edit sessions. Nothing is compared
with initialization or saved state.

A proposed identical primitive/null or empty array needs no candidate: the existing
property is already schema validated. Changed writes still call ordinary
`edit.setProperty` in the original order, including its full canonical candidate
validation and property identity rules. Nonempty containers do not use elision.
No general deep comparison, cloning cache, new snapshot, persistent allocation or
shared mutation API is introduced. Page guards and the ordinary edit session own
openness, stale invocation checks, read-only/Unload/response guards, atomic commit
and revision validation. There is no new authorization source or grant.

Only Page `FormState('clear')` calls this helper. Set, Bind, Validate, structural
edits, controller/client callers and native operations retain existing behavior.
Even an unchanged Clear checks every requested field/Form write and commits a fresh
validated immutable runtime with the same revision advance and empty net changes.
Error/failed-edit atomicity, sensitive-state preservation and ended contexts remain
enforced. No mutation path needs to participate in a new dirty tracker.

Host-only `execution.observeFormClear` requires existing diagnostic timing opt-in.
It emits one frozen fixed-schema numeric/Boolean record per Clear, including failed
Clears, and retains no identities, values or context. The Page creates no timers,
Promises, awaits or I/O for this observation. Observer exceptions are swallowed.
The test-only Contact collector retains at most 64 records, with request ordinals
from its existing async context, and counts overflow. Timing overhead is not
calibrated; both implementations use identical instrumentation. Public HTTP
responses and diagnostics do not receive these records.

## Observed HTTP qualification

After focused semantic checks, three fresh windows per implementation used:

```sh
node test-support/http-concurrency-probe.mjs --output /tmp/NEW-contact-window --form-clear
```

This extends Spike D's `--native-gap` mode with Clear stages; all its resource,
inspection and native-gap observation remains enabled. Each fresh SQLite Contact
installation uses one setup GET/anonymous session, disabled Gate, identical POST
payload, separate supervised client, no retry and actual concurrency 12 at client,
server, admission and Page ledger. Each runner completed, cleaned its fixture and
reaped its client. Every response was fully received. All windows record 12 reported
commits, 24 completed native calls, zero pending, 216 POST inspection FS mappings
and 24 lifecycle mappings, without dropped observations or hook errors.

| Window | HTTP 200 | HTTP 500 / indeterminate | Clear median / maximum ms | Page elapsed median / maximum ms |
| --- | ---: | ---: | ---: | ---: |
| Before 1 | 5 | 7 | 22.065609 / 34.914345 | 1003 / 1077 |
| Before 2 | 5 | 7 | 24.308920 / 34.093236 | 1002.5 / 1035 |
| Before 3 | 1 | 11 | 22.934033 / 55.609426 | 1002 / 1045 |
| After 1 | 8 | 4 | 4.953661 / 8.796950 | 947.5 / 1004 |
| After 2 | 5 | 7 | 5.989062 / 8.451370 | 1002.5 / 1059 |
| After 3 | 3 | 9 | 6.895077 / 19.104134 | 1003.5 / 1047 |

Totals: **11/36 → 16/36 HTTP 200**, **25/36 → 20/36 HTTP 500/indeterminate**;
**36 reported commits and 72 completed native operations in each group**. Every
500 matches the historical prerender deadline signature. The original Spike D
2/12 success window remains separate historical evidence, not a paired baseline.
The observed improvement is descriptive across these six windows, not statistical
qualification of HTTP reliability. Native operations and reported commits are not
interchangeable with HTTP receipt or successful Page publication.

In every Contact Clear, attempted writes stay 11 and applied candidates fall
11 → 2. Before, median property-operation spans range 20.897–23.063 ms by window;
after, 3.849–5.325 ms. Traversal/calculation medians remain below 0.028 ms; commit
still costs approximately 0.8–1.1 ms at the median. Page elapsed uses the existing
Date-based ledger through cleanup/settlement; it can exceed 1,000 ms without changing
the ceiling. Clear and FS observations are monotonic and nested/overlapping;
none of these totals or maxima should be added.

Independent POST filesystem maxima, milliseconds (invocation → first hook `before`):

| Window | Inspection | Lifecycle | Maximum sampler lateness |
| --- | ---: | ---: | ---: |
| Before 1 | 368.143198 | 541.954357 | 360.740296 |
| Before 2 | 380.190436 | 505.137584 | 457.163360 |
| Before 3 | 399.229261 | 500.424309 | 449.471003 |
| After 1 | 408.889495 | 720.596431 | 405.307889 |
| After 2 | 401.362333 | 706.886511 | 584.037110 |
| After 3 | 465.283209 | 651.601759 | 601.719069 |

After-optimization hook before→after maxima are at most 0.013184 ms; subsequent
hook-after→existing continuation maxima are at most 0.127440 ms. Long waits still
precede hook delivery. These markers do not expose physical I/O completion,
thread-pool execution, OS scheduling or exact Promise settlement. Sampler tails
remain incomplete. The optimization does not establish which of these mechanisms
causes the remaining delays. The 1,000 ms Page budget and all HTTP/native outcome
semantics remain unchanged. **The HTTP issue remains OPEN.**

## Regression, checks and handoff

New semantic/differential tests cover empty/unchanged/changed and 24 repeated typed
fields, nested layout, forbidden nested Forms/duplicate names in existing tests,
authored/missing/default/null values, current multiple-selection configuration,
validation reset and later validation, Bind after Clear, password redaction/private
clearing, unchanged configuration and IDs, ordered observations without synthetic
Change, repeated Clears, explicit rebinding rather than saved-baseline restoration,
cancelled Submit/default suppression, cancelled requests, expired handles, ended
contexts, visibility/traversal/reduced bounds, unchanged-field and Form authorization,
failed JSON/property mutations, inserted/removed field discovery without caches,
revision conflict, fresh no-op commits and canonical
state/change-set equivalence with ordinary sequential edits.

Intermediate new-test errors were fixture expectations: the first selection was
31/39 (seven assertions assumed revision survived later Page validation rehydration;
one expected an ended context as a returned Page error rather than early rejection).
Corrected tests passed 39/39 before mutation optimization. The initial shared
candidate passed 83/83, then 134/134 targeted tests and 27/27 semantic/evidence tests.
However, its first required `npm test` exited in pretest with **zero tests run**:
immutable `sizes-0.1.0-alpha.11.json` build output changed. That candidate was reverted
and its complete measurements/failures retained in the compressed archive; its
16/36 → 23/36 Contact result is not the final implementation's qualification.
No immutable artifact or version was changed. The server-only replacement passes
`npm run build:client` and the 87/87 focused selection. Final broader checks follow
below. Restricted Contact attempt: worker/protocol failure, zero captured requests.
Three final authorized before and three final authorized after windows all completed.
The archive additionally preserves the original six completed candidate windows.
All focused test selections have zero skipped/cancelled tests. Evidence never
converts an uncaptured outcome into a pass.

The first full server-only `npm test` ran 1,653 tests: **1,651 passed / 2 failed**.
One historical evidence test required today's source to equal Spike D's capture;
it now recomputes the original fingerprint from a retained compressed source
archive of all 133 files at `0eb374f105c73b9c8ca555ec5bd4dc5ee3ecb3c5`, matching
`1bcbdc9402dad69d4711a2274540ce2562624f3e768fbe5d629eff7a52c491c9`.
Original capture data and artifact assertions remain unchanged. The other failure
counted unrelated test-runner promises (16 versus 9) in the diagnostic resource
comparison. That test now uses AsyncLocalStorage to count only resources created
inside each measured operation, retaining equality assertions across all four
modes. Neither correction changes runtime scheduling or observation. An initial
restricted two-file runner reported only file-level results and is not counted
as individual regression coverage; the explicit final selection below is used.

Final required verification: `npm test` passes **1,653/1,653**, zero failures,
cancellations or skips, including immutable WydClient rebuild verification.
`npm run check` passes: 3 complete pages, 42 internal links and unique anchors.
The final explicit selection passes **140/140**, zero failures/cancellations/skips:

```sh
node --test --test-isolation=none test/form-clear.test.js test/form-clear-evidence.test.js test/forms.test.js test/native-settlement-gap.test.js test/native-settlement-gap-evidence.test.js test/mutation.test.js test/execution-contexts.test.js test/events.test.js test/http-diagnostics.test.js test/operation-completion.test.js test/native-stage-timing.test.js test/fsreqpromise-inspection-correlation.test.js test/fsreqpromise-contact-correlation.test.js test/guestbook-package.test.js
```

`git diff --check` passes. Captured source/artifact hashes and all raw final
observations pass offline audits. Skipped additional qualification: dedicated browser
and deployment runs, a separate installed-engine matrix, full provider/admission ladders,
other concurrency levels, JSON HTTP comparison, and human accessibility checks.
No snapshot-reset feature is qualified. The remaining whole-App cost of
actual changes, commit hydration/change-set calculation, controller/client-specific
costs, and FS/OS/runtime attribution are possible future investigations, not changes
implemented here. No budget increase, service-boundary bypass, release or deployment.


## Changed files and delivery scope

- Runtime: `execution/page.js`, new `execution/form-clear-edit.js` and
  `execution/form-clear-observation.js`, plus HTTP `pipeline.js` under
  `packages/wydgine/src/engine/`. Shared mutation code and client distributions
  have no changes.
- Harness/evidence under `test-support/`: `http-concurrency.js`,
  `http-concurrency-probe.mjs`, new `form-clear.js`, `form-clear-probe.mjs`,
  `form-clear-evidence-2026-10-20.json`, compressed rejected-candidate evidence,
  and compressed original Spike D source. The final evidence includes the exact
  captured benchmark source strings, so future runtime edits do not invalidate
  historical provenance audits.
- Tests: new `form-clear.test.js` and `form-clear-evidence.test.js`; historical
  `native-settlement-gap.test.js` and `native-settlement-gap-evidence.test.js`
  preserve their resource/outcome checks with corrected attribution/provenance.
- Documentation: this report, `docs/forms.md`, `docs/mutation-model.md`,
  `docs/milestones/0.3-reliability.md`, and an Unreleased `CHANGELOG.md` entry.

Work is scoped to the authorized `develop/0.3` delivery. No unrelated starting
changes existed. Commit/push is authorized; final Git identity and remote HEAD
verification are supplied in the delivery response. Versions, CIR, native
transactions, Page deadline and HTTP semantics remain unchanged. Residual failures
and filesystem scheduling delay remain open work, without a reliability waiver.
