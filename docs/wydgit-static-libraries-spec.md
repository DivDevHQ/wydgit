# Wydgit Static Libraries Specification

**Status:** Proposed Architecture — Not Yet Implemented  
**Repository path:** `docs/wydgit-static-libraries-spec.md`  
**Applies to:** Wydgit Object Model, SEWN, SEAM, WBasic, Wydgine, WydClient, Package Toolchain, DivDev Studio

## 1. Purpose

Wydgit shall support **static Wydgits**: reusable Wydgit prototypes that expose public functions and procedures without requiring object instantiation.

Static Wydgits provide a common library mechanism for:

- WBasic standard and compatibility functions.
- Third-party utility libraries.
- Application-specific shared functions.
- Convenient interfaces to canonical Wydgit services.
- Reusable business logic.
- Future Wython and Wuby standard libraries.

The goal is to avoid maintaining a separate language-specific library mechanism when Wydgit's existing prototype and package architectures can provide the required functionality.

**Core principle: A static Wydgit is a reusable library of executable behavior, not a shared application instance.**

## 2. Architectural principles

1. Static Wydgits participate in Wydgit's existing package identity, publisher identity, versioning, dependency, and trust systems.
2. Static methods are callable without instantiating their declaring Wydgit.
3. Static methods compile into validated SEWN.
4. Static methods execute with the effective authority of the caller.
5. Static libraries do not automatically receive or confer additional SEAM capabilities.
6. Static library resolution occurs at compile/build time.
7. Executable dependencies are version-locked during compilation or packaging.
8. Browser deployment includes only the functionality required by the application.
9. Static libraries contain no shared mutable application state initially.
10. Static libraries must not bypass existing Wydgit visibility, publisher-boundary, or execution rules.

This specification introduces a general-purpose library facility, not a special exception exclusively for WBasic.

---

## 3. Static Wydgit identity

A static library is defined using the normal publisher-qualified Wydgit identity model.

The initial standard WBasic library is proposed as:

**Proposed identity (illustrative spelling):** `divdev/wbasic`

**Source-level alias:** `WBasic`

A source-level alias is convenient syntax, not a separate package identity. The source alias `WBasic` remains case-preserving. Canonical package-ID casing and normalization remain open design decisions; lowercase example IDs do not mandate a casing policy.

For example, after an explicit import:

```vb
WITH LIBRARY divdev/wbasic

DIM result AS String = WBasic.Mid("Goober", 2, 3)
```

The compiler resolves `WBasic` to the registered static library `divdev/wbasic`.

Aliases must be unique within their applicable compilation scope.

A library publisher cannot override another publisher's canonical identity simply by declaring a matching alias.

Package IDs, publisher identities, prototype identities, and source aliases remain distinct concepts.

---

## 4. Static method declarations

A static Wydgit may expose public functions and subroutines.

Illustrative proposed WBasic syntax:

```vb
PUBLIC STATIC FUNCTION Mid( _
    value AS String, _
    start AS Integer, _
    count AS Integer _
) AS String

    RETURN Substring(value, start - 1, count)

END FUNCTION
```

This syntax is illustrative and subject to WBasic grammar design.

The actual implementation may use prototype metadata rather than requiring `PUBLIC STATIC` in source.

For example, a package may declare that a particular prototype is static and that its functions are publicly exported.

### 4.1 Supported method categories

| Method kind | Purpose |
|---|---|
| Public static function | Returns a value |
| Public static subroutine | Performs an authorized operation |
| Private static function | Internal library helper |
| Private static subroutine | Internal library helper |

Private static methods remain callable only within their permitted declaring library scope.

Public visibility does not imply authorization to access protected resources.

### 4.2 Static invocation

Explicitly qualified invocation still requires an import:

```vb
WITH LIBRARY divdev/wbasic

DIM result = WBasic.Mid("Goober", 2, 3)
```

A static method invocation must not require:

```vb
DIM library AS Wydgit
SET library = NEW "divdev/wbasic"(...)
```

Static methods are resolved using library metadata and compiled method definitions.

### 4.3 Static versus instance methods

Static and instance methods must have distinct invocation rules.

A static method:

- Does not require an object instance.
- Has no implicit `Me` reference.
- Cannot access instance properties without an explicit authorized reference.
- Cannot implicitly modify application state.
- May call other permitted static methods.
- May invoke canonical services subject to SEAM.

An ordinary instance method retains the existing Wydgit object and invocation semantics.

