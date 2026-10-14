# WBasic — implemented through SEWN 0.10

WBasic (formerly WydBASIC) is the first WydStitch dialect. **WydBASIC should feel like VB6 evolved
into a portable, capability-safe application language.** Make common application
behavior obvious to read and easy to write while moving complexity into the compiler
and runtime. **WydBASIC compiles to SEWN. It does not own execution semantics.**

**WydStitch writes it. SEWN describes it. SEAM constrains it. Wydgine or WydClient runs it.**

`compile(source)` from `wydgine/wydbasic/index.js` synchronously returns a copied,
frozen, canonically validated workflow without executing it. Existing body source
uses `sewn/0.1`; object operations select `sewn/0.3`.
`tokenize(source)` and `parse(source)` expose located tokens and AST nodes for
inspection. The hand-written lexer, precedence parser and semantic lowering have
no parser dependencies. The AST is never an executable representation.

## Source, declarations and types

Source is ordinary UTF-8 text, with line-oriented statements, blank lines and
apostrophe comments. No semicolons or line numbers. Keywords, variable identifiers,
context names and facade member/method names are case-insensitive. Original spelling
is retained in tokens/AST and diagnostics; SEWN variables normalize to lowercase.
String values and JSON object keys remain case-sensitive, including keys accessed
through data member reads. Thus `REQUEST.ispost` normalizes to `IsPost`, while
`SESSION.authenticated` and `Me.properties.title` use those exact JSON keys.

```basic
' A local counter
DIM count AS Number = 0
DIM name = "Brian"
count = count + 1
DIM item AS Wydgit
SET item = Me
```

Types: String, Number, Integer, Float, Boolean, Null, Array, Object, Wydgit. Integer and Float default to zero; see the numeric section below. Legacy defaults: Explicit declarations
without initialization default to `""`, `0`, `FALSE`, `NULL`, `[]`, `{}`, `NULL`
respectively. `DIM item AS Wydgit = Me` is also supported. Initialization through DIM
does not need SET; subsequent Wydgit assignment requires SET, including NULL.
SET is rejected for scalar/data variables and for unknown dynamic reference values. Context facades cannot be stored as data.

Inference uses literal/expression types, known facade reads, variable types,
`related` relationship results and service results (Object). Dynamic JSON member
reads and Get results infer Unknown, a data type checked by SEWN when consumed.
Explicit types check statically known initializer/assignment/operator mismatches;
legacy declarations do not add runtime casts or additional assignment checks. Integer/Float contracts added in 0.10 do check assignment values. Dynamically typed
values still obey SEWN's strict operator and facade checks. A null Wydgit variable
cannot be called until assigned a valid handle.

Variables must be declared before use. Names are at most 64 ASCII letters, digits
or underscores, starting with a letter or underscore. Keywords, context and reserved security
names cannot be declared. Declaration names are unique within each handler or procedure frame,
even across mutually exclusive branches and loops. Branch declarations are visible
only while compiling that branch and cannot be referenced after END IF. Loop
variables are fresh, exist only within the loop and cannot shadow existing names.
These conservative rules avoid SEWN's frame-wide redeclaration ambiguity.
DIM inside FOR EACH is deferred; initialize accumulators before the loop.

## Values and expressions

Literals: `"hello"`, `42`, `3.14`, TRUE, FALSE, NULL. Double a quote inside a string:
`"say ""hello"""`. Arrays contain expressions, e.g. `["Alice", name]`. Objects have
quoted JSON-like keys and expression values:

```basic
DIM data = {
    "name": name,
    "active": TRUE
}
```

Newlines are allowed inside arrays, objects and argument lists. Object field
execution follows canonical SEWN lexical key order. Duplicate/dangerous object
keys are rejected. No JavaScript string escapes or interpolation.

Operators, from lowest to highest precedence: OR, AND, comparisons
(`= <> < <= > >=`), `&`, `+ -`, `* /`, unary `+ -`. NOT applies to a comparison
before AND/OR. Parentheses override precedence. `<>` lowers to SEWN `!=` and `&`
to `concat`. Arithmetic requires finite Numbers; concat requires Strings; boolean
operators require Booleans and short circuit. Strict scalar equality accepts
differing scalar types as unequal. Arrays/objects cannot be compared. No coercion.

