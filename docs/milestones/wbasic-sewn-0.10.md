# WBasic/SEWN 0.10 — Numeric Foundations

Branch: `develop/0.3`. Numeric foundations precede Scalar and DataType contracts
in 0.11; neither is implemented here. Historical WydBASIC reference is unchanged.

## Representation and contracts

All public numbers are native JavaScript IEEE 754 Numbers. Integer requires
`Number.isSafeInteger`, in [-9007199254740991, 9007199254740991]. Float requires
`Number.isFinite`; whole-number Float values are allowed. Legacy Number remains
concrete and retains its previous behavior. No textual distinction between 42
and 42.0 survives runtime execution. Both satisfy Integer assignments.

Integer/Float declarations default to zero. Initializers, subsequent assignments,
procedure arguments and returns enforce these contracts, including dynamic JSON
and authorized service data. String and Boolean numeric coercion is forbidden.
Statically invalid literal assignments produce located compiler type diagnostics;
dynamic failures produce deterministic, recoverable `SEWN.TYPE` errors.

## Inference and compatibility

Unannotated numeric declarations retain Number inference: `DIM x=0` can later
receive `Val("0.5")`. Automatic Integer declaration inference would break existing
accumulators and dynamic Number assignments. Within an explicit Integer expression
contract literals infer Integer when safe, otherwise Float; explicit Float
expression contracts treat numeric literals as Float. Numeric operators involving
Integer/Float variables select checked arithmetic. Pure legacy Number arithmetic
keeps its earlier binary expression and minimum schema even in a 0.10 workflow.

New operators use runtime value classification when no narrower declared operand
contract is known. Arithmetic results propagate Integer for Integer +,-,* Integer,
Float for division or a Float operand; dynamically classified results retain a
Number compiler contract. Explicit annotations remain checked constraints.

## Arithmetic

Checked +,-,* on safe integer values compute exactly and reject unsafe results.
Bounded internal BigInt calculations verify exactness before returning a Number;
BigInt is never a public value, serialized value, source type or general runtime.
Division returns Float and rejects nonfinite results. Mixed Float arithmetic uses
IEEE 754 rounding and rejects nonfinite results. Legacy Number arithmetic remains
unchanged and is not retroactively subject to integer overflow checks.

MOD and backslash require safe-integer **values**, including whole-valued Float
or Number inputs; fractional/unsafe values and zero divisors fail. MOD is remainder
with truncating quotient (17 MOD 5 = 2, -17 MOD 5 = -2, 17 MOD -5 = 2).
Backslash truncates toward zero (17 / 5 becomes 3; either negative sign becomes -3).
Both compute exactly and return Integer. The remainder helper follows ECMAScript signed-zero behavior, but existing canonical JSON value cleaning normalizes negative zero to positive zero at operand, storage and result boundaries. Exact integer division and other exact Integer operations also normalize zero. No persistent signed-zero distinction is promised.

Exponentiation uses ECMAScript power semantics. Safe-integer bases with nonnegative
safe-integer exponents compute exact Integer results or reject overflow; negative
or fractional exponents and other finite operands compute Float results. Even a
whole-valued Float base is classified by value for this operation. Integral
nontrivial powers bound the exponent to 53 before internal exact computation;
0 and +/-1 have constant-time special cases. Zero to zero is 1. Negative bases
with fractional exponents, nonfinite results and unsafe exact Integer powers fail.

## Operator precedence

Highest to lowest; parentheses override all levels:

| Level | Operators | Associativity |
| --- | --- | --- |
| 1 | ^ | right |
| 2 | unary +, - | prefix |
| 3 | *, /, backslash, MOD | left |
| 4 | +, - | left |
| 5 | & | left |
| 6 | comparisons, IS, IS NOT | left |
| 7 | NOT | prefix, includes comparison |
| 8 | AND | left, short circuit |
| 9 | XOR | left, evaluates both operands |
| 10 | OR | left, short circuit |

`2 ^ 3 ^ 2 = 512`, `-2 ^ 2 = -4`, `(-2) ^ 2 = 4`, `2 ^ -2 = 0.25`.
XOR requires Boolean values and returns whether they differ; it has no numeric
bitwise interpretation. AND/OR retain their historical short-circuit behavior.

## Canonical grammar and predicates

`sewn/0.10` extends 0.9 with four closed expression forms:

| op | Required fields |
| --- | --- |
| numeric | operator, left, right, type (Integer, Float, Auto) |
| numericCheck | type (Integer or Float), value |
| numericPredicate | predicate (IsInteger or IsSafeInteger), value |
| xor | left, right |

numeric permits +,-,*,/,MOD,backslash,^ only. Auto chooses exact arithmetic for
safe-integer operands except division and negative powers; Float opts into finite
IEEE arithmetic; Integer additionally checks the result. Integer/Float procedure
contracts are available only in this schema. Old binary operators and earlier
schema contracts are unchanged; all 0.1–0.9 validators reject the new expressions.

IsInteger and IsSafeInteger are case-insensitive trusted intrinsics, with one
portable data argument and Boolean result. They use JavaScript's predicates
without coercion. Their canonical names are reserved against source procedure/variable declarations; earlier wire reserved-name sets remain unchanged. Unsafe integer-valued Numbers satisfy IsInteger only; fractional
values, Strings, Booleans, Null, Arrays and Objects satisfy neither. Opaque references
and facades are not accepted. No Scalar type, wrappers or overloading is introduced.

Expressions share depth, steps, deadlines and existing value/size limits. Exact
arithmetic is bounded independently; no new permissions or capability surfaces.

## Versions, scope and handoff

New wire version: sewn/0.10. Platform stays 0.3.0-alpha.7; client stays
0.1.0-alpha.2. No manifest, dependency or lockfile changes. Required pretest rebuilds
client bundles because prototype acceptance now includes 0.10. Standalone client
execution remains deferred. Taskboard and prior source tests remain regressions.

Implementation changes span compiler/parser/tokenizer, SEWN schema/validator/
executor and numeric helper, prototype acceptance, the portable HTTP module allowlist, numeric conformance and the
obsolete 0.9 assertion that Integer declarations are unsupported. Language,
SEWN, milestone and changelog documentation describe the implemented contracts.

Changes are uncommitted for review; no commit SHAs, merge, tag, push, release or
publication. Authorized future commits must use `WBasic/SEWN 0.10:` prefixes.
Remaining limitations are the intentional Number declaration inference policy and
value-based power classification. Scalar, DataType, TypeOf, casts, conversion
expansion, libraries and all unrelated features remain deferred to later milestones.
These numeric contracts provide the foundation for 0.11 without implementing it.

## Executed verification

- Focused `node --test --test-isolation=none test/wbasic-numeric.test.js test/wbasic-selection.test.js test/wydbasic.test.js`: 25 passed, 0 failed, including six numeric conformance groups and historical source/selection regressions.
- Required `npm test` outside the socket sandbox after the portable module allowlist fix: 602 passed, 0 failed. The sandboxed attempt was interrupted after HTTP-dependent failures/stalling; the first unrestricted run identified the missing numeric module route, which was corrected.
- Required `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- `git diff --check`: clean. Status, stat, tracked diff and new files reviewed.

Working tree started clean on develop/0.3 and contains only this milestone's
uncommitted implementation, conformance, documentation and rebuilt alpha.2 client
artifacts. Platform/client package versions and historical alpha.1 bundles remain
unchanged. No unresolved design decisions block 0.10; 0.11 can build on the
documented contracts when separately authorized.
