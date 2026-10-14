# WBasic / SEWN 0.13 — Collections, numeric loops and constants

Implemented on `develop/0.3` through the existing WBasic frontend and shared SEWN
validator/executor. The independently versioned wire grammar is `sewn/0.13`.
Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2 are unchanged; no dependencies
or lockfile changes are needed. The static-library specification remains proposed.

## Syntax and indexed reads

```vb
CONST MaxPageSize AS Integer = 8
DIM names AS Array = ["Andy", "Barney", "Goober"]
DIM second AS String = names[1]
DIM total AS Integer = 0
FOR i = 1 TO 10
    total = total + i
NEXT i
RETURN [second, total]
```

Indexing is zero-based and read-only, including chained indexing such as
`grid[1][0]` and indexing procedure/operation results. Target and index evaluate
once, in order. Target must be a portable Array, and index a nonnegative safe
Integer below its length. Empty, out-of-range, fractional, unsafe and nonnumeric
indices fail with SEWN.TYPE; statically known invalid types/indices fail compilation.
Objects, Strings, facades and arrays of opaque Wydgit references cannot be indexed.
There is no host property lookup or writable indexed expression. Indexed results
use existing internal copy rules, preserving nested DateTime and DataType brands.
The compiler does not infer generic element types; dynamically indexed values are
checked at explicit assignment, argument and return contracts.

## Collection operations and equality

These are canonical operations, independent of any BASIC compatibility library.

| Operation | Inputs and result |
| --- | --- |
| Length | String UTF-16 length or Array element count; Integer |
| Contains | String/String substring test or Array/comparable scalar membership; Boolean |
| IndexOf | String/String first substring position or Array/comparable scalar first matching position; Integer, -1 if absent |
| Slice | Array, nonnegative safe Integer start and length; copied Array |
| Join | Array of Strings, String separator; String |
| Split | String, literal String separator; Array of Strings |

Compile-time checks resolve known String versus Array operands. Unknown values use
checked runtime dispatch. Objects, Null, numbers and facades do not stand in for
collections. Existing String operations and their empty-search semantics remain
unchanged. An operation with a statically known String first operand can still emit
0.12; Array or dynamic dispatch emits 0.13. No user-defined overloading is enabled.

Array Contains/IndexOf call the same executor comparator as `=`. Strings, Booleans,
finite Numbers (Integer/Float compare by value), Null and private typed values are
supported. DataType compares by canonical type name, DateTime by UTC instant.
Strict scalar equality does not coerce types. Existing DateTime versus other
non-null types is an error, rather than comparing its external ISO string.
Nested arrays and plain Objects have no equality contract: all elements are
preflighted as comparable scalars, and such containers fail even if a preceding
scalar would have matched. The search value must be comparable even for an empty
array. An empty valid array returns false/-1. Comparisons then proceed in order to
the first match; an incompatible DateTime comparison reached during that scan fails.
No object identity, serialization-based equality or privileged-handle comparison
is introduced. Length and Slice still accept nested portable data arrays.

Slice clamps start to array length and requested length to available elements,
without adding potentially overflowing indices. Exhausted/empty ranges return [];
negative/fractional/unsafe arguments fail. Its new output is copied/frozen by the
existing runtime value boundary, preserving nested private brands.

Join rejects every nonstring element; it performs no implicit Convert. Empty
arrays produce "", and an empty separator concatenates strings directly. Split
uses literal ECMAScript-compatible UTF-16 semantics: no match returns [text],
leading/trailing/adjacent separators preserve empty fields. Empty input with a
nonempty separator returns [""]. Empty separator splits into individual UTF-16
code units (including separate surrogate halves); empty input then returns [].
No regular expressions or interfaces are used.

## Numeric iteration

`FOR name = start TO end [STEP step]` ends with `NEXT [name]`. STEP defaults to 1;
named NEXT must match case-insensitively. Start, end and step evaluate exactly
once, left-to-right, before the loop variable exists. They must be finite numeric
values, and step must be nonzero, including for wrong-direction loops. Positive
steps use value <= end, negative steps value >= end; wrong direction performs
zero iterations. Bounds are captured even if other variables change in the body.

The numeric loop variable is local and read-only. It cannot shadow an existing
name, be reassigned, or be referenced after NEXT; sequential numeric loops may
reuse the name. This follows FOR EACH's temporary runtime binding and source
visibility, while leaving historical FOR EACH declaration-name restrictions and
assignment behavior intact. DIM and CONST inside either kind of loop remain
unsupported: invocation-lived declarations cannot be redeclared every iteration.
Initialize accumulators and constants before entering loops.

Stepping uses the existing numeric helper. If all entry values are safe Integers,
increments are exact checked Integer addition; otherwise they are finite IEEE 754
Float addition. Numeric classification remains value-based, including whole-valued
Float entry values. No epsilon comparison or decimal accumulation is added.
For example 0 TO 1 STEP 0.25 visits five values; repeated 0.1 addition follows
representable binary values. A reached endpoint finishes without computing an
unused increment. Other increments, even when crossing the bound, must be finite,
safe for Integer stepping and strictly progress in the step direction. Overflow
or floating-point nonprogress fails with SEWN.TYPE.

EXIT FOR exits the innermost numeric or FOR EACH loop. RETURN/STOP signals and
existing TRY handling retain their meaning. Loop bindings are removed on exit,
return or error. Procedure frames cannot exit a caller's loop. No total-iteration
estimate rejects loops that may legitimately EXIT FOR early; each actual iteration
and increment is checked under the shared execution budget.

## Constant bindings