## Branches and loops

```basic
IF (count + 1) > 10 THEN
    RETURN "large"
ELSEIF count = 0 THEN
    STOP "empty"
ELSE
    count = count + 1
END IF

DIM total = 0
FOR EACH value IN [1, 2, 3]
    total = total + value
NEXT value
RETURN total
```

IF lowers to SEWN `if`; ELSEIF to nested `if`. FOR EACH lowers to bounded
`forEach`; NEXT's optional name must match. Collections obtained through
`Me.related("children", "blocks")` retain handle element typing, permitting
safe handle methods in their loops. The executor owns all iteration/step limits.
RETURN requires a JSON-safe result. STOP accepts an optional JSON-safe reason.
They end only the current workflow, not the event lifecycle.

## Explicit null tests and loop exit

`value IS NULL` and `value IS NOT NULL` return Booleans for JSON data or nullable
Wydgit references. Use the two keywords `IS NOT`; `IsNot` is not an alias.
NULL is distinct from FALSE, zero, an empty String and empty containers. There is
no implicit truthiness, object equality or conversion to Boolean. Safe facades
such as REQUEST itself are not data/null-test operands. Checks on non-null Wydgit
references retain context, invocation and consumed-draft guards and do not expose
the handle as JSON.

```basic
DIM listSec AS Wydgit
SET listSec = FindNode(rootSec, "blocks", "taskboard-list-section")
IF listSec IS NOT NULL THEN
    ' Use the reference returned by the single search.
END IF
```

Null tests have comparison precedence, tighter than AND/OR. `NOT item IS NULL`
means `NOT (item IS NULL)`. General reference identity is supported separately in SEWN 0.9.

`EXIT FOR` exits the nearest enclosing FOR EACH in the current procedure or
workflow. It works inside nested IF blocks, resumes after NEXT, and releases the
loop variable. It cannot exit a caller's loop across a SUB/FUNCTION/method call,
and is rejected outside a lexical loop. RETURN and STOP retain their existing
meaning. It skips later iterations; it does not reset shared execution budgets.

```basic
DIM listSec AS Wydgit
FOR EACH node IN rootSec.related("children", "blocks")
    IF node.id = "taskboard-list-section" THEN
        SET listSec = node
        EXIT FOR
    END IF
NEXT node
IF listSec IS NULL THEN
    ' No matching visible child was found.
END IF
```

These features select `sewn/0.6`; older source without them keeps its existing wire
version. FindNode helpers may still RETURN a nullable Wydgit reference. Do not
predeclare the loop variable: FOR EACH declares it.

## Explicit primitive conversion

`CStr(value)` and `Val(value)` take exactly one argument, are case-insensitive,
and select `sewn/0.7`. They are compiler intrinsics in bodies, EVENT modules and
prototype methods, not host functions or user-overridable procedures.

| Call | Accepted input | Result |
| --- | --- | --- |
| CStr | String, finite Number, Boolean | String; String unchanged, locale-independent Number formatting, Boolean as `"True"` / `"False"` |
| Val | String or finite Number | Number; Number unchanged, String parsed as a complete decimal value |

Val accepts surrounding ASCII space/tab/CR/LF, an optional sign, decimal fraction
and optional e/E exponent. It rejects empty/whitespace-only text, numeric prefixes
followed by junk, hexadecimal, grouping separators, NaN, Infinity and overflow.
Unlike legacy VB's prefix parser, `Val("10junk")` fails rather than returning 10.
Normal finite binary64 rounding applies; very small values may underflow to zero.
CStr formats numeric negative zero as `"0"`. Neither conversion is locale-aware.

Both reject NULL, Arrays, Objects, Wydgit references and context facades. Val also
rejects Boolean input. Known incompatible types and incorrect arity fail at
compilation; dynamic invalid values fail with SEWN.TYPE. There is no implicit
conversion, object-to-string method invocation, generic serialization or new
capability. Existing string, step, expression-depth and time limits apply.

