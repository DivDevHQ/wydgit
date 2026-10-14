# WBasic Language Reference
**Wydgit Platform — Draft Language Specification 1.0**

**Status:** Implemented through SEWN 0.14; later milestones are proposed
**Language:** WBasic (WB)  
**Source extension:** `.bas`  
**Execution representation:** SEWN  
**Execution security:** SEAM  
**Reference runtime:** JavaScript / ECMAScript  
**Target runtimes:** Wydgine, WydClient, and compatible third-party implementations

---

# 1. Introduction

## 1.1 What is WBasic?

WBasic is a modern, strongly checked BASIC-family programming language designed for developing portable, reusable, and secure Wydgit applications.

It combines BASIC's readable syntax with modern data structures, object-oriented programming, structured exception handling, interfaces, and a standard library of computational operations.

WBasic source is compiled into **SEWN**, Wydgit's runtime-neutral execution representation. SEWN is validated and executed within the **SEAM** security model.

WBasic is the first supported source language for SEWN. Future languages, including Wython and Wuby, may compile into the same execution representation.

The language is designed around five principles:

1. **Readable source:** Code should remain approachable to people who have worked with traditional BASIC languages.
2. **Modern semantics:** Prefer well-defined contemporary behavior, using ECMAScript as a reference where practical.
3. **Portability:** Equivalent operations should produce equivalent results across compliant runtimes.
4. **Constrained execution:** Programs have explicit capabilities and bounded resource consumption.
5. **Backward compatibility:** Supported historical applications should retain their observable behavior and security constraints under the compatibility policy in Section 2.1.

## 1.2 Design philosophy

WBasic adopts useful ideas from QBasic, Visual Basic 6, VB.NET, and VBScript without attempting full source compatibility with any of them.

New development should favor WBasic's canonical function vocabulary.

Traditional BASIC functions are implemented as public static methods of the versioned `divdev/wbasic` compatibility library. The compiler must not automatically import this library; modules must explicitly import it. See [Static Wydgits and library resolution](wydgit-static-libraries-spec.md).

Canonical string operations are implemented in 0.12; static imports are implemented in 0.14:

```vb
' Canonical
DIM result AS String = Substring("Goober", 1, 3)
```

```vb
' Traditional BASIC compatibility, in a separate module
WITH LIBRARY divdev/wbasic

DIM result AS String = Mid("Goober", 2, 3)
```

Both expressions return `"oob"`. With the explicit import, `WBasic.Mid("Goober", 2, 3)` is also permitted. The source alias `WBasic` remains case-preserving; canonical package IDs follow the existing lowercase validation policy.

WBasic does not support unrestricted JavaScript execution, arbitrary host imports, or unbounded code execution.

---

# 2. Implementation roadmap

Each milestone introduces a closed, versioned SEWN extension where necessary. The WBasic compiler must not emit features belonging to a newer SEWN version when an older target is selected.

## 2.1 Existing foundation

| SEWN version | Capability | Status |
|---|---|---|
| 0.1 | Core expressions, branching, iteration, contexts, services | Implemented |
| 0.2 | Procedures, functions, event modules | Implemented |
| 0.3 | Wydgit construction and object operations | Implemented |
| 0.4 | Canonical versioned service calls | Implemented |
| 0.5 | Exact member access | Implemented |
| 0.6 | `IS NULL`, `IS NOT NULL`, `EXIT FOR` | Implemented |
| 0.7 | Explicit `CStr()` and `Val()` conversions | Implemented |
| 0.8 | `TRY / CATCH / FINALLY` | Implemented |
| 0.9 | Selection and reference identity | Implemented |
| 0.10 | Numeric foundations and predicates | Implemented |

### Historical SEWN compatibility policy

Wydgit is currently in alpha development. Internal SEWN milestones do not automatically constitute permanent public wire-format compatibility commitments.

Compatibility policy prioritizes:

1. Published Wydgit 0.2.0-alpha.18 behavior, including its Guestbook application baseline.
2. The last known-working pre-Codex Taskboard package, version 0.4.0-alpha.14.
3. The current supported SEWN execution contract.
4. Preservation of relevant security and behavioral regression tests.

Earlier SEWN schemas may remain supported where required by these baselines, but their historical existence alone does not require indefinite runtime support.

Where possible, supported historical applications should be migrated to the current canonical SEWN representation during build or installation rather than requiring permanent duplicate execution paths.

Migration must preserve observable behavior and security constraints. An older schema identifier must never be silently reinterpreted using incompatible semantics.

Unsupported historical representations must be explicitly rejected or migrated through a documented transformation.

Historical Git releases and tags remain unchanged.

See [docs/wydgit-package-distribution.md](wydgit-package-distribution.md) for the broader compatibility architecture.

This policy does not change current runtime schema acceptance or remove existing compatibility tests. The foundation table records implemented milestones, not indefinite support commitments.

## 2.2 Milestone sequence (0.9–0.14 completed)

