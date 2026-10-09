# SEWN — 0.2-J

SEWN means **SEAM Execution Workflow Notation**. WydStitch writes it. SEWN describes
it. SEAM constrains it. Wydgine or WydClient runs it. [WydBASIC](wydbasic.md)
compiles to SEWN in 0.2-K; future WydStitch dialects may use the same boundary.

A document is exactly `{ "schema": "sewn/0.1", "body": [] }`. The closed executable
grammar is defined in `wydgine/sewn/schema.js` and validated by `validate.js`.
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
ignores this value. There are no procedures, recursion, unbounded loops or parallel
execution. All statements, expressions, arguments and service calls run in order.

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
networking, general reflection, user procedures and full client feature parity
remain deferred. WydBASIC adds only a compiler front end.
