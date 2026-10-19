# HTTP reliability and session qualification — 0.3-J increment 8

Platform/Wydgine/WydHosting alpha.22 → **0.3.0-alpha.23**. Node 24.21.0,
npm 11.19.0, Linux, 2026-10-19. Started clean on `develop/0.3` at
`2ca287deda07d7b4474ee45ab68771d626339da3`, identical to fetched origin.
No deployment, production data, new dependency or persisted schema change.
Gate advances alpha.6 → **0.1.0-alpha.7** for the expiry correction below.
Store alpha.5 and standalone Client alpha.11 remain unchanged.

## Historical HTTP failure: OPEN

**WYDGINE-0.3-HTTP-LIMIT remains unresolved.** No historical cause or fix is
claimed. Controlled limit/cancellation failures establish coverage, not attribution
of the old intermittent Contact/hosting failure. Passing requests or suites do not
establish resolution. See [retained evidence](milestones/0.3-reliability.md).

The native HTTP hostname boundary validates trusted routing before App admission.
Hono collects bounded forms, then the Page pipeline checks the installed catalog,
route, Session, context and placement. `executePage` hydrates a request-local tree
and creates one shared execution ledger: Page events, components, workflows and
services cannot reset its counters. Session authorization precedes service binding;
the canonical dispatcher checks authority, JSON budgets and native handler admission.
Page completion retains admitted native work through cleanup and settlement. The
response is selected separately from native HTTP publication; Store commit and client
delivery are independent boundaries. Host admission releases after pipeline cleanup.

| Failure category | Evidence / existing public behavior |
| --- | --- |
| Execution deadline | Ledger `timeMs`, configured effective ceiling and observed wall elapsed; Page failure normally 500 |
| Service calls / steps / iterations / other ledger counters | First exhausted counter, bound and used count; generic LIMIT alone cannot distinguish these |
| Cancellation / ended ledger | First resource `guard` or `closed`; follow-on cleanup LIMIT is not proof of timeout |
| Workflow/schema limit | May reject before an execution ledger exists; do not invent an exhausted counter |
| Request size / service JSON result | Separate parser/dispatcher budgets; no ledger-counter attribution without its meter; legacy form parser retains sanitized 500 |
| Render/file output size | RESPONSE/FILE/PRESENTATION limits remain separate from SEWN accounting |
| App/placement fence | Host admission, session guard, catalog and context checks remain independent; stale/stopped rejection is not budget exhaustion |
| Host request bound | Node request collection timeout is distinct from the shared 1,000 ms Page ledger; BackOffice has its own parent deadline checks |
| Native/provider failure | Sanitized service error; actual provider details and private exceptions are not included |

No HTTP status contract changes, limit increases, paused I/O charging, automatic
mutation retries or weakened assertions are included.

## Private diagnostic contract

Existing synchronous trusted `execution.observeBudget` remains unchanged.
Optional **`execution.observeHttp(record)`** receives one frozen
`wydgine.http-diagnostics/1` record after a non-transfer Page pipeline finishes
response cleanup. It joins the existing frozen meter and Page phases/spans with:

- Pipeline failure phase and bounded code; first cleanup code separately.
- Whether Page execution reached its ledger/settlement observation.
- Service calls admitted to completion, calls whose native handler began, pending
  calls after settlement, and calls reporting a commit. Multiple `begin` checks
  for one service count once. A cancelled precommit call still records native entry.
- Existing operation outcome (`not-committed`, `committed`, `indeterminate`) or
  `unknown` when Page execution did not produce an outcome.
- Native status, headers published, response ended, and disconnect state.
- Monotonic pipeline elapsed time and process event-loop active/idle deltas.

`headersPublished`/`responseEnded` report native transport acceptance, **not client
receipt**. A handler may commit without reporting it (notably nested private Gate
storage); the existing conservative outcome remains authoritative. Page admission
is distinct from host admission, which precedes this hook. Transfer, BackOffice,
assets, form collection and hostname/admission rejection are outside this hook.
The meter's first failing Page phase supplies detail within the pipeline's `page`
phase. Event-loop deltas include overlapping requests and native runtime activity:
they are neither per-request CPU measurements nor event-loop-delay attribution.
They can support further investigation but cannot prove why a provider was slow.

The engine retains one record per observed request, no history, queue, timer,
disk log or external telemetry. Fields come from fixed kernel phases/counters;
there are no paths, URLs, identities, request values, cookies, credentials,
capabilities, Store records or exception messages/stacks. Public responses and
runtime-module allowlists do not expose it. Synchronous observer exceptions are
ignored; trusted observers must be bounded and nonblocking and manage their own
retention. Historical Contact and hostname assertions retain only the last eight
snapshots in fixture-local memory for failure evidence.

## Controlled investigation and checkpoint A

Native baseline: focused hardening, hostname, transport, shared ledger, resource,
Gate/session/membership/HTTP tests **88/88**, **14.104 seconds**.
`/tmp/alpha23-baseline-focused-native.log`. A preceding restricted-sandbox run
reported three file-level failures and four passes, with subprocess output loss;
it is not native HTTP evidence and is retained separately.

`test/http-diagnostics.test.js` forces step and service-call ceilings to zero and
advances a controlled clock across the unchanged 1,000 ms ceiling. It checks one
private record, genuine category/bound, sanitized bodies, preadmission rejection
and observer isolation. The unchanged Contact/provider barriers exercise JSON and
SQLite precommit cancellation, JSON submitted-rename uncertainty, actual TCP loss,
held Page.Load/drain and sibling survival. Their new assertions join publication
and native-entry evidence without modifying the Contact application.