CONST always requires an initializer. Allowed contracts: String, Number, Integer,
Float, Boolean, Null, Scalar, DateTime and DataType. Inference works for known
allowed types; dynamic initializers require an explicit AS contract. Arrays,
Objects and Wydgit references are excluded. Constants may use ordinary safely
validated runtime expressions, including SESSION data and canonical operations.
They are evaluated once per declaration execution, never executed by a compiler-time
interpreter. No service authority or arbitrary service evaluation is introduced;
existing explicitly bound runtime calls retain their own guards and budgets.

Constants prevent rebinding, using source checks and an executor-owned immutable
name set. They share ordinary declaration resolution, branch visibility, duplicate
name rules and per-procedure frames. Separate procedure invocations have separate
constants. Values are immutable scalars/descriptors, so no new deep-freeze or
persistent ownership system is needed. Rebinding through hand-authored wire `set`,
`declare`, call output or handler collisions is rejected. Values never outlive their
execution context or turn opaque references into portable data.

## Closed wire grammar

The 0.13 envelope remains `{schema,procedures,body}` and extends 0.12 with:

| Kind / op | Required fields after op |
| --- | --- |
| Expression index | target expression, index expression |
| Expression operation | name, args (existing form, with the six collection signatures above) |
| Statement forNumeric | name, start/end/step expressions, body statement array |
| Statement constant | name, type (allowed constant contract), value expression |

The compiler supplies literal STEP 1 when omitted. No NEXT instruction or writable
index exists in the wire language. New names have exact canonical wire casing;
source names are case-insensitive. Arity, fields, nested bodies/expressions,
procedure call graph and lexical EXIT FOR are validated before execution.

0.13 also permits existing `typeCheck {type,value}` for all portable data contracts
(excluding Wydgit), so explicit primitive assignment contracts can check dynamic
indexed data. Array assignment checks preserve historical temporary reference
arrays used by controlled FOR EACH traversal; indexing, collection operations,
procedure data parameters and JSON boundaries still reject opaque references. Earlier schemas retain their original allowed typeCheck contracts.
Prior schemas reject new forms/names; 0.12 operation dispatch remains String-only
for Length/Contains/IndexOf even if given Array data at runtime. Legacy convert,
CStr/Val, numeric expressions, Scalar/DateTime/DataType, SELECT CASE, FOR EACH and
SEAM contracts are preserved.

## Resource and security controls

Existing shared maxima remain: 10,000 steps, 1,000 total loop iterations, 64 live
variables, 4,096 value nodes, 16,384 UTF-16 units per String, depth/call/program
bounds and a 1,000 ms deadline. ExecutionContext reductions remain authoritative.
Nothing replenishes budgets. Numeric loops reserve a live variable and check each
iteration and increment. Membership preflight/comparisons and Join scan spend
steps. Portable array validation rejects nested reference tokens and checks the
budget every 64 visited nodes.

Join checks exact output length before joining. Split counts exact output elements
before allocating; count plus the Array root must fit valueNodes. Its total text
is bounded by the input String. Slice output cannot exceed its validated input
size, uses clamped arithmetic and passes ordinary value-copy/depth limits. No new
memory-limit configuration or unchecked allocation path is introduced.

Malformed wire produces SEWN.INVALID; bad types, ranges, equality domains,
immutable rebinding, zero steps and invalid increments produce SEWN.TYPE.
Resource/deadline failures produce SEWN.LIMIT. Existing TRY catches TYPE only;
fatal budgets and denials cannot be recovered into renewed execution. Errors are
sanitized. New operations grant no SEAM capabilities and expose no host methods,
constructors, prototypes, SQL, filesystem, callbacks or source evaluation.

## WydClient and compatibility evidence

WydClient uses the same portable executor. Tests execute 0.13 indexed reads,
collection expressions, constants and procedure loops in a Change handler and
verify cancellation. An independently browser-bundled executor executes serialized
wire workflows with no WBasic compiler, Node-only modules, storage services or
additional runtime packages, including reduced iteration-budget rejection.

Normal npm pretest rebuilds alpha.2 bootstrap artifacts; alpha.1 stays unchanged.
New sizes: 41,570 bytes minified, 14,323 gzip, 12,646 Brotli, increases of
839 / 315 / 225 bytes over 0.12. These measure bootstrap grammar/prototype
validation; event execution still uses existing separate portable modules.

The existing archived source fixtures retain Guestbook at
bc3d2bf5162615215bd5a54bf7756883155086f5 and pre-Codex Taskboard at
6e9ce28b32702263f23baa8283103559f5f1ff66. Their compilation checks supplement
current Guestbook HTTP/install/persistence and installed-package/SEAM regressions;
they do not claim full archived host replay.

## Deferred limitations

No writable indices, mutable/reference constants, generic element types,
interface collection protocols, Cast, static Wydgits, WITH LIBRARY, compatibility
wrappers, automatic BAS linking, regular expressions, conditional loops, calendars,
package signing/distribution/CLI, adapters or unrelated refactors are implemented.
The static-library design is unchanged and remains the 0.14 architectural reference.

## Executed verification

- `node --test --test-isolation=none test/sewn-collections.test.js`: 15 groups passed, covering compiler/wire contracts, typed/nested arrays, equality, empty and UTF-16 splitting, allocations, loop progress/budgets, immutability, WydClient cancellation/limits and browser-only wire execution.
- `npm test`: 633 passed, 0 failed, including the existing 0.10–0.12, FOR EACH/selection, archived source baselines, Guestbook, installed-package, storage and SEAM/security regressions.
- `npm run check`: 3 complete pages, 42 internal links and unique anchors.
- `git diff --check`: clean. Final status, diff and artifact-size changes reviewed on develop/0.3.

The former selection-suite assertion that numeric FOR is unsupported was replaced
with a 0.13 schema assertion; unrelated rejection and security tests are preserved.
