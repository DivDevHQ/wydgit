# SEWN — 0.2-M

SEWN means **SEAM Execution Workflow Notation**. WydStitch writes it. SEWN describes
it. SEAM constrains it. Wydgine or WydClient runs it. [WydBASIC](wydbasic.md)
compiles to SEWN in 0.2-K; future WydStitch dialects may use the same boundary.

A historical `sewn/0.1` document is exactly `{ "schema": "sewn/0.1", "body": [] }`.
The closed executable grammar is defined in `wydgine/sewn/schema.js` and validated by `validate.js`.
Unknown fields/operations, accessors, functions, native objects, cycles, sparse
arrays and reserved `__proto__`, `constructor`, `prototype` keys are rejected.
Programs are copied and frozen before execution. They contain only JSON data.

## Expressions and statements

Every expression is an object with `op` and the following required fields:

| op | fields / meaning |
| --- | --- |
| literal | value: any safe JSON literal |
| variable | name: declared execution-local variable |
| context | name: ME, EVENT, REQUEST, RESPONSE, SESSION, PAGE, SERVER or CLIENT |
| read | target: expression, key: safe own JSON key or bounded array index |
| array | items: expressions evaluated in order |
| object | fields: safe keys mapped to expressions, evaluated in lexical key order |
| invoke | target, method, args: controlled safe facade call |
| binary | operator, left, right |
| not | value: Boolean expression |

Binary operators are `=`, `!=`, `<`, `<=`, `>`, `>=`, `AND`, `OR`, `+`, `-`, `*`,
`/`, `concat`. Equality is strict scalar equality (different scalar types compare
unequal); arrays/objects cannot be compared. Ordering requires matching Number or
String types. Arithmetic requires finite Numbers and finite results; division by
zero fails. Concatenation requires Strings. Boolean operators require Booleans;
AND/OR short circuit. There is no coercion or source expression parsing.

| statement op | fields / behavior |
| --- | --- |
| declare | name, value: create variable; redeclaration fails |
| set | name, value: replace existing variable |
| if | condition, then, optional else: Boolean branch with statement arrays |
| forEach | name, items, body: Array iteration; fresh loop variable removed on exit |
| call | target, method, args, optional into: await controlled call |
| service | library, method, input, optional into: await SERVICES.Call |
| return | value: end workflow with JSON result |
| stop | optional value: deliberate workflow termination |

`into` declares a new variable. Variables otherwise live for the invocation;
branches do not create a separate namespace. Loops cannot reuse an existing name.
Return/Stop terminate only the current workflow, not the event lifecycle. The
executor returns `{status: 'completed'|'returned'|'stopped', value}`; event dispatch
ignores this value. Version 0.1 has no procedures. Neither version permits recursion,
unbounded loops or parallel execution. All statements, expressions, arguments and
service calls run in order.

## Context and authority

Event registrations choose exactly one of trusted host `run`, portable `workflow`, or
WydBASIC `wydBasic` source compiled to a workflow before dispatch.
Actions accept the same choice. No callbacks are needed inside a workflow:

```json
{"type":"Page.Load","owner":"home","workflow":{"schema":"sewn/0.1","body":[
  {"op":"call","target":{"op":"context","name":"ME"},"method":"Set","args":[
    {"op":"literal","value":"title"},{"op":"literal","value":"Welcome"}]}]}}
```

The dispatcher passes identical existing context bindings and caller authority to
both handler forms. Missing bindings fail with EVENT.CONTEXT. The executor has no
context constructor or registry. SERVICE results retain the canonical
`{ok,value}` / structured failure form; the workflow must branch on `ok` before
assuming success. Library registration/identity/payload data grant no capabilities.

`bindings.js` separates environment bindings from the runtime-neutral grammar and
evaluator. Facades are represented by opaque internal tokens; they cannot be
returned or sent to services. Reads are allowlisted: handle identity/properties
(and client Value), EVENT metadata/Source/Target/Payload, REQUEST metadata/maps,
RESPONSE Status/Headers/Cookies, SERVER App and CLIENT Cookies. SESSION is copied
JSON using the existing lowercase fields such as `authenticated`. JSON members
are own data properties; prototype lookup and reflective calls are unavailable.

Allowed methods are handle related/Set/Insert/Remove/Replace/Move, EVENT Cancel/Raise,
Query/Form Get/GetAll, scoped Cookies Get or Set/Delete, scoped Headers Set/Remove,
and RESPONSE WriteMarkdown. Method arities are checked. Insert/Replace take JSON descriptors `{id,type,properties?,slots?}` (nested slot children use the same shape). The binding converts these to canonical envelopes with empty provenance before the existing edit validator runs. This keeps reserved prototype keys out of portable documents. Handles retain existing
visibility, traversal, edit grants and stale-invocation checks. Mutations modify
only the request-local Page; persistence requires explicit authorized services.
RESPONSE Status assignment and file responses are deferred in SEWN (trusted host
facades still support them). No raw transport, DOM, filesystem, SQL, modules,
JavaScript source, host object or prototype enters portable execution.