| Iteration | Primary changes |
|---|---|
| **0.9 — Selection and identity** | `SELECT CASE`, value cases, relational cases, `IS` reference identity, `IS NOT` |
| **0.10 — Numeric foundations** | `Integer`, `Float`, legacy `Number`, numeric type rules, `MOD`, `XOR`, exponentiation, integer division |
| **0.11 — Type contracts** | `Scalar`, `DataType`, `TypeOf()`, type comparisons, type-aware `SELECT CASE`, fundamental UTC `DateTime` |
| **0.12 — Canonical operations** | `Convert()` including DateTime conversion, string primitives, math primitives, additional comparison utilities |
| **0.13 — Collections and loops** | Array indexing, collection utilities, numeric `FOR / NEXT`, `CONST` |
| **0.14 — Static Wydgits and library resolution** | Public static methods, explicit `WITH LIBRARY` imports, qualified calls, compile-time linking, version-locked dependencies, and the `divdev/wbasic` compatibility library |
| **0.15 — Regular expressions** | ECMAScript-compatible regex operations with bounded execution |
| **0.16 — Advanced control flow** | Bounded `DO WHILE`, `DO UNTIL`, loop control refinements |
| **0.17 — Interfaces and casting** | Interface declarations, implementations, interface references, `Cast()` |
| **0.18 — Date and time** | Portable timestamps, calendar operations, date/time standard library |
| **1.0 — Language stabilization** | Complete specification, conformance suite, documentation, compatibility guarantees |

The 0.14 architecture is specified in [docs/wydgit-static-libraries-spec.md](wydgit-static-libraries-spec.md). Static libraries and imports are implemented; [0.14 decisions](milestones/wbasic-sewn-0.14.md) define the current contract.

These versions describe an intended dependency order. A milestone may be split or moved if implementation reveals additional dependencies.

In particular, interfaces depend on existing prototype inheritance and should be designed with that object model, rather than as an independent object system.

---

# 3. Language syntax

## 3.1 Source format

WBasic uses line-oriented statements.

Keywords and ordinary identifiers are case-insensitive.

```vb
DIM Name AS String = "Andy"
name = "Barney"
NAME = "Goober"
```

All three identifiers refer to the same variable.

String values and case-sensitive external data keys retain their original capitalization.

## 3.2 Comments

An apostrophe begins a comment.

```vb
' Full-line comment
DIM total AS Integer = 10  ' Inline comment
```

Traditional `REM` comments are not included in the canonical language.

## 3.3 Identifiers

Identifiers may contain ASCII letters, digits and underscores, and must not begin with a digit.

Reserved language keywords cannot be used as ordinary variable names.

Names belonging to externally defined Wydgit properties may retain their exact case and be accessed using the existing bracketed-member syntax.

```vb
DIM count AS Integer = 0

DIM label AS String = Me.[displayLabel]
```

---

# 4. Data types

## 4.1 Concrete types

| Type | Description |
|---|---|
| `String` | UTF-16-compatible ECMAScript string semantics |
| `Integer` | Signed, exactly representable safe integer |
| `Float` | Finite IEEE 754 binary64 numerical value |
| `Boolean` | `TRUE` or `FALSE` |
| `Null` | Absence of a value |
| `Array` | Ordered collection of SEWN data values |
| `Object` | JSON-compatible keyed data structure |
| `Wydgit` | Opaque reference to an authorized Wydgit instance |
| `Number` | Legacy numeric type maintained for compatibility |

### Integer

An Integer represents a whole number within JavaScript's safe-integer range:

- Minimum: −9,007,199,254,740,991
- Maximum: 9,007,199,254,740,991

Integer arithmetic must not silently produce an inexact integer.

Overflow raises a controlled numeric error.

### Float

Float follows IEEE 754 binary64 semantics, restricted to finite values at the SEWN boundary.

`NaN`, positive infinity, and negative infinity are not ordinary accepted WBasic numeric values.

### Number

`Number` is retained for older WBasic programs and previously compiled SEWN representations.

New code should favor Integer or Float when the intended numerical behavior is known.

**Open decision:** whether `Number` eventually becomes a purely abstract numeric contract or remains a concrete legacy compatibility type.

## 4.2 Type-contract types

WBasic supports types that define the allowable set of values rather than a separate runtime representation.

### Scalar

`Scalar` is the built-in contract implemented by:

- String
- Integer
- Float
- Boolean
- Legacy Number
- DateTime

An underlying value retains its actual concrete type.

```vb
FUNCTION Identity(value AS Scalar) AS Scalar
    RETURN value
END FUNCTION
```

`Scalar` does not permit Array, Object, Wydgit or arbitrary host objects.

Null is not implicitly a Scalar. Nullable values require an explicit future nullability mechanism or a separately documented nullable contract.

### Interfaces

Interfaces define contracts implemented by object types.

For example:

```vb
FUNCTION IdentityCollection(col AS ICollection) AS ICollection
    RETURN col
END FUNCTION
```

The object retains its underlying identity and implementation while being accessed through the declared interface.

**Status:** Planned for SEWN 0.17.

## 4.3 DataType descriptors

`DataType` is the built-in category of immutable type descriptors.

Type identifiers can be used as values where a language operation explicitly expects a DataType.

```vb
Integer
Float
String
Boolean
Scalar
```

A DataType is not a String containing a type name and is not a JavaScript constructor or executable object.

Type descriptors cannot grant capabilities or reveal arbitrary host implementation details.

Whether ordinary variables may store DataType values remains to be specified. The initial design permits them only in explicitly type-aware operations.

---

# 5. Variables and constants

## 5.1 Declaration

```vb
DIM count AS Integer = 0
DIM ratio AS Float = 0.75
DIM title AS String = "Taskboard"
DIM enabled AS Boolean = TRUE
```

Every variable must be declared before use.

Declarations may include initial values.

## 5.2 Type inference

When no type is declared, WBasic infers a type from a statically known initializer. In 0.10, unannotated numeric declarations retain legacy Number inference for compatibility (DIM x=0 may later receive 0.5). Within explicit Integer expression contracts, safe numeric literals infer Integer and other finite literals Float; explicit Float expression contracts use Float. Integer/Float assignments and procedure contracts are checked at runtime, including dynamic values. See the [numeric milestone](milestones/wbasic-sewn-0.10.md).

```vb
DIM title = "Taskboard"
DIM enabled = TRUE
```

When the exact type cannot be inferred, the compiler must preserve the appropriate dynamic-data constraints without silently inventing a type.

## 5.3 Reference assignment

Opaque Wydgit references continue to use explicit reference-assignment semantics.

```vb
DIM current AS Wydgit
SET current = Me
```

Future interface references will follow the same reference-safety discipline.

## 5.4 Constants

**Introduced: SEWN 0.13**

```vb
CONST MaxPageSize AS Integer = 8
CONST AppName AS String = "Taskboard"
```