```basic
DIM offset AS Number = Val(REQUEST.Query.Get("offset"))
DIM label AS String = "Offset " & CStr(offset)
```

Handle an absent value before calling Val: request Get may return NULL. Conversion
is not application validation; a paging offset still needs nonnegative, integer
and maximum checks. These functions do not add paging routes, controls or retained
page state by themselves. `CSTR` and `VAL` are reserved intrinsic identifiers in
new source; older wire grammars/procedure names remain unchanged.

## Contexts and calls

ME (also Me), EVENT, REQUEST, RESPONSE, SESSION, PAGE, SERVER, CLIENT are recognized
contexts. Availability is checked at execution; missing context produces
EVENT.CONTEXT. ME is never a normal variable. SERVICES is special compiler syntax
for the canonical service instruction, not an additional readable global.

Member reads and method calls lower to `read`/`invoke` (or statement `call`).
Known facade members, methods and arities come directly from SEWN `bindings.js`.
Unknown non-Wydgit facade methods/members and `__proto__`, `constructor`, `prototype` are
compile errors. Data reads remain own-property runtime checks. No reflection or
arbitrary data-object calls are supported.

```basic
DIM name = REQUEST.Form.Get("name")
DIM pages = REQUEST.Query.GetAll("page")
IF REQUEST.IsPost AND NOT SESSION.authenticated THEN
    RESPONSE.WriteMarkdown("# Please sign in")
END IF
Me.Set("title", "Hello")
```

Kernel facade methods are exactly SEWN's allowlist: handle related/Set/Insert/Remove/
Replace/Move, EVENT Cancel/Raise, Form/Query Get/GetAll, scoped Cookies methods,
Headers Set/Remove and RESPONSE WriteMarkdown. Insert takes slot, index, descriptor;
Replace takes a descriptor `{id,type,properties?,slots?}`. Move takes a scoped
Wydgit, slot and index. `related` requires a literal relationship string for typing;
singular relationships produce nullable handles. All visibility, stale handle,
mutation validation and SEAM capability checks remain in the existing runtime.

## Services and event integration

```basic
DIM result = SERVICES.Call("wydstore", "create", {
    "store": "main", "collection": "users", "id": "submission",
    "data": {"name": REQUEST.Form.Get("name")}
})
IF result.ok THEN
    Me.Replace({"id":"thanks", "type":"wydgit.core/block", "properties": {
        "content":{"type":"markdown", "value":"Thank you"}
    }})
END IF
```

In handler-body `compile(source)`, SERVICES.Call is accepted as a standalone statement or directly as a DIM initializer.
Library and service names must be literal strings; inputs must be JSON-safe.
That compatibility path still targets `sewn/0.1`, whose service `into` declares a new variable.
Module compilation targets `sewn/0.2` (or `sewn/0.3` for object operations) and additionally lowers nested service expressions,
including FUNCTION returns and assignment, to explicit SEWN `serviceCall` expressions. Compilation
neither discovers libraries nor grants permissions. The existing dispatcher
returns `{ok,value}` or a structured failure under the original caller authority.

Handler/action records choose exactly one of `run`, `workflow`, `wydBasic`:

```js
{type:'Page.Load', owner:'home', wydBasic:'Me.Set("title", "Welcome")'}
```

The existing `source` field still means named event source selection. Raw source is
never accepted in `workflow`. HTTP registrations compile at pipeline construction;
direct Page execution prepares all handlers/actions before any lifecycle dispatch;
WydClient/server dispatchers compile at construction. Prepared workflows are reused
for invocations. Invalid source fails before dispatch, including unused actions.
The same event scope, authority and SEWN executor handle every portable workflow.

`test/wydbasic-integration.test.js` proves real HTTP Page.Load, Submit action,
WydStore create, local replacement, rendering, denied storage, CSRF and subsequent/
concurrent request isolation, with all portable behavior authored as WydBASIC.
Compiler tests compare emitted structure and execution with hand-written SEWN and
exercise WydClient Ready/Change cancellation. No browser/manual verification is claimed.