The runtime must reject attempts to invoke an instance method without a valid instance reference.

---

## 5. Explicit Standard Library Imports

The canonical WBasic utility and compatibility library is a standard static Wydgit distributed with the Wydgit platform.

Its proposed identity uses the illustrative spelling (casing and normalization remain unresolved):

`divdev/wbasic`

It provides public static methods implementing familiar BASIC functions and other reusable utilities.

**The WBasic compiler does not automatically import this library.**

Applications requiring its functionality must explicitly declare the dependency using the same import mechanism available to third-party static libraries.

No publisher or library receives special name-resolution privileges merely because it ships with Wydgit.

### 5.1 Explicit import declaration

A WBasic source module may declare:

```vb
WITH LIBRARY divdev/wbasic
```

This declaration must appear at module scope before executable statements.

It makes the library's public static exports available for unqualified calls within that module.

For example:

```vb
WITH LIBRARY divdev/wbasic

DIM result AS String = Mid("Goober", 2, 3)
```

The compiler resolves `Mid()` against the imported library's public static methods.

The equivalent explicitly qualified invocation is:

```vb
WITH LIBRARY divdev/wbasic

DIM result AS String = WBasic.Mid("Goober", 2, 3)
```

Both forms must resolve to the same versioned implementation.

The import does not instantiate the library or grant additional SEAM capabilities.

### 5.2 Resolution order

The proposed unqualified function-resolution order is:

1. Procedures defined in the current module.
2. Public static methods exported by explicitly imported libraries.
3. Compile-time error if no valid candidate exists.

Canonical compiler intrinsics and reserved operations are resolved according to their defined language rules and must not be silently overridden.

If multiple imported libraries expose the same unqualified function name, and no local procedure resolves the call, the compiler must report an ambiguity rather than arbitrarily selecting one.

An explicitly qualified call resolves against its designated library.

Local procedures may shadow nonreserved imported functions without changing the behavior of explicitly qualified calls.

### 5.3 No implicit library imports

No static library is automatically imported into WBasic source, including `divdev/wbasic`.

Installing a library makes it available for dependency resolution; it does not automatically expose its methods to every application.

A module that does not import `divdev/wbasic` may still use canonical language operations supported directly by its compiler and SEWN target.

For example:

```vb
DIM result AS String = Substring("Goober", 1, 3)
```

A module requiring the familiar BASIC `Mid()` function must import a library that exports it.

Third-party libraries follow precisely the same rules.

### 5.4 Installation versus import

Library installation and source-level import are separate operations.

The Wydgit distribution may install `divdev/wbasic` by default as a convenience for developers.

However:

- Installation establishes library availability.
- `WITH LIBRARY` declares source-level usage.
- Package dependencies establish the required library identity and compatible version.
- Compilation resolves and links referenced methods.
- SEAM determines which runtime operations are authorized.

The compiler must not treat a platform-installed library as implicitly imported.

### 5.5 Dependency declaration and reproducibility

A source-level `WITH LIBRARY` statement identifies a required static library but does not by itself authorize fetching arbitrary packages or selecting unrestricted versions.

The build system must resolve the import against approved package dependencies and produce a reproducible version-locked result.

Missing libraries, incompatible versions, or unapproved dependencies must produce explicit build errors.

A library update must not silently change the semantics of an already compiled application.

### 5.6 Language-independent library model

Although `divdev/wbasic` primarily provides BASIC-compatible functions, it is an ordinary static Wydgit.

Its compiled SEWN methods may also be referenced by future Wython, Wuby, or other supported compilers through their respective import syntax.

No dedicated WBasic library execution mechanism is required.

---

## 6. Static library imports

Applications may declare static-library dependencies.

Illustrative proposed source syntax:

```vb
WITH LIBRARY acme/TextUtilities
```

Then:

```vb
DIM result = NormalizeTitle("hello world")
```

Alternatively:

```vb
DIM result = TextUtilities.NormalizeTitle("hello world")
```

The final import grammar will be established in the implementing language milestone.

`WITH LIBRARY` is a proposed compile-time import directive, not the traditional BASIC `WITH object ... END WITH` statement.

### 6.1 Import requirements

Imports must resolve to:

- A known publisher-qualified library identity.
- An approved compatible library version.
- A declared public export.
- An unambiguous source-level alias.
- A dependency authorized under package policy.

Dynamic runtime imports are not introduced by this feature.

### 6.2 Name collisions

If two imported libraries expose the same unqualified name, the compiler must reject ambiguous usage.

