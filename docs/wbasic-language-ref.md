# WBasic Language Reference
**Wydgit Platform — Draft Language Specification 1.0**

**Status:** Proposed future-state specification  
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
5. **Backward compatibility:** Previously accepted source and validated SEWN programs should retain their meaning.

## 1.2 Design philosophy

WBasic adopts useful ideas from QBasic, Visual Basic 6, VB.NET, and VBScript without attempting full source compatibility with any of them.

New development should favor WBasic's canonical function vocabulary.

Traditional BASIC functions may be supplied through a versioned compatibility library.

For example:

```vb
' Canonical
DIM result AS String = Substring("Goober", 1, 3)

' Traditional BASIC compatibility
DIM result AS String = Mid("Goober", 2, 3)
```

Both expressions return `"oob"`.

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

These earlier versions must remain valid.

## 2.2 Proposed milestones

| Iteration | Primary changes |
|---|---|
| **0.9 — Selection and identity** | `SELECT CASE`, value cases, relational cases, `IS` reference identity, `IS NOT` |
| **0.10 — Numeric foundations** | `Integer`, `Float`, legacy `Number`, numeric type rules, `MOD`, `XOR`, exponentiation, integer division |
| **0.11 — Type contracts** | `Scalar`, `DataType`, `TypeOf()`, type comparisons, type-aware `SELECT CASE` |
| **0.12 — Canonical operations** | `Convert()`, string primitives, math primitives, additional comparison utilities |
| **0.13 — Collections and loops** | Array indexing, collection utilities, numeric `FOR / NEXT`, `CONST` |
| **0.14 — Standard-library linking** | Automatically linked `.bas` modules, WBasic compatibility library, migration of `CStr()` and `Val()` |
| **0.15 — Regular expressions** | ECMAScript-compatible regex operations with bounded execution |
| **0.16 — Advanced control flow** | Bounded `DO WHILE`, `DO UNTIL`, loop control refinements |
| **0.17 — Interfaces and casting** | Interface declarations, implementations, interface references, `Cast()` |
| **0.18 — Date and time** | Portable timestamps, calendar operations, date/time standard library |
| **1.0 — Language stabilization** | Complete specification, conformance suite, documentation, compatibility guarantees |

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

When no type is declared, WBasic may infer a type from a statically known initializer.

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

Constants must be initialized on declaration and cannot subsequently be reassigned.

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

This table describes operator families, not yet the complete precedence ordering. The 0.10 specification must formally establish associativity, especially for exponentiation, unary negation, and Boolean XOR.

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

Integer division, exponentiation, negative remainder rules, and promotion between Integer and Float require exact conformance tests before SEWN 0.10 is finalized.

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

For objects, TypeOf identifies the object's public Wydgit type rather than exposing host-language constructors.

The precise rules for dynamically deserialized JSON numbers, especially distinguishing Integer from Float, must be finalized in the numeric type specification.

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

The loop variable's scope and whether it remains accessible after NEXT must be specified consistently with existing FOR EACH scoping rules.

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

Initially, array indexing will be read-only. Controlled indexed updates may be introduced after copy/mutation semantics are defined.

## 10.3 Collection operations

Proposed canonical functions:

| Function | Description |
|---|---|
| `Length(collection)` | Number of elements |
| `Contains(collection, value)` | Whether an element exists |
| `IndexOf(collection, value)` | Index of first matching value |
| `Slice(collection, start, length)` | Extract a range |
| `Join(collection, separator)` | Join strings |
| `Split(text, separator)` | Split text into an Array |

Operations must define type constraints, comparison behavior, allocation limits, and whether results are copies.

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

The exact Unicode case-conversion and whitespace rules must be defined for cross-runtime conformance.

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

The math specification must define edge cases involving overflow, negative zero, rounding ties, and nonfinite results.

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

The primitive conversion matrix must specify which operations are supported. `Convert` does not imply that every Scalar can be transformed into every other Scalar.

## 13.2 Legacy CStr and Val

Traditional aliases will be provided by the WBasic compatibility library.

```vb
FUNCTION CStr(value AS Scalar) AS String
    RETURN Convert(value, String)
END FUNCTION

FUNCTION Val(value AS Scalar) AS Number
    RETURN Convert(value, Number)
END FUNCTION
```

These illustrate the intended library contract.

Existing `CStr()` and `Val()` behavior from SEWN 0.7 must be preserved, including strict numeric parsing.

Migration to the compatibility library is planned for SEWN 0.14, once standard-library linking exists.

Previously compiled SEWN 0.7 programs remain executable.

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

# 18. Standard-library modules

**Introduced: SEWN 0.14**

WBasic supports trusted, versioned standard-library source modules.

The initial standard library will contain compatibility wrappers mapping historical BASIC operations to canonical SEWN operations.

Proposed module:

```text
stdlib/
    wb/
        compat.bas
```

Example:

```vb
FUNCTION Mid(value AS String, start AS Integer, count AS Integer) AS String
    RETURN Substring(value, start - 1, count)
END FUNCTION

FUNCTION Len(value AS String) AS Integer
    RETURN Length(value)
END FUNCTION

FUNCTION UCase(value AS String) AS String
    RETURN ToUpper(value)
END FUNCTION
```

Each wrapper must implement its documented BASIC semantics, including edge cases, rather than merely resemble the original function.

## 18.1 Automatic linking

When source references a standard-library function, the compiler resolves and links the corresponding compiled procedure and its dependencies.

The runtime does not load source modules dynamically.

The compiler records or otherwise locks the compatibility-library version used to produce the compiled program.

User-defined procedures cannot silently override reserved canonical operations.

Collision rules for standard-library functions and application procedures must be explicitly documented.

## 18.2 Backward compatibility

At minimum, the initial compatibility library should include:

| Traditional BASIC | Canonical operation |
|---|---|
| `Mid` | `Substring` |
| `Left` | `Substring` |
| `Right` | `Substring` / `Length` |
| `Len` | `Length` |
| `UCase` | `ToUpper` |
| `LCase` | `ToLower` |
| `LTrim` | `TrimStart` |
| `RTrim` | `TrimEnd` |
| `InStr` | `IndexOf`, with indexing adjustment |
| `CStr` | `Convert(value, String)` |
| `Val` | `Convert(value, Number)` |
| `Sqr` | `Sqrt` |
| `Int` | `Floor` |
| `Fix` | `Truncate` |
| `Sgn` | `Sign` |

Additional traditional operations may be provided when their behavior can be implemented without violating SEWN safety guarantees.

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

Compatibility wrappers belong to the relevant source-language standard library.

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
| Integer/Float literal inference and preservation | 0.10 |
| Arithmetic promotion, remainder and rounding rules | 0.10 |
| Whether legacy Number remains concrete or becomes a contract | 0.10–0.11 |
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