## Diagnostics, security and current limits

Errors are WydgitError with WYDBASIC.SYNTAX, NAME, TYPE, UNSUPPORTED or COMPILE,
human-readable messages and `{line,column,offset}` details (one-based line/column).
Tokens/AST also retain end positions. Canonical output failures report the source
start rather than full source maps. Normal `toJSON()` output contains no native
parser stack. Source size is bounded to 65,536 characters; parser nesting and output
validation apply SEWN-compatible limits. Output has no timestamps, random IDs or
machine paths. SEWN owns execution limits and errors.

No generated JavaScript, eval, Function construction, raw host/runtime calls,
imports, sockets, filesystem, DOM or authority shortcuts exist. Host names
such as process/globalThis/window/document/require/fs are undefined source names.
Trusted JavaScript registrations remain a separate host API.

## Procedures and event modules

`compileModule(source, {registry = new EventRegistry()})` and `parseModule(source)`
are separate APIs from handler-body `compile`/`parse`. A module contains only
module-level SUB, FUNCTION and EVENT declarations; their order is immaterial to
procedure resolution. It returns frozen `{events:[{type,workflow}]}` metadata.
Every workflow is independently validated, frozen `sewn/0.2` or `sewn/0.3`, containing the shared
procedure table. Metadata and ASTs never execute. There is no WydBASIC VM or call stack.

```basic
FUNCTION HasName(value AS String) AS Boolean
    RETURN value <> ""
END FUNCTION

SUB SetHeading(value AS String)
    Me.Set("title", value)
    RETURN
END SUB

EVENT Page.Load
    DIM name = REQUEST.Query.Get("name")
    IF name <> NULL THEN
        IF HasName(name) THEN
            CALL SetHeading(name)
        END IF
    END IF
END EVENT
```

Parameters require `AS String|Number|Boolean|Null|Array|Object|Wydgit` and are ByVal.
Zero or multiple parameters are supported; names are case-insensitive and unique
in the frame. Procedures normalize to lowercase, cannot overload or collide with
reserved language/context/security names, and resolve statically within this document.
Use `CALL Name(args)` for SUBs and `Name(args)` in expressions for FUNCTIONs.
Calling a FUNCTION as a SUB or using a SUB as an expression fails compilation.
Statically known argument counts/types and result types are checked; dynamic inputs
and results receive the corresponding small SEWN runtime type checks.

Each call gets parameters and its own DIM/local variables. It cannot read caller
locals or leak its locals back to callers. Local data is copied/frozen; an opaque
Wydgit reference retains its existing invocation guard and scope, without JSON
serialization. Wydgit assignment still requires SET. A nullable Wydgit parameter
may receive NULL; calling methods on it still fails safely. Functions may return
scoped Wydgit references within execution, but workflow results/services/JSON
containers cannot serialize them.

FUNCTION requires explicit `RETURN expression`; obvious fallthrough is rejected by
the compiler and all fallthrough is rejected by SEWN at runtime. SUB can complete
normally or use bare RETURN for early exit. SUB cannot return a value. STOP is
workflow-only; procedures use RETURN. RETURN from a procedure ends only that call.
FUNCTION name assignment as an implicit result is unsupported.

Direct and indirect recursion are rejected through a static call graph, including
unused procedures and unreachable calls. SEWN additionally bounds calls to 256,
active procedure depth to 16 and parameters per call to 16. The existing 64-variable
bound counts all live locals, loop variables and parameters across active frames.
`sewnProcedureCalls`, `sewnProcedureDepth`, `sewnParameters`, and `sewnVariables`
in ExecutionContext can reduce these bounds. Steps, loops, services and the deadline
are shared for the whole execution; calls obtain no fresh budget or authority.
DIM inside FOR EACH remains deferred, including inside a procedure.