For example, if both libraries provide `Normalize()`:

```vb
Normalize(value)
```

may be ambiguous.

Explicit qualification remains valid:

```vb
TextUtilities.Normalize(value)
```

No library may silently override another library's exports based on installation order.

---

## 7. Canonical SEWN representation

Static methods ultimately compile into SEWN procedures or equivalent validated executable definitions.

Static-library invocation must not introduce unrestricted dynamic invocation.

The compiler and linker must resolve the target library and method to a known validated implementation.

### 7.1 Library method identity

A resolved static call must be associated with:

- Canonical library identity.
- Resolved library version.
- Exported method identity.
- Validated parameter and return contracts.
- Required capabilities, if any.
- Compiled implementation or verified executable reference.

### 7.2 Compiled method linking

The build process should link only methods that the application actually references, plus their required dependencies.

For example:

```vb
WITH LIBRARY divdev/wbasic

DIM result = WBasic.Mid("Goober", 2, 3)
```

should not require embedding an entire WBasic standard library into the resulting client program.

The linker may determine that `Mid()` depends on canonical `Substring()` and include only the relevant wrapper.

Transitive dependencies must also be resolved.

### 7.3 Build-time and runtime separation

The source compiler and library linker are build-time components.

WydClient should execute precompiled, validated SEWN without bundling the WBasic parser, source compiler, or source-level library resolver.

Runtime linking may be supported in separately designed environments, but is not required by this specification.

---

## 8. Static libraries and canonical services

Static libraries may provide convenient, typed interfaces to Wydgit's existing canonical service APIs.

For example:

```vb
DIM records = WydStore.Query("tasks", "tasks", 8, 0)
```

This is proposed syntax.

The static `WydStore` interface may internally construct a valid service request and invoke the existing registered WydStore service.

Conceptually:

```vb
PUBLIC STATIC FUNCTION Query( _
    store AS String, _
    collection AS String, _
    limit AS Integer, _
    offset AS Integer _
) AS Object

    RETURN SERVICES.Invoke("wydstore", "1.0.0", "query", {
        "store": store,
        "collection": collection,
        "limit": limit,
        "offset": offset
    })

END FUNCTION
```

This is illustrative; canonical service versions and response contracts must be resolved from the actual implementation.

### 8.1 Service facades, not service replacements

A static Wydgit must not replace the canonical service implementation itself.

For example:

- WydStore retains responsibility for storage adapters, transactions, authorization, and persistence.
- WydSearch retains responsibility for its supported search service operations.
- WydFiles retains responsibility for authorized file operations.
- WydStream retains responsibility for media-related services.

Static Wydgits provide reusable application-facing interfaces over those services.

### 8.2 Authorization

Static methods run under the effective authority of their caller.

A trusted publisher's library must not confer the publisher's own installation or administrative permissions upon applications invoking it.

Every service call continues through the ordinary SEAM policy and runtime context.

A library may perform only operations that its caller is authorized to perform.

No privilege laundering is permitted through static methods.

---

## 9. Static state and execution isolation

The initial implementation shall not support shared mutable static variables.

For example:

```vb
PUBLIC STATIC counter AS Integer = 0
```

is not supported by this specification.

This avoids unresolved questions involving:

- Cross-request state.
- Cross-user state.
- Cross-site state.
- Multitenant hosting.
- Browser tab isolation.
- Concurrency.
- Lifecycle management.
- Persistence and synchronization.

Immutable constants may be introduced in a later stage.

Static procedures may still operate on explicitly passed data and invoke authorized services.

A library must not retain privileged object references between executions.

---

## 10. Object-model integration

Static Wydgits participate in the existing prototype and package ecosystem.

The implementation should reuse:

- Canonical publisher-qualified identities.
- Existing package manifests.
- Prototype validation.
- Method visibility contracts.
- SEWN compilation.
- Package dependencies.
- Publisher signing and trust.
- SEAM authorization.

### 10.1 Instantiation behavior

A purely static Wydgit must not require an instance.

Whether a prototype may contain both static and instance methods is deferred.

The initial implementation may restrict static libraries to dedicated static prototypes.

### 10.2 Inheritance

Static-method inheritance is not required initially.

If introduced later, it must have explicitly specified lookup, override, and visibility semantics.

Existing instance-level Wydgit inheritance must remain unchanged.

### 10.3 Private and protected methods

Static method visibility must respect the established publisher and declaring-type security boundaries.

A public static method must not provide implicit access to otherwise inaccessible private instance methods or private state.

