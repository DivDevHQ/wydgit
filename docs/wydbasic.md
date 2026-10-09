# WydBASIC — 0.2-K

WydBASIC is the first WydStitch dialect. **WydBASIC should feel like VB6 evolved
into a portable, capability-safe application language.** Make common application
behavior obvious to read and easy to write while moving complexity into the compiler
and runtime. **WydBASIC compiles to SEWN. It does not own execution semantics.**

**WydStitch writes it. SEWN describes it. SEAM constrains it. Wydgine or WydClient runs it.**

`compile(source)` from `wydgine/wydbasic/index.js` synchronously returns a copied,
frozen, canonically validated `{schema:'sewn/0.1',body:[...]}` without executing it.
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

Types: String, Number, Boolean, Null, Array, Object, Wydgit. Explicit declarations
without initialization default to `""`, `0`, `FALSE`, `NULL`, `[]`, `{}`, `NULL`
respectively. `DIM item AS Wydgit = Me` is also supported. Initialization through DIM
does not need SET; subsequent Wydgit assignment requires SET, including NULL.
SET is rejected for scalar/data variables and for unknown dynamic reference values. Context facades cannot be stored as data.

Inference uses literal/expression types, known facade reads, variable types,
`related` relationship results and service results (Object). Dynamic JSON member
reads and Get results infer Unknown, a data type checked by SEWN when consumed.
Explicit types check statically known initializer/assignment/operator mismatches;
they do not add runtime casts or a second runtime type checker. Dynamically typed
values still obey SEWN's strict operator and facade checks. A null Wydgit variable
cannot be called until assigned a valid handle.

Variables must be declared before use. Names are at most 64 ASCII letters, digits
or underscores, starting with a letter or underscore. Keywords, context and reserved security
names cannot be declared. Declaration names are unique across the whole source,
even across mutually exclusive branches and loops. Branch declarations are visible
only while compiling that branch and cannot be referenced after END IF. Loop
variables are fresh, exist only within the loop and cannot shadow existing names.
These conservative rules avoid SEWN's invocation-wide redeclaration ambiguity.
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

## Contexts and calls

ME (also Me), EVENT, REQUEST, RESPONSE, SESSION, PAGE, SERVER, CLIENT are recognized
contexts. Availability is checked at execution; missing context produces
EVENT.CONTEXT. ME is never a normal variable. SERVICES is special compiler syntax
for the canonical service instruction, not an additional readable global.

Member reads and method calls lower to `read`/`invoke` (or statement `call`).
Known facade members, methods and arities come directly from SEWN `bindings.js`.
Unknown facade methods/members and `__proto__`, `constructor`, `prototype` are
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

Current methods are exactly SEWN's allowlist: handle related/Set/Insert/Remove/
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

SERVICES.Call is accepted as a standalone statement or directly as a DIM initializer.
Library and service names must be literal strings; inputs must be JSON-safe.
Nested service expressions and assignment of service results to existing variables
are deferred because SEWN service `into` declares a new variable. Compilation
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
imports, modules, sockets, filesystem, DOM or authority shortcuts exist. Host names
such as process/globalThis/window/document/require/fs are undefined source names.
Trusted JavaScript registrations remain a separate host API.

Deferred: REM, line numbers, semicolons, array indexing syntax, arbitrary dynamic
methods, procedures (SUB/FUNCTION), MODULE, source-declared EVENT, ASYNC/AWAIT,
TRY/CATCH/THROW, NEW/classes, GOTO, DO/LOOP, WHILE, SELECT CASE, lambdas, imports,
recursion, formatter/debugger/LSP and other source dialects. Future syntax may add
procedures and natural service facades only by compiling to canonical SEWN under
SEAM; none of it is available in this foundation.
