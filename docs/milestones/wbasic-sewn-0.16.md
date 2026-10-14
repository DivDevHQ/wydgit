# WBasic / SEWN 0.16 — Conditional DO loops

Implemented on `develop/0.3`; the authoritative wire version is `sewn/0.16`.
Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2 remain unchanged, following
0.13–0.15 policy. No dependency, manifest or lockfile changes are needed.

```vb
DIM counter AS Integer = 0
DO WHILE counter < 10
    counter = counter + 1
LOOP
DO UNTIL counter >= 20
    counter = counter + 1
LOOP
DO WHILE TRUE
    EXIT DO
LOOP
RETURN counter
```

Conditions evaluate before each potential iteration, through the existing typed
expression compiler/executor. WHILE enters on Boolean TRUE; UNTIL on Boolean FALSE.
There is no coercion or cached condition. Initially terminating loops do no work.
Known invalid types fail compilation with source locations; dynamic invalid types
produce SEWN.TYPE. Approved procedure calls in conditions retain ordinary costs,
side effects, authority and contracts.

## Scope and control flow

DO creates no implicit bindings. Existing outer mutable variables retain updates;
compiler visibility and branch scope follow the established rules. DIM/CONST
inside loops remain unsupported because declarations live for the invocation.
Numeric FOR bindings stay local/read-only; FOR EACH behavior is unchanged.

EXIT DO targets the nearest lexical DO in the same procedure, even through a FOR,
IF, SELECT CASE or TRY. A nested DO consumes only its own exitDo signal. EXIT FOR
continues to target the nearest FOR through DO; DO does not consume it. Validation
checks unreachable branches and resets lexical loop depths for every procedure.
RETURN propagates to the containing procedure; STOP propagates in workflows and
remains illegal in procedures. Neither loop kind swallows nonlocal errors.

TRY/CATCH/FINALLY is unchanged: normal exit/return executes FINALLY, whose own
control flow keeps existing precedence. Recoverable TYPE/REGEX failures can be
handled. Fatal LIMIT/denial failures bypass FINALLY and cannot be recovered or
superseded by an exit. No application-visible control-flow exceptions are added.

## Wire grammar and enforcement

Envelope and expressions extend 0.15 unchanged. New statements:

| op | Required fields |
| --- | --- |
| do | mode (`while` or `until`), condition expression, body statement array |
| exitDo | none |

Fields are closed; missing conditions/bodies, extra fields, malformed nested
expressions/statements, unsupported modes and illegal exits fail SEWN.INVALID.
Earlier schemas reject these statements; no historical artifact is reinterpreted.
Static linking propagates 0.16 when any linked definition requires it. Prototype
validation accepts 0.16, retaining dedicated static identity and authority checks.

Every condition evaluation spends normal expression steps. Every attempted
continuing iteration spends a step and increments the existing total-iteration
counter, before executing even an empty body. Body statements spend ordinary
steps. Default maxima remain 10,000 steps, 1,000 shared iterations and 1,000 ms,
with existing context reductions, nesting, procedure depth/count and value bounds.
Counters/deadline belong to the invocation closure, including nested loops,
procedure frames and static calls; nothing replenishes them. Infinite WHILE TRUE
and UNTIL FALSE therefore fail under controlled SEWN.LIMIT without test timeouts.
Existing event cancellation remains supported; no new cancellation API is added.

## Portability and size

Wydgine and WydClient use the same validator/executor. The new suite repeats
serialized workflows in an independently bundled browser executor and excludes
WBasic/compiler, static resolver, Node modules and storage from that bundle.
Client Change handlers verify cancellation and controlled empty-loop failures.

Bootstrap alpha.2 minified/gzip/Brotli: 45,465 / 15,469 / 13,632 bytes, versus
45,139 / 15,325 / 13,553 at 0.15: +326 / +144 / +79 bytes. Alpha.1 is unchanged.
The reproducible minified browser event-executor harness (execute + ExecutionContext,
including bundled regex fallback) is 197,830 / 63,540 / 55,457 bytes, versus
197,282 / 63,364 / 55,324 at HEAD before 0.16: +548 / +176 / +133 bytes. This is a
standalone comparison harness, not an additional shipped bootstrap asset.

## Verification

The focused suite covers all WHILE/UNTIL nesting combinations, DO/FOR EACH/numeric
FOR in both directions, both exit signals, RETURN/STOP, IF/SELECT/TRY exits,
FINALLY, strict typing, source diagnostics, schema closure and historical rejection.
It also checks empty/nested/procedure/static infinite loops, cumulative counters,
recoverable-error retries, attempted LIMIT recovery, deadlines and client parity.

- Focused `node --test --test-isolation=none test/sewn-do.test.js`: 7 groups passed.
- Final `npm test`: 666 passed, 0 failed, including server/browser conformance,
  regex security, current Guestbook install/HTTP/persistence and archived
  Guestbook/Taskboard source compilation baselines.
- `npm run check`: passed (3 complete pages, 42 internal links and unique anchors).
- `git diff --check`: clean; branch, working tree, full diff and sizes reviewed.

The initial sandboxed full run could not exercise required local HTTP resources;
the successful full run used approved unrestricted execution.

## Deferred work

No postcondition DO/LOOP WHILE/UNTIL, bare DO, CONTINUE, WHILE/WEND, GOTO,
coroutines, new iteration protocols, mutable collections, interfaces, Cast,
calendar libraries or registry/application expansion. Archived Guestbook/Taskboard
checks remain compilation baselines rather than full archived host replay.