---

## 11. Package and distribution integration

Static libraries are distributable Wydgit packages.

They follow the package architecture established by:

`docs/wydgit-package-distribution.md`

A published static library package must have appropriate:

- Package identity and version.
- Dependency declarations.
- README and LICENSE.
- Changelog where appropriate.
- Signed file inventory.
- Verified publisher signature.
- Declared capabilities and service dependencies.

### 11.1 Standard library deployment

`divdev/wbasic` is proposed as a standard static library distributed with supported Wydgit installations and development tooling.

Its installation does not imply automatic source-level import. Modules must explicitly declare `WITH LIBRARY divdev/wbasic` before using its exported methods.

Its version must be pinned or otherwise deterministically resolved during compilation or packaging.

A library update must not silently change already compiled application behavior.

### 11.2 Source distribution

Static-library packages may distribute compiled SEWN without embedding their original source files.

Source availability remains subject to the library's applicable license.

### 11.3 Publisher trust versus runtime authority

Publisher signing establishes provenance and integrity.

SEAM establishes runtime resource authority.

Neither substitutes for the other.

---

## 12. Compiler and linker behavior

The WBasic compiler must support static library metadata during name resolution.

The static library linker must:

1. Resolve library identity and version.
2. Resolve exported methods and validate visibility.
3. Validate argument and return types.
4. Detect ambiguous calls.
5. Resolve transitive static dependencies.
6. Detect unsupported dependency cycles.
7. Compile or retrieve verified SEWN implementations.
8. Include only required procedures where practical.
9. Produce a self-contained or explicitly dependency-locked executable artifact.
10. Preserve SEWN validation and resource limits.

The linker must not silently download and execute arbitrary third-party code during compilation.

Package dependency acquisition is a separately controlled operation.

### 12.1 Generic library functions

Static methods can accept WBasic's proposed type contracts.

For example:

```vb
PUBLIC STATIC FUNCTION CStr(value AS Scalar) AS String
    RETURN Convert(value, String)
END FUNCTION
```

This avoids requiring extensive function overloading.

Generic or contract-typed parameters must obey the ordinary WBasic/SEWN type system.

### 12.2 Intrinsic dependencies

Static library functions may use canonical SEWN intrinsics. Migration of the currently implemented SEWN 0.7 `CStr()` and `Val()` compiler intrinsics to explicitly imported wrappers is planned, not implemented; their existing conversion behavior must be preserved under the compatibility policy.

For instance, `Mid()` may call `Substring()`, and `CStr()` may call `Convert()`.

The compiler must distinguish reserved canonical intrinsics from library-defined methods.

A static library cannot redefine or bypass the semantics of a reserved intrinsic.

---

## 13. Resource limits

Static library execution consumes the invoking program's normal SEWN budgets.

This includes applicable limits on:

- Execution steps.
- Procedure calls.
- Call-stack depth.
- Expression depth.
- Memory/value allocation.
- Service calls.
- Runtime duration.
- Object construction.

Calling into a static library does not replenish or reset resource budgets.

A malicious or defective static library must not be able to evade SEWN limits through transitive calls.

---

## 14. Cross-language compatibility

Static Wydgit libraries are execution-model features, not WBasic-exclusive constructs.

Future compilers such as Wython and Wuby should be able to resolve and link the same public static methods using their own source-language conventions.

For example, WBasic might write:

```vb
WITH LIBRARY divdev/wbasic

WBasic.Mid("Goober", 2, 3)
```

Other language dialects may expose the same functionality through their explicit import syntax and qualified names. Source-language convenience must not make an installed library implicitly available.

All equivalent calls must ultimately follow the same SEWN method contract.

The static library's implementation should not be duplicated for each supported source language.

---

## 15. Testing and conformance

The implementing milestone must test:

### Static invocation
- Calling public static functions without instances.
- Calling public static subroutines.
- Argument and return type validation.
- Rejection of instance methods through static invocation.
- Rejection of unauthorized or private method access.

### Library resolution
- Explicit `WITH LIBRARY divdev/wbasic` imports.
- No implicit standard-library imports.
- Unqualified calls to imported public static functions.
- Explicitly qualified static calls.
- Explicit third-party library imports.
- Local-procedure precedence.
- Ambiguous imported symbols.
- Unknown libraries and methods.
- Missing import declarations.
- Version mismatches.
- Rejection of undeclared or unauthorized dependencies.