EVENT blocks have no parameters. Built-in or custom names resolve case-insensitively
against the supplied registry; unknown or ambiguous matches and duplicate EVENT
blocks fail with located WYDBASIC errors. Custom events must already be defined.
ME is the registered owner; EVENT.Source/Target retain existing dispatcher meanings.
EVENT, REQUEST, RESPONSE, SESSION, PAGE, SERVER, CLIENT and SERVICES retain their
existing availability, safe facade and authority checks inside calls. A server
procedure using CLIENT still fails EVENT.CONTEXT. Functions can mutate or call
services sequentially if authorized; FUNCTION does not promise purity.

Handler registration:

```js
{owner:'home', wydBasicModule: source}
```

Modules choose exactly one implementation, expand deterministically into ordinary
workflow records during setup, and are never compiled during dispatch. Raw handler
`wydBasic` stays a body, not an ambiguous module. Use the normal `workflow` records
from `compileModule` when explicit manual registration is useful.

Action registration can use a module declaring exactly its one routed event:

```js
{page:'home', target:'form', type:'Submit', method:'POST',
 capability:'app.forms.submit', wydBasicModule: submitSource}
```

The action target is ME. The host still owns page/target/method, capability/domain
policy, CSRF and validation gates. EVENT Submit supplies behavior and cannot redefine
routing. A handler module can declare multiple events sharing procedures; an action
module must declare exactly its routed event to prevent silently unused registrations.
Page execution and WydClient support the same module mechanism through their existing
facades; registration does not cause unavailable events or contexts to exist.

`test/wydbasic-module-integration.test.js` proves real HTTP Submit → HasName/SaveName/
ShowThankYou → WydStore → request-local replacement → rendered Thank you, including
CSRF/capability denial and subsequent/concurrent request isolation. The independent
`test/sewn-procedures.test.js` imports no WydBASIC and proves SEWN owns execution.

Deferred: REM, line numbers, semicolons, array indexing syntax, arbitrary dynamic
cross-file modules/imports, ByRef/Optional/ParamArray/default parameters,
overloads, recursion, nested procedures, lambdas/closures/delegates, unrelated language classes, ASYNC/AWAIT, threads/parallelism, THROW, GOTO, DO/LOOP,
WHILE, formatter/debugger/LSP and other source dialects.


## 0.2-M prototype methods and NEW

WydBASIC authors behavior on Wydgit prototypes, without a second class system.
`compilePrototype(source)` accepts a declaration-only SUB/FUNCTION module and
returns canonical `sewn/0.3` behavior for trusted registration. The repository
explicitly maps `behaviorSource` in `prototypes/objects.json`; all its declarations
are public methods, and can also call module procedures lexically. A derived
prototype lists overridden lowercase names in its `overrides` array and must retain
compatible signatures. No portable WydBASIC AST or JavaScript callback executes.

```basic
' Behavior for acme/message-panel (content is the inherited Markdown object).
SUB SetMessage(value AS String)
    Me.Set("content", {"type":"markdown", "value":value})
END SUB
FUNCTION HasMessage() AS Boolean
    RETURN Me.properties.content.value <> ""
END FUNCTION
```

Application/event source can construct and attach it:

```basic
EVENT Submit
    DIM panel AS Wydgit
    SET panel = NEW "acme/message-panel"("result-panel")
    CALL panel.SetMessage(REQUEST.Form.Get("name"))
    IF panel.HasMessage() THEN
        Me.Insert("blocks", 0, panel)
    END IF
END EVENT
```

`NEW` requires a literal fully qualified prototype ID and exactly one explicit
String instance-ID expression. It returns an invocation-scoped transient draft,
not a detached runtime instance. `SET` remains required for Wydgit assignment.
No automatic random ID, friendly-name resolution or nominal-type syntax is added.
Unknown/abstract prototypes and invalid IDs fail at runtime, under construction
grants; compiler syntax/type errors retain line/column locations.

Known kernel methods remain statically allowlisted. Other member invocations on
Wydgit values lower to `methodCall` for statements (with or without CALL) or
`methodValue` for expressions. Names are case insensitive and statically spelled;
there is no callable-property lookup. Generic Wydgit calls resolve signatures and
dispatch at runtime, so the receiver's most-derived override wins. A SUB cannot
supply an expression value and a FUNCTION cannot be used as a SUB statement.