Focused diagnostics + completion + shared budget + six HTTP probes: **22/22**,
**6.932 seconds**, `/tmp/alpha23-http-diagnostics2.log`. Initial new fixtures had a
name collision, unsupported workflow expression/handler form and a no-work step
probe; these were corrected without runtime or assertion relaxation. The bounded
experiment budget is these probes plus final repeated focused/integrated runs;
there is no unlimited brute-force search or historical closure claim.

## Gate contention and demonstrated expiry correction

Gate keeps accounts, permissions, credentials and sessions in one revisioned
bounded directory. Ordinary resolution reads it and writes `lastSeenAt` on every
successful touch, even within one millisecond. Policy evaluation reads current
persisted state without touching. Mutation retries reread/revalidate at most three
times on conflict; busy/I/O fail immediately. JSON queues cooperating local writes
and checks revisions; SQLite uses its existing transaction/revision checks. Neither
provider makes an earlier read immune to competing directory writes.

**Proven separate defect:** a touch validated before persistence could return
`authenticated:true` after absolute or idle expiration while its update was held.
The old callback checked time before the awaited write, with no completion-time
expiry check. Both actual providers reproduced the failure with a barrier immediately
before CAS submission and a controlled clock. Logout/revocation/password-change
and permission-change races already reread on stale revision as intended.

Gate alpha.7 checks absolute expiration and idle elapsed time again after successful
persistence, using the timestamp from the successful CAS callback. It does not reset
activity to the later completion time. Expiration returns `GATE.SESSION_INVALID`;
failed persistence remains unavailable, never successful authentication. If this call appears idle-expired, one fresh read checks whether newer durable
activity kept the session alive, including current permissions/membership. Read
failure stays unavailable. No extra write, retry, schema, configuration or service-API
change is introduced; the normal path has no extra read. This
is a resolution-completion guard, not atomic cancellation of already admitted work.
It does not make revocation simultaneous with provider completion across processes.
Public HTTP continues to map invalid versus unavailable sessions by existing rules.

`test/gate-session-contention.test.js` holds a real provider update while an independent
Gate runtime commits logout, revocation, password rotation or permission changes.
It also crosses absolute/idle expiry, injects conflict/busy/I/O, verifies exactly
three/one attempts, recovers the same session, and loads two distinct principals.
Before correction the first native run had **10/16 pass**, four genuine expiration
failures and two fixture projection mistakes (`user.id` versus `userId`). After
correction and fixture repair, these tests plus Gate/membership/HTTP regressions
pass **55/55**, **5.214 seconds**, `/tmp/alpha23-gate-fixed-native.log`.

Additional real HTTP JSON/SQLite tests mix eight simultaneous discovery/invocation
requests, permit only completed or sanitized unavailable outcomes, prohibit cookie
deletion, verify sequential recovery, and then require rejection after logout.
Existing BOREL-04/06 cover eight siblings and injected transient errors; BOHTTP-02,
Gate membership/scoped-policy/store suites retain suspension, credential rotation,
idle/absolute expiry, current permissions and exact foreign-site isolation. Same
principal IDs across independent sites remain covered by scoped-policy fixtures;
this does not implement shared cross-site authentication.

**Scheduling decision: retain existing touches.** A minimum interval would round
or truncate durable idle activity and needs an explicit policy. Sharing an in-flight
successful authentication result risks stale permissions/revocation. A local mutex
adds queue/admission policy, does not solve independent processes and could serialize
unrelated users sharing the directory. This mission adds no cache, mutex, queue,
interval or retry expansion. Redundant writes remain an availability/retention cost,
and simultaneous requests can still receive 503. No high-volume session-backend,
all-request-success guarantee, heap-growth stress qualification or cross-process
atomic cancellation is claimed. The new runtime guard uses one timestamp/result
per call and introduces no accumulated session scheduling state.

Intermediate integrated evidence is retained, not counted as passing qualification:
`/tmp/alpha23-checkpoint-a-full.log` had **1501/1504**, three obsolete escaped
launcher-version expectations corrected to alpha.23. The next in-progress combined
run had **1511/1520**, the four proven expiry failures, two new fixture projection
errors and three supervised-process failures. That run overlapped subsequent Gate
version/fixture edits and is not an immutable-source checkpoint. A fresh combined
run after all runtime/version edits is required before committing these changes.

The fresh combined A/B run passed **1522/1522**, zero failures/cancellations/skips,
**69.138 seconds**, `/tmp/alpha23-checkpoint-ab-full.log`. It includes the two
mixed HTTP contention cases and all process/Linux/security/lifecycle regressions.
`npm run check`, dependency graph and whitespace checks passed. The earlier
supervised-process failures did not repeat under the fixed source/version set;
no supervisor code or assertion changed and no independent root cause is claimed.


A further deterministic postcommit barrier proves that a newer durable touch keeps
an older delayed completion valid. The initial timestamp-only correction failed
both provider cases; `/tmp/alpha23-gate-newer-touch-before.log` retains that evidence.
The final conditional fresh-read correction passes the two new cases, the earlier
16 contention cases and Gate/membership/HTTP regressions **83/83**, **13.202 seconds**,
`/tmp/alpha23-gate-final-focused.log`. No invalid-session conclusion comes from an
old idle timestamp alone. This changes no touch frequency or conflict bound.
The prior 1522-test post-documentation run also passed (70.093 seconds), before
these last two regression cases and conditional-read refinement. Final verification
must use the expanded source, not infer its success from those earlier totals.
