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
The portable `NewId()` intrinsic in `sewn/0.3` provides an opaque ID as described below.
No implicit clock value or global variable state exists.

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


## 0.2-N portable Forms

The handle allowlist adds `FormState(operation, data?)`, the closed scoped Form kernel binding used by WydBASIC prototype wrappers. All schema versions retain their existing operations. Form methods use normal sewn/0.3 dispatch; no new executable schema is introduced. See [forms.md](forms.md).


## 0.2-P local packages

`sewn/0.3` adds the closed expression `{op:"newId"}`. No operands are accepted. It returns a 33-character opaque String using the secure runtime UUID facility; unavailable secure generation raises SEWN.DENIED. Identity grants no authority. See [packages](packages.md).


## Canonical service foundation — 0.3-A

See [canonical service contracts](canonical-services.md) for exact API versions,
`SERVICES.Invoke`, `sewn/0.4`, execution identities and compatibility limitations.
Existing v0.2 library calls, grants and ownership rules remain supported.

## SEWN 0.5 canonical member lookup

`sewn/0.5` extends 0.4 with `memberRead {target,name,exact}` expressions and
`memberSet {target,name,value,exact}` statements. Method operations can specify
`exact:true`; otherwise lookup is ordinary. Canonical procedure identifiers may
preserve case. Existing schemas remain closed and existing lowercase behavior
remains valid. Execution carries an unforgeable declaring-class frame separately
from the unchanged caller SEAM context. See [canonical OOP](canonical-oop.md).

## Version 0.6: explicit null tests and lexical loop exit

`sewn/0.6` extends the closed 0.5 grammar using the same `{schema,procedures,body}`
envelope. Older wire schemas remain unchanged and reject these operations.

- Expression `isNull {value, negate}` evaluates its operand once and returns the
  Boolean `value === null` (or its inverse when negate is true). negate is a
  required Boolean. JSON data and opaque Wydgit references are accepted; facade
  tokens are rejected. A live handle remains opaque and retains its binding,
  invocation and construction-lifetime checks. Empty/falsy values remain non-null.
- Statement `exitFor {}` returns an internal loop-exit signal. The nearest
  forEach consumes it, releases its variable and continues after the loop. It is
  validated only within a lexical loop in that procedure/workflow; a callee cannot
  exit its caller's loop. The signal cannot escape as a workflow JSON result.

All existing step, iteration, depth, variable, call, service and time budgets
continue to apply. Early exit spends the work performed and skips remaining
iterations, without resetting counters. Prototype methods may use schema 0.6.
Independent hand-authored wire tests cover grammar/version boundaries, null/falsy
values, handle guards, nested loops, procedure isolation, cleanup and resource limits.

## Version 0.7: primitive conversion

`sewn/0.7` preserves the 0.6 envelope/operations and adds only the expression
`{op:"convert",type:"String"|"Number",value:expression}`. Old schemas remain closed.
The operand evaluates once, in ordinary sequence. String conversion accepts
String/finite Number/Boolean, formatting Booleans as True/False and Numbers with
locale-independent shortest decimal formatting. Number conversion accepts a
finite Number unchanged or an entire signed decimal String with optional fraction,
e/E exponent and surrounding ASCII space/tab/CR/LF. Invalid inputs fail SEWN.TYPE;
no legacy prefix parsing, hexadecimal, nonfinite values or null defaults exist.

No reference/facade tokens, Arrays, Objects or NULL may be converted. Number
conversion additionally rejects Booleans. No custom coercion method is invoked.
Data boundaries and all existing execution budgets still apply to inputs/outputs.
Prototype methods may use 0.7. See WydBASIC conversion documentation for examples
and rounding details; domain-specific validation remains the caller's responsibility.

## SEWN 0.9 — selection and identity

The document envelope remains `{schema:"sewn/0.9",procedures:{...},body:[...]}`.
This version extends 0.8 without modifying any earlier closed grammar.

- Expression `identity`: required `left`, `right` expressions and Boolean `negate`.
- Statement `select`: required selector expression `value`, Array `cases`, optional
  statement Array `else`.
- Each case has exactly `tests` (nonempty Array) and `body` (statement Array).
- Each test has exactly `operator` and expression `value`. Operators are `=`, `!=`,
  `<`, `<=`, `>`, `>=`, `IS`, `IS NOT`. No `op` field is allowed on cases/tests.

At least one case or an explicit else is required. Every nested expression/body
is validated, including unreachable tests, procedure graph edges and lexical loop
exits. Unknown keys/operators, malformed cases and invalid negate flags fail closed.
Older schemas reject both new operations and preserve their previous name rules.

The selector executes once. Tests execute in source order until the first match;
then only that body executes, otherwise else (or nothing). Value tests use existing
strict scalar comparison; ordering requires matching String/Number types. Identity
tests require nullable opaque Wydgit handles and compare live trusted underlying
nodes after context/lifetime/draft checks. IDs and properties are never compared.
JSON containers and facades have no identity operation. Frames share tokens and
underlying identity within an invocation; references never cross JSON or invocation
boundaries. All visibility and SEAM checks remain authoritative.

The select statement, inspected branches/tests and evaluated expressions consume
steps. Selected bodies consume nesting; procedure/service/construction counters
and the deadline remain shared. RETURN/STOP/EXIT FOR propagate through selection;
TRY catches only existing recoverable TYPE failures. See [WBasic](wydbasic.md) and
[the milestone decisions](milestones/sewn-0.9.md) for grammar and security details.

## Numeric foundations — sewn/0.10

The closed 0.10 grammar adds numeric, numericCheck, numericPredicate and xor
expressions, and Integer/Float procedure contracts. Historical binary operations
and schemas remain unchanged. All public numeric values remain finite JavaScript
Numbers; checked Integer results are exact and safe. No new SEAM authority is
introduced. See [the numeric milestone](milestones/wbasic-sewn-0.10.md) for field
contracts, arithmetic policies, predicates, limits and compiler compatibility.