Constants must be initialized on declaration and cannot subsequently be reassigned. Implemented contracts are String, Number, Integer, Float, Boolean, Null, Scalar, DateTime and DataType; collections and Wydgit references are excluded. Dynamic initializers require an explicit type. See [0.13](milestones/wbasic-sewn-0.13.md#constant-bindings).

---

# 6. Expressions and operators

## 6.1 Operator precedence

The completed language will support the following operator categories.

| Category | Operators |
|---|---|
| Grouping | `( expression )` |
| Unary | `+`, `-`, `NOT` |
| Exponentiation | `^` |
| Multiplicative | `*`, `/`, `\`, `MOD` |
| Additive | `+`, `-` |
| String concatenation | `&` |
| Value comparison | `=`, `<>`, `<`, `<=`, `>`, `>=` |
| Reference identity | `IS`, `IS NOT` |
| Boolean conjunction | `AND` |
| Boolean exclusive OR | `XOR` |
| Boolean disjunction | `OR` |

SEWN 0.10 is implemented. Highest to lowest: ^ (right-associative), unary signs, *, /, backslash and MOD, + and -, &, comparisons/identity, NOT, AND, XOR, OR. Other binary levels associate left. Thus -2 ^ 2 is -4; 2 ^ 3 ^ 2 is 512. XOR evaluates both Boolean operands; AND/OR short circuit. See the [numeric milestone](milestones/wbasic-sewn-0.10.md) for the complete contract.

## 6.2 Parenthetical expressions

Parentheses override ordinary expression precedence.

```vb
DIM result AS Integer = (10 + 5) * 2
```

This feature already exists.

## 6.3 Numeric operators

```vb
DIM a AS Integer = 17 MOD 5
DIM b AS Float = 17 / 5
DIM c AS Integer = 2 ^ 8
```

Integer arithmetic uses checked range rules.

Floating-point arithmetic uses the documented IEEE 754 behavior.

Division by zero and operations producing nonfinite results must yield controlled errors.

Implemented in 0.10: MOD is signed truncating remainder; backslash is truncation toward zero. Both require safe-integer values and nonzero divisors. Integer +,-,* are exact and checked; division and mixed Float arithmetic return finite Float. Power uses right associativity and rejects unsafe exact Integer results; negative/fractional exponents use finite IEEE 754 results. IsInteger(value) and IsSafeInteger(value) expose the JavaScript predicates without coercion through trusted intrinsics; supported nonnumeric data returns FALSE. Scalar-based wrappers remain future work.

## 6.4 Boolean operators

```vb
DIM a AS Boolean = TRUE AND FALSE
DIM b AS Boolean = TRUE OR FALSE
DIM c AS Boolean = TRUE XOR FALSE
DIM d AS Boolean = NOT TRUE
```

Logical operators require Boolean operands.

WBasic does not implicitly interpret arbitrary Strings, Numbers or Objects as Boolean values.

`AND` and `OR` preserve their existing short-circuit behavior.

An eventual `XAND`/`EQV` alias may be provided if sufficient use cases emerge; it is not required for the initial operator milestone.

---

# 7. Equality, identity and types

## 7.1 Value equality

`=` and `<>` compare supported values.

```vb
IF total = 10 THEN
    RETURN TRUE
END IF
```

WBasic maintains strict comparison rules rather than VB-style automatic coercion.

Structural equality of Arrays and Objects is not implicitly provided.

## 7.2 Reference identity

**Introduced: SEWN 0.9**

`IS` determines whether two references identify the same Wydgit object instance.

```vb
DIM first AS Wydgit
DIM second AS Wydgit

SET first = Me
SET second = Me

IF first IS second THEN
    RETURN TRUE
END IF
```

`IS NOT` is the inverse.

Object identity must be based on trusted opaque runtime identity, not merely matching user-visible IDs or properties.

Identity comparisons do not bypass invocation scope, authorization, or stale-reference protections.

## 7.3 Null comparison

Existing syntax remains supported:

```vb
IF value IS NULL THEN
    RETURN FALSE
END IF

IF value IS NOT NULL THEN
    RETURN TRUE
END IF
```

For nullable references, this remains a null test rather than an unrestricted object comparison.

## 7.4 Type inspection

**Introduced: SEWN 0.11**

`TypeOf(value)` returns a DataType descriptor.

```vb
IF TypeOf(value) = String THEN
    RETURN "Text"
END IF
```

For ordinary scalar values, the descriptor identifies the concrete runtime type.

Plain data objects report Object. Wydgit references report only Wydgit, without prototype disclosure. See [the implemented 0.11 contract](milestones/wbasic-sewn-0.11.md) for construction, defaults and serialization boundaries.

In 0.10 numeric classification is value-based: safe whole values are Integer, other finite Numbers are Float. Dynamic assignments enforce declared Integer/Float constraints; no textual literal distinction is retained.

---

# 8. Conditional execution

## 8.1 IF / ELSEIF / ELSE

```vb
IF score >= 90 THEN
    RETURN "Excellent"
ELSEIF score >= 60 THEN
    RETURN "Passing"
ELSE
    RETURN "Failing"
END IF
```

Already supported.

## 8.2 SELECT CASE

**Introduced: SEWN 0.9**

SELECT CASE evaluates its selector once, then executes the first matching case.

```vb
SELECT CASE status
    CASE "new", "pending"
        RETURN "Waiting"

    CASE "active"
        RETURN "In progress"

    CASE ELSE
        RETURN "Unknown"
END SELECT
```

There is no fallthrough.

`CASE ELSE` is optional and must appear last.

### Relational cases

```vb
SELECT CASE score
    CASE < 60
        RETURN "Fail"

    CASE >= 90
        RETURN "Excellent"

    CASE ELSE
        RETURN "Pass"
END SELECT
```

Traditional `CASE IS < 60` syntax may be supplied by a BASIC compatibility mode, but canonical WBasic reserves `CASE IS` for reference identity.

### DataType cases

**Completed with SEWN 0.11**

```vb
SELECT CASE TypeOf(value)
    CASE String
        RETURN "Text"

    CASE Integer, Float
        RETURN "Numeric"

    CASE Boolean
        RETURN "Logical"

    CASE ELSE
        RETURN "Other"
END SELECT
```

### Identity cases

```vb
SELECT CASE selected
    CASE IS first
        RETURN "First object"

    CASE IS second
        RETURN "Second object"

    CASE IS NULL
        RETURN "No selection"

    CASE ELSE
        RETURN "Another object"
END SELECT
```

`CASE IS reference` must compare object identity, not object contents.

Wydgit identity cases and DataType value cases remain separate comparison categories.

---

# 9. Iteration

## 9.1 FOR EACH

Already supported.

```vb
FOR EACH item IN items
    ' Process item
NEXT item
```

Loops remain subject to SEWN execution limits.

## 9.2 Numeric FOR / NEXT

**Introduced: SEWN 0.13**

```vb
FOR i = 1 TO 10
    ' Process iteration
NEXT i
```

Optional STEP:

```vb
FOR i = 10 TO 1 STEP -1
    ' Process iteration
NEXT i
```

Numeric loops are bounded by execution limits and reject invalid increments.

The numeric loop variable is local, read-only and unavailable after NEXT. Bounds and nonzero STEP evaluate once. Finite increments must progress and preserve checked Integer constraints; fractional steps use IEEE 754 addition. See [0.13](milestones/wbasic-sewn-0.13.md#numeric-iteration).

## 9.3 EXIT FOR

Already supported.

```vb
FOR EACH item IN items
    IF item = "stop" THEN
        EXIT FOR
    END IF
NEXT item
```

Exits the innermost enclosing FOR loop.

## 9.4 Conditional loops

**Introduced: SEWN 0.16**

```vb
DO WHILE condition
    ' Work
LOOP
```

```vb
DO UNTIL condition
    ' Work
LOOP
```

Conditional loops do not bypass SEWN iteration or execution budgets.

Unbounded loops are never permitted merely because the source syntax allows them.

---

# 10. Arrays and collections

## 10.1 Array literals

```vb
DIM names AS Array = ["Andy", "Barney", "Goober"]
```

Already supported.

## 10.2 Array indexing

**Introduced: SEWN 0.13**

```vb
DIM first AS String = names[0]
DIM second AS String = names[1]
```

Canonical array indexing is zero-based.

Index expressions must resolve to valid nonnegative integers.

Array indexing is implemented as read-only. Nonnegative safe Integer indices must be below the Array length; invalid or exhausted reads fail with SEWN.TYPE. Nested typed values retain their identities. Objects, Strings and arrays of opaque references cannot be indexed.

## 10.3 Collection operations

Implemented canonical functions in SEWN 0.13:

| Function | Description |
|---|---|
| `Length(collection)` | Number of elements |
| `Contains(collection, value)` | Whether an element exists |
| `IndexOf(collection, value)` | Index of first matching value |
| `Slice(collection, start, length)` | Extract a range |
| `Join(collection, separator)` | Join strings |
| `Split(text, separator)` | Split text into an Array |

Length, Contains and IndexOf dispatch only on String or portable Array values. Membership uses existing scalar equality; nested arrays/objects are unsupported search values. Slice clamps ranges and copies values. Join requires Strings; Split uses literal UTF-16 separators. See [0.13](milestones/wbasic-sewn-0.13.md#collection-operations-and-equality) for edge cases and allocation limits.

Interface-based collections will eventually expose their own declared methods.

---

# 11. Strings

**Canonical string operations introduced: SEWN 0.12**

WBasic uses ECMAScript-compatible UTF-16 string indexing for its initial portable string model.

Unless otherwise stated, indexing is zero-based.

| Function | Description |
|---|---|
| `Length(text)` | String length |
| `Substring(text, start, length)` | Extract substring |
| `IndexOf(text, search)` | First matching position, or -1 |
| `LastIndexOf(text, search)` | Last matching position |
| `StartsWith(text, prefix)` | Prefix test |
| `EndsWith(text, suffix)` | Suffix test |
| `Contains(text, search)` | Substring test |
| `ToUpper(text)` | Uppercase conversion |
| `ToLower(text)` | Lowercase conversion |
| `Trim(text)` | Remove surrounding whitespace |
| `TrimStart(text)` | Remove leading whitespace |
| `TrimEnd(text)` | Remove trailing whitespace |
| `Replace(text, old, new)` | Replace matching text |
| `Repeat(text, count)` | Repeat string |

Examples:

```vb
DIM name AS String = "Goober"

DIM first AS String = Substring(name, 0, 3)
DIM upper AS String = ToUpper(name)
DIM found AS Boolean = Contains(name, "ber")
```

`Substring("Goober", 0, 3)` returns `"Goo"`.

The implemented indexing, empty-search, checked range, Unicode and allocation rules are documented in [SEWN 0.12](milestones/wbasic-sewn-0.12.md).

String operations must respect SEWN value-size and allocation limits.

---

# 12. Numeric functions

**Introduced: SEWN 0.10–0.12**

| Function | Description |
|---|---|
| `Abs(value)` | Absolute value |
| `Floor(value)` | Round toward negative infinity |
| `Ceiling(value)` | Round toward positive infinity |
| `Truncate(value)` | Remove fractional portion |
| `Round(value, digits)` | Round to specified precision |
| `Min(a, b)` | Minimum |
| `Max(a, b)` | Maximum |
| `Power(base, exponent)` | Exponentiation |
| `Sqrt(value)` | Square root |
| `Sign(value)` | Sign of value |

Round uses decimal half-away-from-zero on the shortest Number representation, with digits 0–15. See [SEWN 0.12](milestones/wbasic-sewn-0.12.md) for numeric domains, overflow and zero rules.

For integer-producing operations, the result must satisfy the required integer range.

---

# 13. Conversion

## 13.1 Convert

**Introduced as canonical syntax: SEWN 0.12**

WBasic uses one canonical conversion operation:

```vb
Convert(value, TargetType)
```

Conceptual signature:

```vb
FUNCTION Convert(value AS Scalar, targetType AS DataType) AS targetType
```

This describes a compiler-recognized type-dependent return contract. It is not ordinary user-defined function syntax.

Examples:

```vb
DIM count AS Integer = Convert("42", Integer)

DIM amount AS Float = Convert("12.50", Float)

DIM text AS String = Convert(123, String)
```

The compiler determines the result type from the statically known target descriptor.

Conversion is explicit and checked.

Invalid conversions produce controlled type errors.

The initial contract should reject ambiguous or lossy numerical conversion unless a specific policy has been documented.

The implemented [conversion matrix](milestones/wbasic-sewn-0.12.md#conversion-matrix) specifies accepted values and precision limits. `Convert` does not imply that every Scalar can be transformed into every other Scalar.

## 13.2 Legacy CStr and Val

Traditional aliases are implemented as public static methods of `divdev/wbasic`, available only after an explicit `WITH LIBRARY divdev/wbasic` import. Qualified calls through the case-preserving `WBasic` alias require the same import.

```vb
FUNCTION CStr(value AS Scalar) AS String
    RETURN Convert(value, String)
END FUNCTION

FUNCTION Val(value AS Scalar) AS Number
    RETURN Convert(value, Number)
END FUNCTION
```

These are the implemented wrapper bodies; static-ness and public visibility are prototype metadata. The static-method export mechanism follows [the static-library specification](wydgit-static-libraries-spec.md).

Existing `CStr()` and `Val()` behavior from SEWN 0.7 must be preserved, including strict numeric parsing.

SEWN 0.14 resolves imported CStr/Val through ordinary static-library exports. Without an applicable imported export, only these two historical intrinsics retain SEWN 0.7 convert lowering. Imported Val uses canonical strict parsing (no surrounding whitespace, unsafe numeric strings or nonzero underflow); legacy Val retains surrounding ASCII whitespace and its historical finite-number parsing. Imported CStr additionally supports DateTime; legacy CStr rejects it. This narrow compatibility path preserves known application baselines.

Previously compiled SEWN 0.7 programs remain executable in the current runtime. Future support and documented migrations follow Section 2.1; this is not an indefinite commitment to each intermediate grammar.

---

# 14. Procedures and functions

## 14.1 SUB

```vb
SUB SetTitle(value AS String)
    Me.Set("title", value)
END SUB
```

## 14.2 FUNCTION

```vb
FUNCTION Add(a AS Integer, b AS Integer) AS Integer
    RETURN a + b
END FUNCTION
```

Functions require an explicit return contract.

Ordinary procedures are resolved statically.

## 14.3 Scalar parameters

**Introduced: SEWN 0.11**

```vb
FUNCTION Describe(value AS Scalar) AS String
    SELECT CASE TypeOf(value)
        CASE String
            RETURN "String"

        CASE Integer, Float
            RETURN "Number"

        CASE Boolean
            RETURN "Boolean"
    END SELECT

    RETURN "Unknown"
END FUNCTION
```

Scalar parameters preserve the concrete type of supplied values.

## 14.4 Scalar return types

```vb
FUNCTION Identity(value AS Scalar) AS Scalar
    RETURN value
END FUNCTION
```

The returned value preserves its concrete runtime type.

The caller initially sees the declared Scalar contract unless static analysis proves a narrower type.

## 14.5 Function overloading

General-purpose function overloading is **not part of the initial WBasic specification**.

Scalar contracts and type-aware canonical operations cover many of the use cases that would otherwise require overloads.

---

# 15. Object-oriented programming

WBasic programs execute against Wydgit's existing object model.

Objects are defined by prototypes with controlled inheritance, properties, methods, slots, and relationships.

WBasic does not create unrestricted JavaScript objects or native JavaScript class instances.

## 15.1 Wydgit references

```vb
DIM current AS Wydgit
SET current = Me
```

A Wydgit variable stores an opaque reference governed by its invocation and SEAM permissions.

## 15.2 Prototype construction

WBasic supports the existing qualified-prototype `NEW` form.

```vb
DIM card AS Wydgit
SET card = NEW "publisher/task-card"(NewId())
```

The example prototype identifier is illustrative.

Construction remains limited by runtime draft counts, depth, size, and capability checks.

## 15.3 Inheritance

Wydgit prototypes support controlled single inheritance.

Methods and properties obey the platform's canonical inheritance, visibility, override, and publisher-boundary rules.

## 15.4 Interfaces

**Introduced: SEWN 0.17**

Interfaces specify public method/property contracts without exposing concrete implementation details.

Illustrative future syntax:

```vb
INTERFACE ICollection
    FUNCTION Count() AS Integer
END INTERFACE
```

The declaration grammar, installation metadata, and interface inheritance rules require a dedicated object-model specification.

Interface implementation must be explicitly validated against the declared contract.

## 15.5 Cast

**Introduced: SEWN 0.17**

```vb
DIM col AS ICollection
SET col = Cast(myDictionary, ICollection)
```

`Cast()` obtains a validated interface or compatible reference view of an existing object.

It does not convert an object's data representation and does not create another object.

Invalid casts fail.

A cast never enlarges the caller's effective SEAM authority.

## 15.6 Implements

```vb
IF Implements(myDictionary, ICollection) THEN
    SET col = Cast(myDictionary, ICollection)
END IF
```

`Implements()` checks whether a reference is compatible with the specified interface.

It does not perform a cast or grant access.

---

# 16. Regular expressions

**Introduced: SEWN 0.15**

WBasic supports ECMAScript-compatible regular-expression syntax through canonical regex operations.

Initial patterns are represented as Strings.

| Function | Description |
|---|---|
| `RegexTest(text, pattern, flags)` | Boolean pattern match |
| `RegexMatch(text, pattern, flags)` | First match and associated data |
| `RegexMatches(text, pattern, flags)` | Bounded collection of matches |
| `RegexReplace(text, pattern, replacement, flags)` | Pattern-based replacement |
| `RegexSplit(text, pattern, flags)` | Pattern-based splitting |

Examples:

```vb
DIM valid AS Boolean = RegexTest(
    "ABC-1234",
    "^[A-Z]{3}-\d{4}$",
    ""
)
```

```vb
DIM cleaned AS String = RegexReplace(
    "Task   123",
    "\s+",
    " ",
    "g"
)
```

WBasic string literals preserve backslashes rather than introducing JavaScript string-escape behavior.

### Regex execution safety

Regular expressions must not provide a way to exceed SEWN resource limits.

Native ECMAScript regex engines can perform catastrophic backtracking. A simple input-size restriction does not guarantee bounded execution.

Consequently, the regex implementation must use an enforceable isolation or bounded-execution strategy, or explicitly restrict supported patterns.

Until that is established, a full ECMAScript regex promise cannot be made.

Pattern and input lengths, result counts, capture groups, replacement expansion, and execution time must all be controlled.

Replacement callbacks and arbitrary JavaScript execution are not available.

JavaScript-style `/pattern/flags` literals are deferred.

---

# 17. Structured exception handling

Already supported through SEWN 0.8.

```vb
TRY
    DIM quantity AS Number = Val("42")
    RETURN quantity

CATCH err
    RETURN 0

FINALLY
    ' Cleanup
END TRY
```

Only the documented recoverable SEWN errors are catchable.

Security denials, resource-limit violations, and unrecognized host failures are not converted into ordinary recoverable application exceptions.

FINALLY does not circumvent execution budgets.

---

# 18. Static Wydgits and library resolution

**Implemented: SEWN 0.14**

Static Wydgits are dedicated, versioned prototypes without instance state or Me.
Authors use ordinary FUNCTION/SUB source declarations compiled with static:true;
prototype metadata supplies the source alias, public/private methodRules and exact
dependency versions. PUBLIC/PRIVATE/STATIC source modifiers are not implemented.

```vb
WITH LIBRARY divdev/wbasic

DIM result AS String = Mid("Goober", 2, 3)
DIM qualified AS String = WBasic.Mid("Goober", 2, 3)
RETURN result
```

Imports precede executable statements and module declarations. Libraries must be
available in an approved host build context with exact dependency pins. Package
IDs are lowercase and publisher-qualified; aliases retain their presentation
casing and match case-insensitively. Duplicate/conflicting aliases and ambiguous
unqualified exports fail compilation. Local procedures precede nonreserved
imported exports; canonical intrinsics remain reserved. Private helpers can be
called only within their declaring library. SUB invocation uses CALL, including
`CALL TextUtilities.Observe("value")`. Qualified calls still require an import.

The compiler links only referenced static procedures and required helpers into
validated, self-contained SEWN. Provenance records canonical IDs and exact versions.
Calls reuse the shared executor, caller authority and resource counters. Installation
never implies an import; no library or publisher grants additional authority.

The initial divdev/wbasic 1.0.0 library implements Mid, Len, InStr, UCase, LCase,
CStr and Val. Mid uses one-based indexing, clamps count to available text and
returns empty when start exceeds the string; start < 1 or negative count fails.
InStr returns a one-based position or 0 when absent. Legacy unimported CStr/Val
retain the narrow compatibility path in Section 13.2. Other traditional aliases
such as Left/Right/LTrim/RTrim/Sqr/Int/Fix/Sgn are deferred.

See [the complete 0.14 contract](milestones/wbasic-sewn-0.14.md) for authoring,
installation, dependency pinning, visibility, linked wire, security, compatibility
and browser deployment. Service facades, mutable static fields, static inheritance,
mixed prototypes, overloading and dynamic imports remain deferred.

---

# 19. Date and time

**Introduced: SEWN 0.18**

Date/time behavior must be deterministic and independent of the host machine's incidental locale settings.

The canonical API should distinguish:

- Absolute timestamps
- Calendar dates
- Local date/time representations
- Time zones
- Durations

Proposed operations include:

```vb
DateAdd(...)
DateDiff(...)
DatePart(...)
FormatDate(...)
ParseDate(...)
```

A source of current time, such as `Now()`, is an environmental input rather than a pure computation and must follow the runtime's context and determinism rules.

The detailed date/time specification remains open.

---

# 20. Host contexts and services

WBasic continues to expose only the documented, permission-checked Wydgit contexts.

Existing contexts include:

- `Me`
- `Event`
- `Request`
- `Response`
- `Session`
- `Page`
- `Server`
- `Client`
- `Services`

Actual context availability depends on execution environment and invocation scope.

External operations use registered, versioned Wydgit services.

```vb
DIM result = SERVICES.Call("wydstore", "query", {
    "store": "tasks",
    "collection": "tasks",
    "limit": 8
})
```

The existing canonical `SERVICES.Invoke()` form is also retained.

No source-level feature can bypass SEAM authorization, resource budgets, or host service validation.

---

# 21. Execution guarantees

A compliant WBasic compiler and SEWN executor must preserve the following guarantees:

1. No arbitrary host-language execution.
2. No dynamic evaluation of untrusted source.
3. No unrestricted filesystem, network, DOM or operating-system access.
4. No implicit capability escalation.
5. No uncontrolled recursion or iteration.
6. No unrestricted allocation of application objects.
7. No unsupported implicit type conversions.
8. No arbitrary reflection into host-language objects.
9. No silent reinterpretation of older SEWN grammars.
10. No uncontrolled computational operations, including regex execution.

All new computational primitives must be included in the execution-budget model.

---

# 22. Language compatibility and portability

WBasic, Wython and Wuby may provide different source syntax for the same canonical operations.

For example:

**WBasic**

```vb
DIM title AS String = Substring(name, 0, 3)
```

A future Wython or Wuby implementation may express the equivalent computation using its native syntax.

Each compiler must target the same canonical SEWN behavior.

Differences in language syntax must not result in differences in security privileges or computational semantics.

Compatibility wrappers are implemented as ordinary static Wydgit library methods, explicitly imported using the source language's import syntax. Future Wython and Wuby compilers may link the same validated SEWN methods without a separate library execution mechanism.

SEWN is not required to preserve historical language quirks unless they are part of a deliberately specified canonical operation.

---

# 23. Deliberately unsupported features

The following remain outside the intended WBasic language:

- `GOTO` and `GOSUB`
- `ON ERROR RESUME NEXT`
- Arbitrary JavaScript execution
- Arbitrary native module imports
- Unrestricted dynamic evaluation
- Unbounded recursion or loops
- Implicit truthiness of arbitrary values
- Automatic object-to-string serialization
- Arbitrary object reflection
- Late-bound access to host-language prototypes
- Unrestricted pointer or memory manipulation
- Unrestricted file/network operations
- Silent Integer overflow
- Implicit conversion between incompatible scalar types
- Automatic exposure of object members beyond the declared reference contract

These exclusions are deliberate safety and portability decisions, not missing implementation work.

---

# 24. Open design decisions

The following must be resolved before their respective milestones are finalized.

| Question | Required by |
|---|---|
| Final SELECT CASE grammar, including relational cases | 0.9 |
| Object identity across scopes and invocation boundaries | 0.9 |
| Integer/Float literal inference and preservation | Resolved in 0.10 milestone |
| Arithmetic promotion, remainder and rounding rules | Resolved in 0.10 milestone |
| Whether legacy Number remains concrete or becomes a contract | Remains concrete in 0.10; future changes require compatibility design |
| Whether Scalar includes nullable variants | 0.11 |
| Whether TypeOf distinguishes declared versus observable numeric types | 0.11 |
| Whether type comparisons provide flow-sensitive narrowing | 0.11 |
| Exact Convert input/output matrix | 0.12 |
| UTF-16 substring edge cases and Unicode version expectations | 0.12 |
| Array mutation, copying and bounds behavior | 0.13 |
| Standard-library name resolution and version locking | 0.14 |
| ECMAScript regex safety implementation | 0.15 |
| Interface declaration and implementation model | 0.17 |
| Casting and runtime contract enforcement | 0.17 |
| Date/time and time-zone representation | 0.18 |

---

# 25. Conformance requirements

Every new feature must include:

- Lexer/parser acceptance and rejection tests.
- Compiler semantic checks.
- Closed SEWN grammar and validator tests.
- Runtime positive and negative tests.
- Resource-budget and security tests.
- Cross-runtime equivalence tests where applicable.
- Regression tests for previously accepted source.
- Explicit rejection of unsupported new operations in older SEWN schemas.
- Complete documentation and executable examples.

Compatibility functions must have tests for historical edge cases.

New numeric and string operations must be tested independently of host-specific assumptions.

---

**End of initial future-state WBasic Language Reference draft.**
## Implemented 0.11 boundaries

DateTime is a fundamental scalar in 0.11. Explicit Convert support is implemented in 0.12;
broader date/time utilities remain deferred. Scalar excludes Null and descriptors.
No flow-sensitive narrowing is implemented. Uninitialized Scalar, DataType and
DateTime declarations require an initializer. NULL retains its literal meaning;
TypeOf(NULL) obtains the Null descriptor. Future examples elsewhere in this reference
do not extend the [implemented milestone contract](milestones/wbasic-sewn-0.11.md).