## Bounds and errors

Hard maxima/defaults: 10,000 steps (statements, expressions, calls), expression depth
32, statement nesting 16, 1,000 total loop iterations, 64 variables, 4,096 JSON value
nodes per value, 16,384 characters per string, 32 service calls and 1,000 ms per
workflow. Programs additionally allow at most 8,192 JSON nodes, 65,536 serialized
characters and JSON nesting 64. Handles/collections are bounded and cannot be
manufactured from JSON. ExecutionContext `sewnSteps`, `sewnExpressionDepth`,
`sewnNesting`, `sewnIterations`, `sewnVariables`, `sewnValueNodes`, `sewnString`,
`sewnServiceCalls`, `sewnTimeMs` reduce these bounds, including to zero. Platform
maxima cannot be widened. Event budgets also continue to apply.

The deadline is a resource check, not a workflow-visible clock. Timeout invalidates
execution before subsequent calls/mutations. It cannot undo an external service
already started or cancel a trusted provider; providers retain their own bounds.
No implicit randomness, clock value, UUID or global variable state exists.

Errors are sanitized WydgitError values: SEWN.INVALID, DENIED, LIMIT, TYPE,
EXECUTION_FAILED. Existing SEAM/EVENT/MUTATION/facade failures retain their codes.
No native diagnostics or stacks are returned to portable workflows.

## Verified scope

`test/sewn-integration.test.js` uses real HTTP GET/invalid POST/denied service POST/
successful POST, Session resolution, Page lifecycle, SEWN action, authorized
WydStore create, request-local form replacement, render and unload. Subsequent GET
retains the canonical form. `test/sewn.test.js` also executes a simple Client.Ready
workflow through WydClient; client mutations/services beyond existing bindings are
not claimed. Trusted JS remains kernel/test code, never portable package source.

Additional source languages, durable replay/queues, debugger, dynamic imports, arbitrary
networking, general reflection and full client feature parity remain deferred.
WydBASIC adds only a compiler front end.

## Version 0.2: procedure semantics

`sewn/0.1` retains its closed grammar and execution behavior. `sewn/0.2` is exactly
`{schema:'sewn/0.2', procedures:{...}, body:[...]}`. Its procedure table maps static
canonical lowercase names to one of:

```json
{
  "hasname": {
    "kind": "function",
    "params": [{"name":"value", "type":"String"}],
    "returns": "Boolean",
    "body": [{"op":"return", "value":{
      "op":"binary", "operator":"!=",
      "left":{"op":"variable", "name":"value"},
      "right":{"op":"literal", "value":""}
    }}]
  },
  "noop": {"kind":"sub", "params":[], "body":[]}
}
```

The validator checks declaration shape, unique parameters, known source types,
static targets, kind/arity and the complete call graph. Unknown procedures and any
cycle fail SEWN.INVALID before execution, even in unused code. Reserved language,
context/security and prototype names cannot declare procedures. There are no host
functions, closures, reflection, dynamic names or method pointers in the table.

0.2 adds these closed operations:

| operation | fields / meaning |
| --- | --- |
| procedureCall statement | name, args: call a SUB with no result |
| functionCall expression | name, args: call a FUNCTION and obtain a typed result |
| serviceCall expression | library, method, input: sequential canonical SERVICES.Call result |

Facade `call`/`invoke` remain separate allowlisted operations. The old `service`
statement remains available. Service expressions use the same caller-bound dispatcher,
result envelope, JSON validation, service counter and deadline; they add no authority.

Arguments evaluate sequentially in the caller frame before a fresh callee frame is
created. Parameters are ByVal; data is copied/frozen and Wydgit parameters retain
opaque scoped tokens. Types are String, Number, Boolean, Null, Array, Object and
nullable Wydgit; parameters and FUNCTION results are runtime checked without coercion.
Callee locals never see caller locals, and frame restoration happens on return or
failure. Only contextual bindings (including SERVICES through service operations)
remain shared. Wydgit results can flow between procedure frames but cannot escape
as a workflow JSON result or service payload.

In a SUB, `return` has no value and terminates the call; reaching the end also
completes the SUB. In a FUNCTION, `return` requires a value of the declared type;
fallthrough fails SEWN.TYPE. A workflow RETURN still requires JSON data. STOP is
workflow-only, so it cannot ambiguously terminate a procedure's caller. Return signals
are internal to SEWN, never WydBASIC AST execution.

