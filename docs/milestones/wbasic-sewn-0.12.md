# WBasic / SEWN 0.12 — Canonical operations

Implemented on develop/0.3. Platform and client package versions remain unchanged;
`sewn/0.12` independently versions the new grammar. No dependencies are added.

## Conversion matrix

`Convert(value, TargetType)` requires a bare, statically resolved supported DataType
expression. Descriptor variables and TypeOf expressions are deferred.

| Target | Accepted inputs |
| --- | --- |
| String | String identity; finite numeric shortest locale-independent decimal; Boolean True/False; DateTime canonical UTC ISO with milliseconds |
| Integer | Numeric safe integer; complete decimal String representing a safe integer |
| Float / Number | Finite numeric identity; complete signed decimal String with optional fraction and exponent |
| Boolean | Boolean identity; exactly the case-sensitive Strings True and False |
| DateTime | DateTime identity; String using the strict 0.11 canonical UTC constructor |

Null, containers, descriptors, handles and facades cannot convert. Boolean/numeric
conversion and numeric timestamps are unsupported. String numeric input accepts no
whitespace, hexadecimal or partial parsing. Decimal strings representing integers
outside the safe range are rejected for every numeric target. Nonzero underflow,
nonfinite results and fractional text rounded into an integral Number are rejected.
Other fractional strings use IEEE 754 rounding: binary representation may lose
precision. Already represented finite Numbers retain their established Float/Number
identity; Integer checks safe integrality. TypeOf remains value-based.

Legacy convert without a mode retains exactly the 0.7 CStr/Val rules, including
ASCII whitespace in Val. No legacy instruction gains a new meaning.

## Strings

Implemented: Length, Substring, IndexOf, LastIndexOf, StartsWith, EndsWith,
Contains, ToUpper, ToLower, Trim, TrimStart, TrimEnd, Replace, Repeat.
Arguments require Strings, with safe Integer positions/counts. Indexing and Length
count UTF-16 code units, including separate surrogate halves. Substring requires
0 <= start <= text.length and 0 <= length <= text.length-start; invalid ranges
fail rather than clamp. Empty extraction at the end is valid. Missing matches
return -1. Empty search returns 0 for IndexOf, text.length for LastIndexOf and true
for prefix/suffix/containment tests. Empty strings otherwise work normally.
Replace replaces all nonoverlapping literal matches; replacement dollar signs have
no special meaning. Empty old text is rejected. Repeat requires a nonnegative
safe count; empty text returns empty without iterating even for a large count.
Casing and whitespace use the host JavaScript Unicode implementation; exact
cross-version Unicode mappings/normalization are not promised.

## Mathematics

Implemented: Abs, Floor, Ceiling, Truncate, Round, Min, Max, Power, Sqrt, Sign.
All arguments are finite Numbers, never coerced. Safe Integer inputs retain checked
safe Integer results where applicable; other numeric results must be finite.
Floor/ceiling/truncation of large Floats can remain Float-classified values.
Sqrt rejects negative inputs. Power reuses 0.10 checked exponentiation, including
safe exact integer overflow rejection and finite fractional results. Zero is
normalized at value boundaries; no persistent negative-zero identity is promised.

Round accepts safe Integer digits from 0 through 15. It rounds the shortest decimal
representation of the input Number, mathematically half-away-from-zero, using
bounded internal BigInt decimal division. Thus Round(1.005,2)=1.01 and
Round(-2.5,0)=-3. It does not multiply extreme inputs by an overflowing decimal
scale. Output still uses IEEE 754 representation; this is not decimal arithmetic.
Internal decimal powers are bounded by finite Number decimal exponents (at most
339 decimal places). Negative precision is deferred.

## Wire, contracts and safety

The closed 0.12 grammar extends 0.11 with:

- `convert {type,value,mode:"canonical"}`: type is one of the six static targets.
- `operation {name,args}`: name is an exact canonical operation above, args has
  its fixed arity from schema.js (Round two, Substring/Replace three, binary
  searches/Repeat/Min/Max/Power two, other operations one).

Every argument is a validated expression evaluated once in source order. Earlier
schemas reject operation and canonical conversion mode. Compiler checks known
argument/result contracts; runtime checks dynamic values. Scalar can convert but
cannot bypass runtime concrete input requirements. Assignments/procedure contracts,
DateTime brands, TypeOf and SELECT CASE retain their existing rules. No additional
comparison helpers are needed; existing scalar comparisons suffice.

Invalid wire grammar uses SEWN.INVALID; invalid values/domain/ranges use SEWN.TYPE;
resource failures use SEWN.LIMIT. Existing TRY catches TYPE only. Errors are sanitized.
Operations consume ordinary steps and the shared deadline. Existing string maximum
16,384 UTF-16 units, value-node/depth and program bounds apply, reducible by context.
Repeat and Replace check output size before allocation. Replace scans spend a step
per match; casing preflights bounded per-code-point expansion and spends steps per
64 points before allocating the full result. Final results are rechecked. Native
search/trimming work is bounded by input lengths. No callbacks, host property
lookup, new SEAM grants or runtime packages are introduced.

The portable executor works through WydClient without compiler/server services;
normal npm pretest rebuilds alpha.2 distribution artifacts and sizes.json. Historical
alpha.1 artifacts remain unchanged. Pure operations retain caller authority, private
brands and opaque-reference rejection. Existing installed-package, Guestbook,
Taskboard, numeric, DateTime, conversion and SEAM tests remain regression coverage.

## Deferred work

Static Wydgits, WITH LIBRARY, automatic BAS linking, wrappers, general reflection,
interfaces/Cast, regular expressions, loops/indexing, calendar/clock functions,
package signing and CLI remain outside this milestone. No proposed architecture
is represented as implemented functionality.

## Compatibility evidence and artifact sizes

The baseline source fixtures preserve two Guestbook scripts from published
`bc3d2bf5162615215bd5a54bf7756883155086f5` and seven Taskboard scripts from
`6e9ce28b32702263f23baa8283103559f5f1ff66` (manifest 0.4.0-alpha.14).
All compile under their existing schemas; this source check supplements current
Guestbook HTTP/install/persistence regressions, rather than claiming an archived
full-host replay. The fixture records each original path and commit.

Current alpha.2 bootstrap bundle: 40,731 bytes minified, 14,008 gzip, 12,421
Brotli; increases of 1,093 / 330 / 259 bytes. This bootstrap ships grammar and
prototype validation; portable event execution uses the existing separate browser
modules, now including operations.js. No compiler is needed to execute wire SEWN.
