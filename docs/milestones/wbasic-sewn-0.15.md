# WBasic / SEWN 0.15 — Bounded regular expressions

Implemented on `develop/0.3` in the shared portable SEWN executor. The new closed
wire contract is `sewn/0.15`. Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2
remain unchanged, following 0.11–0.14. No new SEAM grants or scripting engine.

## Dependency and bounded execution decision

Use exact `re2js@2.8.6`, a pure JavaScript RE2-family implementation, with no runtime
transitive dependencies, install scripts, native modules or WebAssembly assets.
Its MIT license permits MPL-2.0 distribution; the generated local ESM artifact
retains the full copyright/license notice. npm's lockfile records tarball integrity.
The [upstream project](https://github.com/le0pard/re2js) has Node/browser tests;
its [security policy](https://github.com/le0pard/re2js/security) supports 2.x and
showed no published advisories at review. npm metadata records maintenance through
July 2026. This is a source review and regression gate, not an independent audit.
The npm advisory query reports no RE2JS advisory; existing unrelated file-type and
happy-dom advisories remain outside this milestone and were not changed.

The trusted adapter deliberately selects only the pinned implementation's Thompson
NFA (`re2().executeEngine` delegates to `doExecuteNFA`). It bypasses DFA caches,
BitState backtracking, prefilters and OnePass matching. Only compile, matcher,
find, indices and group metadata are used; no native RegExp construction, host
callbacks, translateRegExp, reflection or replacement API is invoked. RE2JS's
private internals make this an intentionally version-pinned integration: an engine
upgrade requires source review, regenerated assets and all conformance/safety gates.

Source inspection of Machine.match/step/add and Queue confirms that input position
advances monotonically and each instruction is inserted once per position in a
sparse/dense queue. Epsilon closure deduplicates before following alternatives.
Capture copying is bounded by group count. Class searches are bounded by pattern
ranges. NFA recursion is bounded by compiled instruction count, not input length
or exponential search paths. Two queues use O(instructions * captures) storage,
independent of input length; at hard maxima their capture buffers total at most
73,728 bytes, plus bounded queue/instruction/AST overhead. No lookbehind tables
or DFA states are populated during matching.

A bounded subset gate validates both constant and dynamic patterns before compiler
entry. It counts nesting, capture groups and conservative expanded atoms, including
multiplication through bounded repetitions and the finite minimum of `{n,}`. Thus compiler simplification cannot
allocate a repetition-expanded unbounded program before the instruction-size check.
Pattern parsing is at most 16 recursive group levels; AST processing and NFA
closure recursion are bounded by the small accepted pattern/program maxima.

Each execution owns one cumulative regex work counter. Before compilation it
reserves `pattern.length² + text.length + flags.length + 1` before flag/Unicode
validation (including recoverable failures), then `4 * (expandedAtoms + 1)²`. Before every find
it reserves `(remainingUTF16Units + 1) * instructions * (2 * captures + 2) * 16`.
This conservatively covers finding plus lazy capture loading, queue processing,
character-class search and capture copies, even if the actual match is short.
Output construction also reserves its character and value-node counts.
Each reservation also spends `ceil(work / 128)` ordinary SEWN steps before entering
synchronous engine code. Checks use the original deadline; rejected reservations
never start matching. Enumeration may therefore exhaust work before reaching the
maximum match count. Empty matches still reserve work. These are deterministic
work units, not elapsed-time estimates or a claim of an exact CPU instruction count.
The NFA bound and hard compile/state/input caps hold independently of host speed.
Cancellation/deadline checks alone are not the regex safety mechanism.

## Supported grammar and Unicode

This is an explicitly restricted ECMAScript-compatible subset, not full JavaScript
regex compatibility:

- Literals, escaped regex punctuation, `.`, `^`, `$`, alternation `|`, ordinary
  capturing groups and `(?:...)` noncapturing groups.
- Nonempty character classes, negation and ranges. POSIX classes and nested class
  syntax are rejected; range endpoints must be individual characters, not class
  escapes such as \d. Class syntax still undergoes engine validation.
- `*`, `+`, `?`, `{n}`, `{n,m}`, `{n,}` and their lazy forms. Bounded repetition
  limits and conservative expanded-atom limits apply before compilation. Repetition
  numbers use canonical decimal spelling without leading zeros (except 0 itself).
- `\d`, `\w`, `\s` and their complements outside classes. Inside classes the
  positive forms are accepted; complement escapes in a class are deferred.
- `\b` and `\B` ASCII word boundaries outside classes; `\b` inside a class is
  backspace. `\n`, `\r`, `\t`, `\f`, `\v`, standalone `\0`, `\xHH` and `\uHHHH`.
  Four-digit surrogate escapes are rejected. Escape names are strictly checked;
  identity-letter escapes, octal and control-letter escapes are deferred.

Backreferences, all lookarounds, named captures, Unicode property escapes, inline
flags, possessive quantifiers, regex literals and engine-specific extensions fail
with SEWN.REGEX. Repetition of a group containing any capture is rejected when it
can repeat more than once, including `*` and `+`. This avoids RE2 versus ECMAScript
capture-reset differences. Ordinary optional groups remain supported. Noncapturing
nested/ambiguous quantifiers are safe under NFA execution and work reservations.
Assertions cannot be quantified. No unsupported pattern has a native fallback.

Strings and returned indices use UTF-16 code units. `u` enables code-point matching
and whole-surrogate-pair progress after an empty match. Without `u`, non-BMP text or
patterns are rejected, rather than silently adopting RE2's code-point behavior.
Lone surrogates are rejected in both modes. BMP accented and combining characters
match exactly, without normalization. `\d`/`\w` remain ASCII. `\s` is explicitly
translated to ECMAScript whitespace, including NBSP/BOM and excluding U+0085.
Dot excludes LF, CR, U+2028 and U+2029 unless `s` is supplied.

`i` is supported only when both text and pattern (including hex escapes) are ASCII;
non-ASCII case folding is rejected. This avoids Unicode-table and ECMAScript-folding
differences. `m` anchors support LF-separated lines; anchored patterns with `m`
reject input containing CR/U+2028/U+2029. A pattern containing `$` without `m`
rejects text ending in a line terminator, because RE2 lacks ECMAScript's final-newline
alternative. These context-dependent restrictions fail explicitly with SEWN.REGEX.
Other uses of those line terminators, including dot-all matching, remain supported.

## Flags and exact operations

Every call requires all positional arguments, including an explicit flags String.
Accepted flags are `g`, `i`, `m`, `s`, `u`, in any order, once each. Empty flags
are valid. Duplicates, unknown flags, `d`, `v`, `y` and uppercase flags are errors.
The Unicode/anchor restrictions above apply to combinations as well. There is no
retained engine lastIndex or application-visible regex object.

| Operation | Contract |
| --- | --- |
| RegexTest(text, pattern, flags) | Boolean for first match; g is accepted and does not change the result. Syntax/limits are errors, never false. |
| RegexMatch(text, pattern, flags) | First structured match or Null; g does not change first-match semantics. |
| RegexMatches(text, pattern, flags) | Nonoverlapping matches in source order, regardless of g; never truncate silently. |
| RegexReplace(text, pattern, replacement, flags) | First-only replacement without g, all matches with g. Replacement is entirely literal: dollar signs, $$, $&, $1 and backslashes have no expansion semantics. No callbacks. |
| RegexSplit(text, pattern, flags) | All nonoverlapping delimiters regardless of g. Captures are excluded. Preserve leading, trailing and adjacent empty fields. Always return only Strings. |

Match shape is exactly `{value:String, index:Integer, groups:Array}`. index is the
zero-based UTF-16 start; groups contains positional groups 1..N, excluding whole
match 0. An unmatched optional capture is Null; a participating empty capture is
an empty String. No native object, input property, names, prototypes, functions,
mutable engine state or handles enter portable data. Final values are copied and
frozen through the existing SEWN boundary.

Zero-width enumeration advances the search by one UTF-16 unit, or one code point
with u, and permits one match at text.length before stopping. It does not remove
that unit from replacement/splitting. Thus RegexMatches("", "", "") returns one
empty match; RegexReplace("ab", "", "-", "g") returns "-a-b-"; RegexSplit("ab",
"", "") returns ["", "a", "b", ""]. RegexSplit("", "", "") returns ["", ""],
while no delimiter yields [text]. This simple split contract deliberately differs
from JavaScript String.split's zero-width boundary and capture insertion rules.
Literal Split and literal Replace remain unchanged.

## Limits, errors and shared authority

Hard defaults (host context can only reduce them, including to zero):

| Resource | Maximum | ExecutionContext key |
| --- | --- | --- |
| Pattern UTF-16 units | 256 | sewnRegexPattern |
| Searchable input UTF-16 units | 4,096 | sewnRegexInput |
| Capturing groups | 8 | sewnRegexCaptures |
| Matches/replacements/delimiters per operation | 128 | sewnRegexMatches |
| Aggregate output UTF-16 units per operation | 16,384 | sewnRegexOutput |
| Group nesting | 16 | sewnRegexDepth |
| Finite repetition bound/minimum | 32 | sewnRegexRepeat |
| Conservative expanded atoms | 128 | sewnRegexAtoms |
| Compiled NFA instructions | 512 | sewnRegexInstructions |
| Cumulative work per execution | 1,000,000 | sewnRegexWork |

Output also respects sewnString. RegexMatch/Matches count whole-match and all
capture text together, including duplication; captures are checked by index before
slicing. Structured match allocation reserves 5 + groupCount value nodes before
construction (a conservative one-node margin). Arrays reserve their root and each
element. Split permits at most 129 fields (128 delimiters plus remainder). Shared
sewnValueNodes (4,096), live-variable, expression-depth, procedure, iteration,
10,000-step and 1,000-ms maxima still apply. No new cumulative allocator policy is
introduced; output limits are per operation, consistent with existing value budgets.

SEWN.TYPE means wrong argument value types; SEWN.REGEX means malformed/unsupported
patterns, flags or matching contexts; SEWN.LIMIT means exhausted resource bounds.
New 0.15 TRY/CATCH can recover TYPE and REGEX. LIMIT and authority denials remain
fatal and bypass CATCH/FINALLY recovery, preventing catch-and-retry replenishment.
Malformed wire is SEWN.INVALID. No dependency diagnostics or stacks are exposed.
Linked static procedures use the same counter, original caller ExecutionContext,
step/deadline and authority; private/static dispatch adds no grants.

## Closed grammar, compiler and deployment

0.15 extends 0.14's existing `operation {name,args}` expression with only the five
exact canonical names. args is an ordered array of validated nested expressions;
three Strings are required, or four for RegexReplace. Unknown fields/operations,
missing operands and wrong arities fail validation. Wrong known source types/arity
fail compilation; dynamic types are checked by the executor. Source lookup is
case-insensitive; wire names retain exact casing. No implicit WITH LIBRARY or
compatibility wrapper is involved. These names are reserved; existing generic
Match/Test/Replace symbols gain no regex overload.

The 0.15 envelope has schema, procedures and body, with optional libraries metadata
when static linking is used. Static libraries containing regex and their callers
upgrade to 0.15; existing 0.14 libraries keep their original artifacts. Optional
metadata does not relax historical 0.14's required libraries field. Schemas 0.1–0.14
reject regex operation names and retain their prior contracts.

scripts/build-regex.js reproducibly bundles the pinned npm package into
wydgine/sewn/vendor/re2js.js. npm run build:client regenerates this local artifact
before the current bootstrap; the historical alpha.1 bootstrap remains untouched.
WydClient's executor uses a fixed local dynamic import on first regex operation.
The Hono allowlist serves the adapter and engine beside existing runtime modules.
Ordinary event execution does not request them. No network CDN, WASM initialization,
privileged browser capability, source compiler, library resolver or installer is
required. Import/compile time still belongs to the original execution deadline.

Measured with browser/es2022/ESM/minified esbuild and Node gzip/Brotli:

| Artifact | Before min / gzip / Brotli | After min / gzip / Brotli | Change |
| --- | --- | --- | --- |
| alpha.2 bootstrap | 44,493 / 15,137 / 13,387 | 45,139 / 15,325 / 13,553 | +646 / +188 / +166 |
| Fully inlined event runtime | 57,187 / 19,981 / 17,906 | 209,648 / 67,712 / 59,244 | +152,461 / +47,731 / +41,338 |

The fully inlined measurement includes the optional engine and is not the served
module startup footprint. With ESM splitting, the event entry is 43,052 / 15,752 /
14,188, its shared runtime chunk 15,128 / 5,369 / 4,822, and the lazy regex chunk
150,367 / 45,954 / 40,849. These split artifacts are measurements, not a new deployed
bundle format. The locally served engine itself is 145,426 minified bytes including
its license. The optional footprint is accepted for a maintained portable matcher;
Unicode tables and unused engine APIs remain dependency implementation details.

## Conformance, compatibility and deferred functionality

The 102 JSON fixtures in test/fixtures/sewn15-regex.json and the self-contained
third-party artifact test/fixtures/sewn15-static-regex.json are compiler-independent
operation inputs/results/errors/reduced budgets. The same fixtures execute on
server and an independently browser-bundled wire runtime with native dynamic
RegExp construction disabled. Tests cover all operations, zero-width/empty cases,
captures, indices, ASCII/BMP/astral/combining text, flags, malformed syntax, forged
wire, resource accounting, concurrent/repeated state isolation, fatal retry and
static-library authority. The adversarial captured examples fail before matching;
noncapturing equivalents execute through bounded NFA and reject insufficient work
before entry. An engine-entry spy verifies that unsupported syntax never compiles,
insufficient matching work never enters the NFA, and accepted calls bypass other
engine paths. WydClient Change cancellation/limits and real HTTP runtime routes
are tested. Existing security/source-import tests retain a narrowly enumerated
exception for the fixed local lazy module, without enabling dynamic application
imports or host tooling.

Existing Guestbook package/HTTP/storage, archived Guestbook and Taskboard source
fixtures, package install/signing, SEAM, instance/static dispatch, arrays, loops,
DateTime/DataType, literal strings and historical CStr/Val remain regression gates.
The archived source baselines supplement current application tests; they do not
claim full archived-host replay. Host clock performance can change when a deadline
is reached, but deterministic grammar/results/work maxima are identical.

Deferred: full ECMAScript regex compatibility, repeated captures, named captures,
Unicode case folding/properties, lone-surrogate matching, non-u astral matching,
non-LF multiline anchors, final-newline $ alternatives, replacement expansion,
regex literals/objects/callbacks, lookarounds/backreferences and newer flags. No
adjacent roadmap features or host invocation mechanism were introduced.

## Executed verification

- Focused SEWN/regex/static/collection suite: 48 test groups, all passed.
- Required full `npm test -- --test-isolation=none`: 659 tests, all passed.
- Required `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- Shared server/browser conformance: 102 operation fixtures plus a portable
  third-party static artifact, matching results/errors/reduced budgets.
- Adversarial captured examples rejected; noncapturing NFA equivalents bounded;
  direct entry-spy assertions prove rejection before matching/compilation.
- Guestbook package/HTTP/storage, archived Guestbook/Taskboard source baselines,
  historical contracts, installed/signed packages and SEAM/security passed.
- Current client artifacts rebuilt; bootstrap/optional runtime sizes measured above.
- git diff --check clean; final branch, status and complete diff inspected.

The initial sandboxed suite encountered socket restrictions. The first unrestricted
run passed 657/658 tests and identified the overly broad dynamic-import assertion;
the assertion now admits exactly the fixed local regex import and still forbids
all other dynamic/native imports. Final verification uses the unrestricted command
so HTTP/storage/client transport regressions run with their required test sockets.
