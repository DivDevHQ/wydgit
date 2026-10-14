# WBasic / SEWN 0.14 — Static Wydgits and library resolution

Implemented on `develop/0.3`. The new execution contract is `sewn/0.14`.
Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2 remain unchanged, as in
0.11–0.13; no npm dependencies or lockfile changes are needed.

## Dedicated static prototypes and authoring

Static libraries use the ordinary PrototypeRegistry, publisher-qualified identity,
compiled behavior and methodRules. A dedicated prototype declares:

```json
{
  "id": "acme/text-utilities",
  "publisher": "acme",
  "static": true,
  "alias": "TextUtilities",
  "version": "1.0.0",
  "dependencies": {},
  "properties": {},
  "slots": {},
  "methodRules": { "helper": { "access": "private" } }
}
```

The example omits the required compiled behavior for readability. Trusted authoring
uses `compilePrototype(source, {static:true, libraries, dependencies})`, or
`compileDefinitions(definitions, buildOptions)` with behaviorSource. Source uses
ordinary typed FUNCTION/SUB declarations. Static-ness and visibility are metadata;
PUBLIC/PRIVATE/STATIC source modifiers are deliberately not a second declaration
system. Method-rule keys use canonical compiled lowercase names. The default is
public; only public/private visibility is supported. Existing requires capability
rules are preserved and checked on every linked call, including private helpers.

Static prototypes have no inheritance, overrides, instance properties, slots,
actions, presentation, friends, protected access or persistent variables. Unknown
static metadata fails closed. Neither hydration nor NEW can instantiate one.
PrototypeRegistry's instance method API rejects static invocation; invocation
requires a resolved build-time procedure. Static modules contain procedures only,
without EVENT or top-level executable bodies. Me is forbidden throughout static
behavior, including unreachable helpers. Ordinary local DIM/CONST values live in
fresh procedure frames and cannot retain cross-request state.

## Explicit imports and resolution

```vb
WITH LIBRARY divdev/wbasic
WITH LIBRARY acme/text-utilities

DIM result AS String = Mid("Goober", 2, 3)
DIM qualified AS String = WBasic.Mid("Goober", 2, 3)
RETURN TextUtilities.Echo(result)
```

Imports precede all statements or module declarations. They are not object WITH
blocks and have no runtime effect. Canonical IDs retain the existing lowercase,
publisher-qualified package/prototype grammar. Mixed-case package spellings are
rejected; no platform-wide normalization or ownership change is necessary. Aliases
retain declared presentation casing, with case-insensitive WBasic matching. An
alias belongs to the explicitly imported identity, never to installation order.
Duplicate imports, conflicting aliases, reserved aliases and local alias collisions
fail. A publisher declaring WBasic as an alias cannot replace divdev/wbasic's
identity; importing both produces an alias error.

Reserved canonical operations retain intrinsic lookup and cannot be redefined by
libraries. For other calls, local procedures precede explicitly imported public
exports. Multiple candidates produce LIBRARY.AMBIGUOUS; qualification selects the
specified library. Qualified private or unknown exports produce LIBRARY.PRIVATE
or LIBRARY.EXPORT. SUB calls use `CALL Alias.Name(args)` or `CALL Name(args)`;
FUNCTION calls are expressions. Kind, arity and known parameter/result contracts
are checked at compilation; dynamic contracts are checked in the shared executor.

No library is implicitly imported. Mid/Len/InStr/UCase/LCase without an import
are errors. Programs using only canonical operations need no library context.
The only retained source compatibility exception is legacy unimported CStr/Val.

## Authorized build contexts, dependencies and installation

`StaticLibraryRegistry(definitions, {verifiedPrototypes})` reuses existing
PrototypeRegistry verification bindings. The host must independently establish
publisher approval/verification; package-supplied mappings are not evidence.
`resolve(id, exactVersion)` rejects unavailable, nonstatic, unverified or mismatched
libraries. The catalog permits at most 64 definitions. A trusted compiler call
supplies `{libraries, dependencies:{"divdev/wbasic":"1.0.0"}}`; dependency pins are
an explicit authorized build context, not an instruction to acquire packages.

Static prototype dependencies are exact version maps. Compile dependent libraries
against previously approved definitions, then place the resulting definitions in
the build registry. All declared and embedded transitive dependencies must also
be approved and exactly pinned. Missing dependencies, conflicting versions and
package cycles fail before execution. Procedure recursion is distinct: 0.14 allows
recursive procedure calls under ordinary depth/count/step limits. Prior wire
schemas and existing instance prototype cycle checks retain their older rules.