Drafts support `properties`, `Set`, prototype methods and nested draft `Insert`.
They cannot navigate runtime relationships. Runtime Insert/Replace attaches through
the existing mutation validator, consumes all aliases of the root token and grants
no visibility. Reacquire a normal handle through authorized traversal afterward.
Existing descriptor Insert/Replace remains valid. Methods bind Me to their receiver
and retain the caller's exact context/service authority, isolated typed ByVal frames
and shared bounds. Construction requires `object.instances.construct` plus exact
prototype scope; attachment requires ordinary edit/ID grants. There is no implicit
persistence. See [object model](object-model.md) and [SEWN](sewn.md) for lifecycle,
incomplete construction rules, atomicity, limits and client limitations.

The repository's base/derived message panel source, independent SEWN tests,
WydBASIC module tests and real HTTP Submit integration prove construction → dynamic
portable behavior → validated request-local containment → rendered output, including
request isolation and capability denial. BASE calls are explicitly deferred, along
with access modifiers, overloads/static members, reflection, full nominal typing,
slot-property sugar, closures and all automatic persistence/ID generation.


## 0.2-N portable Forms

Form supplies public prototype methods `Bind(Object)`, `Validate() AS Boolean`, `IsValid() AS Boolean`, `Values() AS Object` and `Clear()`. Calls dispatch through sewn/0.3 and inherited prototype behavior; the closed FormState binding handles bounded traversal and semantic rules without HTTP/DOM assumptions. See [forms.md](forms.md) for examples, configuration and sensitive values.


## 0.2-P local packages

`DIM id AS String = NewId()` returns a bounded collision-resistant opaque ID with no arguments, host objects or authority. It compiles to the `sewn/0.3` newId intrinsic. Use for WydStore create or explicit NEW IDs; existing capability/scope checks remain required. See [packages](packages.md).


## Canonical service foundation — 0.3-A

See [canonical service contracts](canonical-services.md) for exact API versions,
`SERVICES.Invoke`, `sewn/0.4`, execution identities and compatibility limitations.
Existing v0.2 library calls, grants and ownership rules remain supported.

## 0.3-H0 canonical members

Wydgit references support direct property reads and assignments (`Me.content = value`).
Ordinary names resolve case-insensitively to one discoverable canonical member.
`Me.[content]` and `Me.[method]()` require exact spelling, including hidden members,
and still enforce access and SEAM. Brackets after a dot contain one identifier;
array literals are unchanged. These extensions emit `sewn/0.5`; existing Set and
property-bag APIs remain. See [canonical OOP](canonical-oop.md).


## Structured error recovery (SEWN 0.8)

```vb
DIM offset AS Number = 0
TRY
    offset = Val(REQUEST.Form.Get("offset"))
CATCH err
    offset = 0
FINALLY
    ' Optional cleanup.
END TRY
```

TRY requires one CATCH, one FINALLY, or both, in that order, followed by END TRY. CATCH requires a variable name. That structured error value has only `code` and `message` and is visible inside the catch body; it exposes no native exception, stack, or host details. The variable follows ordinary Object assignment rules but its original value is immutable. Declare values needed across branches before TRY. DIM inside FOR EACH remains unsupported.

Initially only `SEWN.TYPE` data/conversion/operation errors are catchable. Unknown native failures, authorization failures and resource limits abort execution and skip further CATCH/FINALLY code. WydStore's expected `{ok:false,...}` results remain ordinary values for IF checks. All handlers and cleanup use the invocation's existing authority, deadline and counters.

FINALLY runs after successful completion, catchable errors (including uncaught ones), RETURN, STOP and EXIT FOR. Cleanup control exits replace prior successful control exits; pending uncaught errors still propagate. A cleanup error replaces an earlier pending error. Catch variables are removed when the handler exits. Nested TRY blocks and procedure/prototype methods are supported. This is recovery, not rollback: completed property changes or storage writes are not undone.

SEWN 0.8 adds `{op:"try",body:[...],catch:{name:"err",body:[...]},finally:[...]}` with catch/finally optional individually, but at least one required. Previous SEWN schemas remain closed and reject this operation.