## SEWN 0.11 core contracts

Scalar, DataType, TypeOf and explicit UTC DateTime construction are implemented.
See [the complete contract and serialization boundaries](milestones/wbasic-sewn-0.11.md).
Uninitialized declarations of these types require an initializer. Earlier grammars remain closed.

## Architecture roadmap and compatibility policy

The implemented grammar and compiler behavior described above remain unchanged.
Historical milestone records describe what shipped; they do not promise indefinite
support for every intermediate alpha wire format. Future compatibility work follows
[the published application baselines and migration policy](wydgit-package-distribution.md#8-sewn-versioning-and-compatibility).
Unsupported formats must be explicitly rejected or migrated through a documented,
behavior-preserving transformation; old schema identifiers cannot silently acquire
incompatible semantics. Existing regression tests remain in place.

[Static Wydgits and library resolution](milestones/wbasic-sewn-0.14.md) are
implemented in 0.14 through dedicated static prototypes, explicit WITH LIBRARY,
exact approved dependency pins and procedure linking. No library is implicitly
imported. Imported CStr/Val use ordinary wrappers; the narrow legacy unimported
conversion path and historical compiled conversions remain supported.

## SEWN 0.12 canonical operations

The closed 0.12 grammar adds operation {name,args} and explicitly marked
convert {type,value,mode:"canonical"}. Legacy convert remains unchanged.
See [the operation contracts](milestones/wbasic-sewn-0.12.md) for the closed
vocabulary, conversion matrix, rounding, Unicode, limits and runtime checks.

## SEWN 0.13 collections, numeric loops and constants

The closed 0.13 grammar adds index {target,index}, forNumeric
{name,start,end,step,body}, constant {name,type,value}, and controlled Array
dispatch/new collection names in operation {name,args}. Portable typeCheck
contracts also enforce dynamic indexed assignments. Older schemas remain closed;
0.12 string operation meanings remain unchanged. See [the milestone contracts](milestones/wbasic-sewn-0.13.md)
for equality, scope, allocation, stepping, immutability and compatibility rules.

## WBasic / SEWN 0.14 static libraries

The closed envelope is `{schema:"sewn/0.14",procedures,body,libraries}`. Static
calls reuse functionCall/procedureCall; libraries records exact identities,
versions, aliases, linked method names, public/private access and requires gates.
Private calls require the same declaring library; linked Me is rejected. Recursive
procedures use shared depth/count limits; older schemas remain closed and retain
their cycle policy. Calls cannot inherit instance private access, publisher
privileges or refreshed budgets. See [the milestone](milestones/wbasic-sewn-0.14.md)
for exact field contracts, wrappers, installation snapshots and security evidence.
WydClient consumes prepared wire workflows; source preparation belongs to build
setup and is excluded from the served browser runtime dependency closure.


## Version 0.15: bounded regular expressions

`sewn/0.15` extends 0.14 with the closed `operation {name,args}` expressions
RegexTest, RegexMatch, RegexMatches, RegexReplace and RegexSplit. The first three
and RegexSplit require three ordered String expressions (text, pattern, flags);
RegexReplace requires four (text, pattern, replacement, flags). Nested expressions
are validated and evaluated once, left to right. No arbitrary host-call mechanism
or regex handles are introduced. Earlier schemas reject these names.

The envelope has schema, procedures and body, plus optional libraries provenance
when linked. Existing 0.14 artifacts still require libraries. Third-party static
procedures containing regex upgrade their linked callers to 0.15, retaining the
original execution context, SEAM authority, deadline and all cumulative counters.

Returns: Boolean, first `{value:String,index:Integer,groups:Array}` or Null, Array
of those matches, String, and Array of Strings respectively. Indices count UTF-16
units; unmatched captures are Null. RegexMatches enumerates regardless of g;
RegexTest/Match use the first match regardless of g. Replace uses g for all versus
first replacement and treats replacement text literally. Split uses all delimiters
regardless of g, preserves empty fields, excludes captures, and processes empty
matches with explicit one-unit/code-point progress, including boundary fields.

The version-pinned RE2JS Thompson NFA is shared by server and browser. Supported
flags are g/i/m/s/u; the deliberately restricted syntax and Unicode/anchor contexts
are documented in [the language reference](wbasic-language-ref.md#16-regular-expressions)
and [0.15 milestone](milestones/wbasic-sewn-0.15.md). Unsupported syntax fails closed;
there is no native regex fallback or full ECMAScript compatibility claim.

Hard maxima: 256 pattern units, 4,096 input units, 8 captures, 128 matches, 16,384
aggregate output units, 16 group levels, 32 finite repetition bounds, 128 expanded
atoms, 512 compiled instructions and 1,000,000 cumulative regex work units.
ExecutionContext sewnRegexPattern/Input/Captures/Matches/Output/Depth/Repeat/Atoms/
Instructions/Work can only reduce the corresponding bounds. Output also respects
sewnString and sewnValueNodes; reservations spend ordinary shared execution steps
before synchronous matching. Per-value/operation allocation limits remain distinct
from the cumulative work counter. No callee can replenish these resources.

SEWN.TYPE and new SEWN.REGEX errors are recoverable under 0.15 TRY/CATCH;
SEWN.LIMIT and denials remain fatal. Malformed operations remain SEWN.INVALID.
WydClient lazily loads a fixed local adapter and bundled engine from the approved
runtime module routes; it requires neither the source compiler, resolver, installer,
WASM, CDN nor privileged browser capability. Shared JSON fixtures and adversarial
regressions verify the same accepted results, error codes and resource reductions.