`installStaticLibraryDirectory(directory, {verifiedPackages, installed})` safely
reads the bounded prototypes.json artifact, using the existing
`wydgit.prototype-package/0.1` envelope. It checks package identity/version,
namespace ownership, dedicated static metadata and executable validation. Existing
safeRead path/symlink/resource checks apply. The host supplies the same explicit
verifiedPackages approval mapping used in existing development repository setup.
Optional installed entries must be original, previously accepted installation
results. The result contains a frozen build registry and definitions; installation
is in the authorized build context, without creating an App instance or adding
capabilities. Availability never supplies an import. Existing cryptographic browser
package verification remains unchanged; this directory function does not verify a
signature or claim that local publisher approval authenticates public distribution.

Existing `wydgit-package/0.1` application manifests may optionally declare
`staticLibraries`, a map of at most 16 exact dependency versions. The ordinary
application installer accepts an approved StaticLibraryRegistry through its
`staticLibraries` host option. It resolves every requested pin, compiles prototype
sources and event sources at installation, and saves canonical definitions plus
compiledSources in the accepted catalog/receipt. Activation validates the stored
workflows and checks linked versions against the manifest. It does not relink or
require a resolver. Catalog/receipt equality and existing resource hashes remain
authoritative. Older application packages keep their established source workflow.
There is no new CLI, archive format, registry, downloader or signing infrastructure.

## Linking and the closed SEWN contract

Linking walks the referenced procedure-call closure, assigns deterministic private
wire names, rewrites known calls and embeds only needed procedures. Recursive
procedures reserve their target before traversing bodies. Local names cannot collide
with generated names. Private helpers are included transitively; unrelated public
procedures are excluded. Canonical operations already belong to the executor and
need no embedded library. Prelinked dependency exports are resolved again against
the approved canonical dependency definition, rather than trusting a library's
embedded claim about another publisher's implementation or private visibility.

The artifact is ordinary 0.13 procedure/statement/expression grammar plus the closed
0.14 envelope field `libraries`. No new execution operation or runtime name lookup
is introduced. A provenance entry has exactly:

```json
{
  "id": "divdev/wbasic",
  "version": "1.0.0",
  "alias": "WBasic",
  "methods": {
    "lib0": { "name": "mid", "access": "public", "requires": [] }
  }
}
```

methods maps linked procedure IDs to declaring method metadata. IDs/versions,
fields, capability syntax, uniqueness and procedure existence are validated.
Private calls are allowed only from linked procedures of the same canonical
library. Workflow/local/foreign calls cannot address private helpers. Me in any
linked procedure fails wire validation. Earlier schemas reject libraries and do
not gain recursive call acceptance. Linked provenance is descriptive; it never
constitutes SEAM authorization or independently authenticates artifact bytes.

Already compiled artifacts contain their resolved implementation and exact
versions; later catalog upgrades cannot change them. Recompilation is explicit.
Reproducibility covers the same source, dependency definitions and host pins; it
does not promise future Unicode-table equivalence between different host versions.
Dead-code elimination targets static procedures; ordinary local module procedures
retain existing whole-module compilation. Event modules share the linked closure
of their declared procedures/events rather than optimizing each event separately.

## Caller authority, resource budgets and isolation

All procedures execute through the existing portable SEWN executor. Linked frames
clear instance receiver and declaring-class access while retaining the caller's
exact ExecutionContext and scoped references. Even when an instance method passes
Me explicitly, the library cannot inherit the instance's private-property access.
Explicit Wydgit parameters can use only the caller's authorized public/member
interfaces. No publisher, installation, administrative or storage rights are added.
Service operations retain ordinary host-issued scoped facades and SEAM checks.

Steps, calls, recursion depth, loop iterations, live variables, service calls,
expression/nesting/value/string limits and the deadline belong to the whole
execution. Calls do not replenish any counter. Existing hard maxima and context
reductions remain authoritative. Public/private requires gates consume the same
context. TYPE failures retain structured recovery; denials and LIMIT failures do
not become recoverable authority or refreshed budgets. No host evaluation,
reflection, arbitrary service callback, filesystem, DOM or SQL access is added.

## divdev/wbasic 1.0.0

The ordinary source library and compiled prototype package live in libraries/wbasic.
Its publisher and alias have no compiler-specific resolution privileges.

