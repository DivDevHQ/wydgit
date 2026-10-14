# WBasic / SEWN 0.11 — Core Type Contracts and DateTime

Implemented on develop/0.3. No platform package version bump is required: this
milestone adds the independently versioned `sewn/0.11` grammar.

## Contracts and inspection

Scalar accepts String, finite Number (observably Integer or Float), Boolean and
DateTime. Null, collections, descriptors and Wydgit handles are excluded. It adds
no wrapper and preserves concrete values. Scalar, DataType and DateTime contracts
are enforced at assignments and procedure inputs/returns. Known incompatible
source types fail compilation; dynamic mismatches fail with SEWN.TYPE. Scalar
cannot be used as a concrete numeric/string contract without an explicit future
narrowing mechanism. Flow-sensitive narrowing and Convert are deferred.

DataType descriptors name String, Integer, Float, Number, Boolean, Null, Array,
Object, Wydgit, Scalar, DataType and DateTime. Bare type names produce descriptors;
NULL retains its historical literal meaning, so obtain its descriptor with
TypeOf(NULL) (or canonical typeLiteral in SEWN). Descriptors compare by canonical
name with = and <>; they are distinct from Strings and cannot use reference IS.
SELECT CASE evaluates its selector once and retains first-match ordering.

TypeOf returns DataType. Safe integral finite numeric values report Integer;
all other finite numeric values report Float, including unsafe whole numbers.
Declared Float and legacy Number do not change this value-based classification.
Containers report Array/Object; Wydgit handles report only Wydgit after existing
invocation/visibility guards, without prototype disclosure. Facades are rejected.
Type inspection grants no authority and performs no conversion.

## DateTime

`DateTime("2026-10-13T12:00:00.000Z")` constructs an explicit UTC instant.
The input must exactly match canonical ISO UTC output, including three millisecond
digits. Four-digit years and signed six-digit expanded years are accepted. Parsing
round-trips through canonical ISO output to reject normalization, invalid calendar
dates, offsets, local times and noncanonical forms. Integral Unix milliseconds
range from -8640000000000000 to 8640000000000000 inclusive. No clock is consulted
for construction. Uninitialized DateTime, Scalar and DataType declarations are
rejected; nullable typed-value support remains independent future work.

DateTime supports =, <>, <, <=, >, >= and SELECT CASE value/relational tests.
Numeric and String comparisons fail without conversion. Existing null tests work;
comparison with Null uses existing equality semantics. Arithmetic and reference
identity are rejected. DateAdd, DateDiff, calendars and timezones remain deferred.

## Representation and boundaries

The wire grammar adds `typeLiteral {type}`, `typeOf {value}`, `dateTime {value}`
and `typeCheck {type,value}` expressions (each also has its `op`). dateTime's value
is a String expression; validated construction occurs during execution. Programs
can be JSON serialized or structured cloned and validated/reexecuted to reconstruct
typed values explicitly. Earlier expression grammars do not recognize these ops.

Runtime values are frozen records with private WeakMap provenance; DataType carries
a canonical name and DateTime carries integral milliseconds. Arbitrary JSON with
matching keys remains Object. Trusted copying preserves brands, including nested
collections and procedure frames; member access cannot inspect branded records.
Equality uses contents, never incidental JavaScript object identity.

At external JSON boundaries DateTime becomes canonical ISO text, and DataType
becomes `{schema:"sewn.type/0.11",type:"Integer"}` (for example). Neither shape
reconstitutes a type automatically on input. Arbitrary structured cloning of runtime
results, WydStore JSON persistence, Wydgit properties and service round trips do
not preserve brands. The supported reconstitution boundary is the validated SEWN
expression grammar, not arbitrary JSON persistence. No host constructors or methods
are exposed. Handles retain the existing opaque-token mechanisms and cannot be
smuggled through typed values or nested data.

## Review findings and validation

The archived WydBASIC reference stays unchanged. The future reference previously
claimed public prototype type disclosure and included aspirational conversion and
interface examples. Implemented inspection exposes only Wydgit; general conversions,
interfaces and overloaded functions remain unimplemented. Older unannotated numeric
source retains Number inference and its existing wire schema.

`test/wbasic-contracts.test.js` covers inspection, canonical equality, Scalar
membership, dynamic rejection, procedure returns, nested copying, serialized
workflow reconstitution, date boundaries/calendar validation, comparisons,
selection, earlier grammar rejection, WydClient Change cancellation, dynamic
procedure inputs/returns, Wydgit inspection and execution budgets. Existing regression
suites cover 0.1–0.10, Taskboard, 0.7 conversions and 0.9 reference identity.

These contracts live in the shared SEWN validator/executor rather than a WBasic VM,
so future Wython and Wuby frontends can emit the same operations and use identical
portable semantics and SEAM limits. 0.12 can add explicit conversion operations
without altering observable classification or granting reflection authority.