### Linking
- Single-method inclusion.
- Transitive dependencies.
- Cycle detection.
- Deterministic output.
- Library version pinning.
- Compiled SEWN validation.
- Browser-safe dependency selection.

### Security
- No SEAM capability escalation.
- No cross-package authority laundering.
- No access to hidden instance state.
- No shared mutable runtime state.
- Existing execution limits remain effective.

### Compatibility
- Existing WBasic procedure calls.
- Existing Wydgit instance methods.
- Existing canonical service calls.
- Existing compiled SEWN programs.
- Previously established Guestbook and Taskboard compatibility baselines.

Tests should remain descriptive and professional.

---

## 16. Implementation roadmap

This architecture should inform the following milestones.

### SEWN 0.11 — Core Type Contracts

Introduce Scalar, DataType, TypeOf, and DateTime.

Do not implement static library linking as part of 0.11.

### SEWN 0.12 — Canonical Operations

Introduce canonical Convert, string primitives, and math primitives.

These operations provide the functionality that static library wrappers will use.

### SEWN 0.13 — Collections and Numeric Loops

Introduce indexed collection access, collection utilities, and numeric FOR/NEXT.

### SEWN 0.14 — Static Wydgits and Library Resolution

Implement:

- Static prototype metadata.
- Public/private static methods.
- Static invocation without instantiation.
- Qualified library aliases.
- Explicit `WITH LIBRARY` imports.
- Uniform resolution for first-party and third-party static libraries.
- Compile-time library linking.
- Version-locked dependencies.
- Runtime budget and SEAM integration.
- Rejection of ambiguous or undeclared library references.

Establish `divdev/wbasic` as the first canonical static library, distributed with the platform but imported explicitly by modules that require its functionality.

No special implicit standard-library linking shall be introduced.

### Later milestones

Extend static-library support to additional canonical service facades and third-party library ecosystems.

Consider mixed static/instance prototypes and static inheritance only when justified by real application requirements.

These milestones are proposed planning targets, not claims of implementation.

---

## 17. Open design decisions

The following require resolution before implementation:

1. Exact static prototype metadata schema.
2. Whether STATIC/PUBLIC declarations belong in source or prototype metadata.
3. Final import syntax and alias declaration mechanism.
4. How source-level `WITH LIBRARY` declarations are reconciled with package dependency manifests and version constraints.
5. Whether library versioning is pinned at compilation, packaging, or both.
6. Whether linked methods are embedded directly in application SEWN or referenced through signed library artifacts.
7. How trusted static libraries interact with publisher namespaces.
8. Whether static functions can call instance methods on explicitly passed Wydgit references.
9. How library method signatures express Scalar, DataType, and future interface types.
10. Whether the initial implementation permits mixed static and instance methods in one prototype.
11. How the build system handles independent browser and server linking targets.
12. How library updates affect already installed packages.
13. Whether future immutable static constants require their own representation.
14. Specify canonical package-ID casing and whether IDs are case-sensitive or normalized. These remain open design decisions; no casing or normalization policy is mandated here. The source alias `WBasic` remains case-preserving.

None of these questions should be silently decided by incidental implementation behavior.

---

## 18. Acceptance criteria

The architecture is ready for initial implementation when:

1. The static prototype and method contracts are specified.
2. The linker can resolve and validate public static methods.
3. `divdev/wbasic` can supply ordinary reusable functions.
4. WBasic resolves standard-library functions only when the declaring module explicitly imports `divdev/wbasic` or another library exporting the requested function.
5. Third-party libraries require explicit dependencies and imports.
6. Static methods execute without instantiation.
7. All SEAM and SEWN protections remain enforced.
8. WydClient can execute linked static methods without requiring source compilers or complete unused libraries.
9. Existing instance-method behavior remains compatible.
10. Library dependencies and versions are reproducible.
11. The package build and signing architecture can distribute static libraries.
12. Documentation and tests distinguish implemented functionality from proposed future features.

---

## Architectural summary

**A static Wydgit is a first-class, reusable, versioned library of validated SEWN procedures.**

Its public functions and subroutines are callable without creating an object instance.

The WBasic standard library becomes an ordinary static Wydgit, rather than a special collection of compiler-defined wrappers.

Canonical services may expose convenient static facades while retaining their existing trusted implementations and SEAM enforcement.

The compiler resolves and links required library methods during build or packaging.

The execution runtime receives only the validated functionality needed by the application.

**One object model. One library mechanism. Multiple source languages. Shared SEWN execution.**

**End of draft specification.**