| Function | Contract and behavior |
| --- | --- |
| Mid(String, Integer, Integer) → String | One-based start >= 1, nonnegative count; count clamps to remaining text, start beyond text returns empty. Invalid start/count fails TYPE. |
| Len(String) → Integer | Canonical UTF-16 length. |
| InStr(String, String) → Integer | One-based first position, 0 if absent; empty search yields 1. |
| UCase(String) → String | Canonical ToUpper. |
| LCase(String) → String | Canonical ToLower. |
| CStr(Scalar) → String | Canonical Convert; True/False, numeric shortest formatting, String identity, DateTime UTC formatting. |
| Val(Scalar) → Number | Canonical Convert; finite Number identity or strict full decimal String parsing; invalid Scalar kinds fail TYPE. |

Imported Val rejects whitespace, partial text, hexadecimal, nonfinite/unsafe numeric
strings and nonzero underflow according to 0.12. Legacy unimported Val continues
accepting surrounding ASCII whitespace and its historical finite Number parsing;
for example Val(" 12 ") is 12 without an import and TYPE with this library import.
Imported CStr adds DateTime conversion; legacy CStr rejects DateTime. Shared
primitive String/Boolean/finite Number behavior is unchanged. Existing compiled
legacy convert instructions retain their original behavior under all supported
schemas. Regression fixtures compare these differences explicitly. No wholesale
implicit library or replacement conversion grammar is introduced.

## WydClient deployment and compatibility

Build-time event preparation is separated from `events/runtime.js`. WydClient
mounting accepts validated workflows (or the existing trusted host bridge), not
WBasic source. Tests compile source before mounting. The served browser dependency
closure includes the portable dispatcher, validator and executor; parser/compiler,
static resolver, package installer and server providers are unavailable on runtime
routes. The alpha.2 bootstrap remains independently small and has no compiler.
An independently browser-bundled executor also runs serialized linked wire and
rejects reduced call budgets. The full client dependency graph is tested for
compiler/resolver absence, along with native Change cancellation and limits.

Compatibility coverage retains archived Guestbook sources at
bc3d2bf5162615215bd5a54bf7756883155086f5 and pre-Codex Taskboard sources at
6e9ce28b32702263f23baa8283103559f5f1ff66 (0.4.0-alpha.14). These supplement current
Guestbook installation/HTTP/storage and Taskboard language tests; they do not claim
archived full-host replay. Historical instance methods/inheritance, 0.12 operations,
0.13 collections/loops, numeric/typed values, signed browser packages and SEAM tests
remain in the full suite.

## Verification and deferred work

Executed results and final artifact measurements are recorded below after checks.
The focused suite covers standard/third-party calls, SUBs, private helpers, explicit
imports, alias/export ambiguity, local precedence, dependency/version/trust errors,
transitive canonical resolution, deterministic linking, upgrade isolation,
recursion/shared limits, malformed wire/metadata, host/Me/state rejection,
capability/storage denial, instance private-access isolation, application snapshot
installation, WydClient cancellation and browser-only wire execution.

Deferred: mixed prototypes, static inheritance/fields/constants, overloads,
service facades, dynamic imports/reflection, language additions after 0.14,
.wydpkg ZIP, CLI, registry, new signing/trust protocols and automated acquisition.
Only exact pins and one version per canonical library are supported; semver ranges
and multiple simultaneous versions are intentionally deferred. Development-library
installation is an in-memory build context; application snapshot installation uses
the existing persistent catalog. Published signed-distribution workflows remain
subject to their existing host verification mechanism and future architecture.

## Executed verification

- Focused static conformance: 15 test groups passed, 0 failed.
- Required full `npm test`: 648 passed, 0 failed, including Guestbook,
  archived Guestbook/Taskboard source fixtures, instance inheritance, installed
  packages, signed browser packages and SEAM/security regressions.
- Required `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- `git diff --check`: clean. Branch, status, final diff and generated artifacts
  reviewed before the authorized milestone commit and push.

The initial sandboxed full test run could not complete socket regressions. Full
verification uses the approved unrestricted test command. An intermediate run
identified browser tests still passing source directly to mountClient; those
fixtures now prepare source at build/setup time and retain their assertions.

Alpha.2 bootstrap: 44,493 bytes minified, 15,137 gzip, 13,387 Brotli. Relative to
0.13 (41,570 / 14,323 / 12,646), increases are 2,923 / 814 / 741 bytes, for closed
static metadata/provenance validation. Historical alpha.1 artifacts are unchanged.
An equivalent browser-targeted esbuild bundle of the actual mountClient entry
(es2022, ESM, minified) changes from 86,792 / 29,316 / 25,999 bytes to
57,187 / 19,981 / 17,906: reductions of 29,605 / 9,335 / 8,093 bytes. This runtime
measurement includes the dispatcher/executor dependency closure and excludes the
compiler/resolver; it is separate from the distributed bootstrap measurement.