## Selection and reference identity (SEWN 0.9)

```vb
SELECT CASE score
    CASE 1, 2, 3
        RETURN "small"
    CASE IS >= 10, IS < 0
        RETURN "outside"
    CASE ELSE
        RETURN "other"
END SELECT
```

SELECT CASE evaluates its selector exactly once. CASE clauses and their
comma-separated tests run left to right in source order, stopping at the first
match. Only that branch runs; there is no fallthrough. CASE ELSE is optional,
unique and last. At least one CASE (including ELSE) is required. Nested selection,
RETURN, STOP, EXIT FOR and TRY retain their existing control-flow meanings.
Declarations obey the existing branch visibility and frame-wide uniqueness rules;
DIM within FOR EACH remains deferred. A FUNCTION whose selection exhaustively
returns requires CASE ELSE and returning bodies in every branch, or a subsequent
RETURN.

Bare CASE expressions use strict scalar equality. Relational syntax is
`CASE IS = value`, `CASE IS <> value`, `CASE IS < value`, `CASE IS <= value`,
`CASE IS > value` or `CASE IS >= value`. Ordering requires matching Numbers or
Strings. Differing scalar types compare unequal under equality; no conversion or
structural Array/Object equality is introduced. Arrays, Objects and context facades
are invalid selectors. Malformed or incompatible operands fail statically when
known, otherwise with SEWN.TYPE when evaluated. Unevaluated tests have no effects.
Ranges such as `CASE 1 TO 5` are unsupported.

```vb
DIM selected AS Wydgit = Me
SELECT CASE selected
    CASE IS Me, IS Page
        RETURN "known object"
    CASE IS NULL
        RETURN "no selection"
    CASE ELSE
        RETURN "other object"
END SELECT
```

`a IS b` and `a IS NOT b` compare nullable Wydgit references. `CASE IS reference`
and `CASE IS NOT reference` use the same identity operation. Both operands must
be Wydgit references or NULL; NULL equals NULL. Identity uses the live trusted
underlying object, not public IDs, matching properties or wrapper tokens. Aliases,
repeated authorized traversal, and parameters/results within one invocation retain
identity. Distinct objects with equal IDs remain distinct. References cannot be
serialized or compared across invocations. Context, stale-handle and consumed-draft
checks still run on evaluated operands, including comparisons with NULL. Identity
never discovers a reference or grants traversal, member access or SEAM authority.

IS has comparison precedence: `NOT a IS b` means `NOT (a IS b)`; AND/OR keep their
existing short-circuit behavior. Existing `value IS NULL` and `value IS NOT NULL`
remain data-or-reference null tests through SEWN 0.6, including Arrays and Objects.
The new general identity expression does not broaden these tests or allow data
identity. `IsNot` remains unsupported.

New selection/identity source selects sewn/0.9. Source using only older features
retains its prior wire version. All new operations share invocation budgets:
selector/operand expression evaluation, each inspected branch and test, selected
body nesting, procedures, services, construction, steps and deadline. Skipped tests
and bodies do not execute. The 0.9 extension introduced no Integer/Float, Scalar/DataType/TypeOf, new Convert,
interfaces, regex, numeric FOR or library linking is introduced.


## Numeric foundations (SEWN 0.10)

Integer and Float are checked native Number contracts, defaulting to zero.
Integer requires a safe integer; Float requires a finite numeric value. Assignments
and procedure boundaries enforce the contracts for static and dynamic inputs.
Legacy unannotated numeric declarations retain Number inference. MOD, backslash,
right-associative ^, Boolean XOR, IsInteger and IsSafeInteger are implemented.
See [numeric foundations](milestones/wbasic-sewn-0.10.md) for exact arithmetic,
precedence, promotion, canonical grammar and compatibility decisions. The earlier
type/inference description above describes legacy Number behavior.

## SEWN 0.11 core contracts

Scalar, DataType, TypeOf and explicit UTC DateTime construction are implemented.
See [the complete contract and serialization boundaries](milestones/wbasic-sewn-0.11.md).
Uninitialized declarations of these types require an initializer. Earlier grammars remain closed.