All calls retain the same ExecutionContext, facade guards, reference tokens and
whole-execution counters/deadline. Hard maxima are 256 procedure calls, 16 active
procedure frames and 16 parameters per call. `sewnProcedureCalls`,
`sewnProcedureDepth`, `sewnParameters` reduce these maxima, including to zero.
`sewnVariables` limits all simultaneously live variables/parameters/loop variables
across active frames (64 by default). Frame exit releases locals; repeat calls are
bounded by call/step budgets. Existing expression and value/string limits apply
within every frame; structured statement nesting is carried through calls; loops, services, steps and time remain
shared. Calls cannot reset budgets or union callee grants.

Independent hand-authored `test/sewn-procedures.test.js` covers schema/kind/arity,
frames, parameters/results, completion, cycles, bounds, services, authority and
opaque/stale handles. It does not import the WydBASIC compiler. Both schema versions
execute through the same `execute.js` evaluator and existing SEAM-constrained facades.


## Version 0.3: prototype dispatch and construction

`sewn/0.1` and `sewn/0.2` remain closed and unchanged. `sewn/0.3` has the same
`{schema,procedures,body}` envelope as 0.2 and adds three closed operations:

| Operation | Fields | Meaning |
| --- | --- | --- |
| `methodCall` statement | `target`, `name`, `args` | Invoke a prototype SUB on an opaque Wydgit reference. |
| `methodValue` expression | `target`, `name`, `args` | Invoke a prototype FUNCTION and runtime-check its declared result. |
| `construct` expression | `type`, `id` | Literal qualified prototype identity plus a String ID expression; return an opaque draft. |

Method names are static canonical lowercase identifiers, never expressions.
`type` avoids the reserved data key `prototype`; canonical envelope identity is
still `prototype`. Kernel `call`/`invoke` stay allowlisted. Missing methods produce
`PROTOTYPE.METHOD`; wrong kind/arity/parameter/result/completion produce `SEWN.TYPE`.
Method lookup uses the actual receiver prototype's frozen registry chain. Trusted
hosts explicitly pass `prototypeRegistry` to `execute`/`createDispatcher`; it is not
a contextual binding available to portable code. Pages supply their model registry.
WydClient can supply the same runtime-neutral registry for read-only methods.

Methods run via the existing procedure frame machinery, with an explicit receiver
and lexical procedure table. Arguments evaluate sequentially in the caller frame
before Me/table changes. Frame exit restores locals, receiver and table even on
failure. Procedures invoked from methods retain that receiver. All methods and
procedures share 256 calls, 16 active frames, 16 parameters, live-variable bounds,
steps, nesting, loops, services and one deadline. Existing `sewnProcedureCalls`,
`sewnProcedureDepth` and `sewnParameters` reductions apply to their combined budget.
Static procedure cycles and known Me method cycles (including derived overrides)
are rejected at setup. An active callable-identity guard rejects dynamic cycles
across receivers as `SEWN.LIMIT`; no recursion is enabled.

Draft maxima per invocation are 64 constructed builders, graph depth 32, aggregate
256 live draft nodes, 512 construction operations and 65,536 serialized characters
of candidate data. `sewnDrafts`, `sewnDraftDepth`, `sewnDraftNodes`,
`sewnConstructionOperations`, `sewnConstructionSize` may only reduce these bounds,
including to zero. A construction operation also spends ordinary SEWN steps and
checks the shared deadline. Construction count is cumulative even after consumption.

Drafts are opaque handle-kind executor tokens. They can flow through Wydgit
parameters/results between frames, but cannot flow through JSON arrays/objects,
service inputs, workflow results or persistence. Draft reads/operations/dispatch
check invocation lifetime and consumption. Set validates prototype property rules;
nested Insert consumes a complete child builder. Runtime Insert/Replace consumes
a root builder only after the existing atomic mutation succeeds. No draft is a
canonical runtime object until attachment. Required fields/minimum cardinalities
are completed before containment; final runtime validation remains authoritative.

`test/sewn-objects.test.js` hand-authors these operations without importing a source
compiler. It tests dispatch, override signatures, typed results, opaque receivers,
caller authority, construction grants, defaults, nesting/consumption, atomic denial,
cycles and limits. WydClient's current adapter supplies prototype/properties for
read-only method execution; it does not supply server tree mutation or storage.
Private drafts are portable when a trusted client host supplies a registry/grants,
but this client adapter cannot attach them to its presentation tree. Server lifecycle
ID-only handles also do not pretend to be full Wydgit receivers.
