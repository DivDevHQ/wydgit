# WBasic / SEWN 0.19 — Canonical class authoring foundation

Classes compile to ordinary prototype definitions and existing validated SEWN.
Canonical JSON remains authoritative. This stage implements class contracts,
metadata, properties, methods, abstract/virtual contracts, interfaces and typed
custom-event declarations. Lifecycle bodies compile but do not execute automatically.
Typed event emission is explicitly rejected pending runtime integration. This is
not complete Wydgit source authoring or completion of the 0.20 acceptance goal.

## Source and grammar

One UTF-8 `.bas` file contains one class. Explicit `WITH LIBRARY publisher/name`
imports precede it. Keywords and source identifiers are case-insensitive; canonical
prototype identities and JSON property spelling remain exact. The class name is a
source label, never an inferred publisher-qualified identity. Multiple classes,
nested declarations and top-level execution are rejected.

```vb
PUBLIC CLASS TaskCard EXTENDS wydgit.core/block
    META Id = "divdev/task-card"
    PUBLIC PROPERTY content AS Object = {"type":"markdown","value":""}
    PUBLIC PROPERTY Complete AS Boolean = FALSE
    PUBLIC REQUIRED PROPERTY Key AS String
    PRIVATE HIDDEN PROPERTY Cache AS Object = {}
    PUBLIC EVENT Changed(Complete AS Boolean)

    PUBLIC VIRTUAL FUNCTION IsComplete() AS Boolean
        RETURN Me.Complete
    END FUNCTION
    PUBLIC SUB SetComplete(value AS Boolean)
        Me.Complete = value
    END SUB
    PROTECTED OVERRIDE SUB Init()
        Me.[Cache] = {}
    END SUB
END CLASS
```

The executable [TaskCard fixture](../../../test/fixtures/classes/task-card.bas)
contains the supported component contract. Its custom event is a declaration;
SetComplete does not emit it. Hook bodies use exact brackets for hidden properties.

Grammar additions (modifiers are optional unless stated):

- `[PUBLIC|PRIVATE] [MUSTINHERIT] CLASS Name [EXTENDS qualified-id|"qualified-id"|Wydgit]`;
  close with `END CLASS`. Default class visibility is public. PRIVATE lowers to
  `public:false`, controlling existing official cross-publisher inheritance policy;
  it is not a new instance visibility or construction permission.
- `META Id|Publisher|Version = literal` and `IMPLEMENTS "publisher/interface-id"`.
- `[PUBLIC|PRIVATE|PROTECTED|FRIEND] [REQUIRED] [HIDDEN] PROPERTY Name AS Type [= literal] [ENUM [scalar literals]] [REQUIRES [capability strings]]`.
- Typed SUB/FUNCTION declarations use existing parameter and return grammar,
  optionally PUBLIC/PRIVATE/PROTECTED/FRIEND, HIDDEN and one of VIRTUAL/OVERRIDE/MUSTOVERRIDE.
  An optional `REQUIRES ["domain.resource.action"]` follows the return type/parameter list;
  capability requirements and hidden state cannot be weakened by overrides.
  Default method visibility is public. A MUSTOVERRIDE signature has no body or
  `END SUB`/`END FUNCTION`. Other methods retain their existing terminators.
- `[PUBLIC|PRIVATE|PROTECTED|FRIEND] EVENT Name(parameter AS Type, ...)` is a signature,
  with no body/END EVENT. Multiline parameter lists retain existing parser syntax.
- Exactly `PROTECTED OVERRIDE SUB Init|Preload|Render|Unload|Dispose()` declares a
  lifecycle hook, ending with `END SUB`.

Duplicate modifiers, conflicting access, invalid dispatch modifiers, duplicate names
and property/method/event collisions fail. Friend members retain canonical runtime
rules; source does not create friend grants or publisher verification.

## Universal root and inheritance

`Wydgit` is a reserved compiler-recognized abstract authoring contract. Every
ordinary prototype implicitly satisfies its identity/metadata and optional-hook
contract; no root package, registry entry, executable constructor, new capability
or migration is introduced. Explicit `EXTENDS Wydgit` equals omission. Redefining
CLASS Wydgit fails, and NEW cannot instantiate that nonqualified abstract contract.
Static libraries remain outside ordinary instance lifecycle semantics.

Choose an existing semantic parent when a class must fit Page/Section/Block slots.
EXTENDS otherwise resolves an exact ID in the trusted dependency definition
snapshot supplied to the build. Unknown parents, cycles, multiple inheritance,
nonpublic foreign parents and foreign ordinary publishers fail existing registry
validation. Official public parents retain their canonical identity. No parent
capability is inherited. JSON prototypes without the new metadata remain valid.

`methodContracts` adds closed signature/access/abstract/virtual metadata to the
canonical model. New class methods are nonvirtual by default; OVERRIDE requires
an inherited slot and a virtual contract when that parent declares one. Historical
JSON methods without explicit contracts retain existing overridability. Signatures
(kind, ordered parameter types and return type), access, hidden state and capability
requirements must remain compatible. Abstract contracts have no executable method.
Concrete classes must implement every inherited abstract contract. Abstract
prototypes remain unconstructible through existing hydration/draft checks.

Inherited executable methods retain their original declaring owner; overrides
execute as their own declaration. `Me.Method()` performs virtual dispatch.
Unqualified local procedure calls retain existing lexical module semantics.
No base-call syntax, overloading, dynamic member creation or prototype mutation is
added. Ordinary hidden lookup is denied; `Me.[ExactName]` retains canonical rules.

## Metadata and package resolution

The host supplies an existing validated `wydgit-package/0.1` application manifest,
independent `verifiedPackages` binding and approved canonical definitions. The
source cannot supply the trusted binding. A self-asserted publisher or a manifest
alone is insufficient. This API uses the existing server application manifest;
it does not add another package format, publisher registry or signing workflow.

| Field | Resolution |
| --- | --- |
| Id | Required `META Id` or explicit build `id`; both must agree. Prototype namespace must equal manifest publisher. Distinct from manifest package ID. |
| Publisher | Derived from validated manifest plus independent host verification. Optional META assertion must agree exactly. |
| Version | Package-only manifest version. Optional META assertion must agree exactly; omitted from ordinary prototype JSON. |
| Description / other META | Rejected: this manifest/prototype authoring contract has no supported field for them. |
| Interfaces / static dependencies | Exact manifest `interfaces` / `staticLibraries` pins and approved build catalogs; no download or runtime import. |
| Installation identity / instance ID | Assigned through existing trusted install/construction paths, never META. |

Id/Publisher/Version cannot be declared as ordinary class properties. Metadata is
compile-time data; no hook initializes or mutates it. No prototype or package
required field becomes optional. Parent snapshots use existing exact prototype
IDs and package installation resource snapshots; ordinary prototypes do not gain
a new per-prototype version field. Package signing/provenance grants no SEAM right.

## Types, methods and interfaces

Property types lower exactly: String→string, Number→number, Boolean→boolean,
Object→object, Array→array, Null→null. Number means finite JSON number, not safe
Integer. Object means JSON data, not a nominal reference. Integer, Float, DateTime,
Scalar, DataType, Wydgit and interface properties are rejected because their
stronger runtime contracts cannot be preserved by current property persistence.
No default is invented when an initializer is omitted. REQUIRED requires a value
at complete instance validation unless a valid explicit default supplies it.
ENUM supports matching scalar JSON literal values. REQUIRES lowers to the existing
capability requirement array; it grants nothing. Defaults are deterministic JSON literals (including arrays/objects and signed
numbers), never expressions or service calls. Private/protected/friend/hidden
properties retain generic serialization redaction and canonical access checks.

Methods retain all supported procedure types, including Integer/Float, branded
contracts and approved interface aliases. Known Me property and method contracts
are statically resolved and checked; dynamic JSON data and generic Wydgit
references retain existing runtime type checks. Interface implementation uses
exact manifest pins, independently verified definitions and canonical conformance.
Existing Cast/Implements identity and reference-view restrictions are unchanged.

Static libraries continue to use `compilePrototype(source,{static:true,...})`,
not CLASS. They have no implicit Me, lifecycle or mutable instance fields. Classes
may explicitly import approved static libraries. Linked procedures are not
registered as instance methods; library privacy, exact pins, caller authority and
shared budgets remain enforced by existing linking/execution.

## Canonical lifecycle contract and execution gap

Canonical `lifecycle` maps exact hook names to validated SEWN procedure modules.
Each contains an empty workflow body and a parameterless SUB named after the
hook in lowercase. It is separate from ordinary `behavior` and the method table.
Hooks inherit by name and a derived hook replaces its inherited body. Omission
means no application hook work. Hooks are not ordinary events or subscriptions.

No universal instance lifecycle controller exists in the current Wydgine/H2
execution paths. This milestone does not execute these modules, attach them as
JavaScript callbacks or pass H2 host adapters to source code. Ordinary method
calls and lexical calls cannot reach the stored hooks. Current browser bootstrap
rejects class contract fields and executable bodies; successful class compilation
does not imply H2 browser installation or executable browser lifecycle support.
Existing server Page/Server/Session events and H2 trusted removal/unmount continue
with their existing independent behavior.

The required future controller policy is explicit, but **not implemented or
verified as instance runtime behavior here**:

1. Trusted construction assigns immutable identity and validates initial state.
   Init runs once; failure leaves a terminal failed instance eligible only for cleanup.
2. Activation runs Preload, then Render. Preload failure/cancellation prevents
   activation/presentation; retry requires an explicit host decision without another Init.
3. Active Render may repeat under the same authority and bounded activation policy.
4. Unload deactivates an active instance before permanent Dispose; reactivation may
   rerun Preload. Disposal after partial initialization must still perform host cleanup.
5. Host teardown runs children before parents, invalidates subscriptions/references
   even when hooks throw, and makes double disposal idempotent. Cancellation must
   prevent later mutation or resurrection. Object removal during dispatch must stop
   subsequent delivery to the removed subtree.

Before enabling execution, tests must cover every transition above, init/preload
failure, cancellation, repeated render, cleanup exceptions, partial initialization,
ordering, double disposal and stale references. The current method dispatcher now
checks a bound adapter's live node before dispatch, supplementing existing lifetime
checks; this is not an instance disposal controller.

## Custom events and explicit delivery rejection

Canonical `events` maps names to closed `{access,params:[{name,type}]}` contracts.
The registry derives `eventOwners` from the declaring prototype, including inherited
events. Payload types are String, Number, Integer, Float, Boolean, Null, Object and
Array. Parameter names are unique case-insensitively. Events cannot collide with
members or lifecycle hook names; inherited events cannot be redeclared. No callbacks,
source-family claim, arbitrary event name facade or emission authority is stored.

`RAISE EVENT Changed(value)` resolves a declared name and checks arity and known
argument types, then fails with WYDBASIC.UNSUPPORTED for every current target.
Wrong names/types fail earlier with NAME/TYPE. Class `EVENT.Raise(...)` is also
rejected. No invalid class produces a partially accepted/publishable definition.
Cross-instance emission, handlers associated with declarations, subscriptions and
App/Server/Session/Page wiring are deferred to the shared runtime integration.
There is consequently no new custom-event fan-out or recursion path in this stage.

Existing dispatcher semantics remain registration-order sequential asynchronous
handler execution, bounded queued custom raises, scope/capability checks, cancellation,
error propagation, stale-target rejection and no implicit bubbling. Its separate
SEWN execution per handler cannot establish the required shared chain budgets.
0.20 must define authenticated declaration-bound source identity, access checks,
subscription lifetime, cancellation/error policy and one shared chain budget before
enabling class emission. New executable grammar must be closed and separately
versioned only when that representation is actually executable. No `sewn/0.19`
wire schema is introduced for inert declarations.

## API, shared IR and generated artifacts

```js
import {readFileSync,writeFileSync} from 'node:fs';
import {compileClass} from './wydgine/wydbasic/index.js';
const result = compileClass(readFileSync('task-card.bas','utf8'), {
  manifest,                 // existing validated application manifest input
  verifiedPackages,         // independent host approval, never source data
  definitions,              // approved canonical dependencies, already compiled
  registryOptions: {verifiedPrototypes},
  libraries                 // approved StaticLibraryRegistry, when imported
});
writeFileSync('prototypes.json', JSON.stringify([result.definition], null, 2));
```

Run such a trusted build script with Node 22.12+ (`node build-classes.mjs`). There
is no new CLI or implicit output directory. Use existing package `resources.prototypes`
to identify the generated JSON file, then the ordinary package installer/validators.
Source is not installed as an alternate executable format. Existing
compile/compileModule/compilePrototype/compileInterface/compileDefinitions result
shapes remain unchanged. Dependency definitions must already have behaviorSource
compiled with existing compileDefinitions; builds do not implicitly fetch or
compile an arbitrary dependency catalog.

`parseClass(source)` exposes the located frontend AST. `parseDefinition(source,options)`
produces frozen language-neutral `{schema:"wydgit.definition/0.19",definition,
metadata,locations}` IR. Methods/hooks are canonical validated SEWN, and locations
retain declaration/member/META positions without host paths. `lowerDefinition`
from `wydgine/definitions/index.js` validates trusted metadata, exact build pins and
the entire candidate registry before returning `{definition,manifest}`. Both IR
and output are JSON-safe, deterministic and frozen. The IR has no authority or
independent runtime registry. A future language can emit the same IR and use the
same lowerer, validators and executor. No speculative composition fields are accepted.

Example generated property/method fragments:

```json
{
  "id":"divdev/card","publisher":"divdev",
  "properties":{"Ready":{"type":"boolean","access":"public","default":false}},
  "methodRules":{"isready":{"access":"public"}},
  "methodContracts":{"isready":{"kind":"function","params":[],"returns":"Boolean","access":"public","abstract":false,"virtual":false}}
}
```

```json
{"schema":"sewn/0.5","body":[],"procedures":{"isready":{"kind":"function","params":[],"returns":"Boolean","body":[{"op":"return","value":{"op":"memberRead","target":{"op":"context","name":"ME"},"name":"Ready","exact":true}}]}}}
```

The complete compiler-independent [golden definition](../../../test/fixtures/classes/golden.json)
includes behavior and all declaration fields. Tests compare exact normalized JSON
and execute both versions. Ordinary source features select the existing minimum
wire schema (for example 0.5 members, 0.10 Integer methods, 0.17 interface references,
0.18 date operations); source milestone numbers do not select wire versions.

## Security and 0.20 handoff

Validation applies equally to hand-authored JSON and generated definitions. Closed
new metadata, safe JSON copying, prototype-pollution rejection, namespace/manifest
verification, canonical inheritance/access checks and validated SEWN remain the
boundary. No frontend privilege, native callback, host code, dynamic evaluation,
new SEAM capability or resource-budget reset is introduced. Generic exports do
not enumerate restricted properties. Explicit public method returns retain the
existing intentional disclosure contract, not an automatic information-flow system.

0.20 should extend the same IR/lowering boundary after establishing these contracts:

| Requirement | Existing representation / remaining work |
| --- | --- |
| Named children, typed initializers | Instance envelope IDs/prototype/properties already exist; add source declarations, static names and canonical complete-tree validation. |
| Named slots, ordered placement | Prototype slots already specify accepts/order/min/max; envelope slots contain ordered children. Add authoring and inherited slot checks. |
| References among children | Existing opaque runtime references cannot be serialized. Define build-time symbolic names and authenticated runtime resolution; never store handles in JSON. |
| Presentation, fixed hooks | Server `wydgit.presentation/0.1` is validated but HTML-oriented; H2 has restricted literal content and fixed format hooks. Decide portable lowering/target validation before adding source syntax. |
| Reusable templates, repeaters, bindings | Server presentation supports bounded each/get/service bindings; it is not a universal reactive binding model. Define typed, target-specific or portable contracts and budgets explicitly. |
| Typed custom subscriptions | Event declarations exist; declaration-bound emission, shared budgets, access, cancellation and subscription teardown are still required. |
| App/Server/Session/Page subscriptions | Existing trusted Server/Session/Page dispatcher registrations exist. App-wide source wiring and instance ownership/binding need explicit canonical contracts; custom events cannot impersonate these families. |
| Lifecycle composition | Hook modules exist; implement the controller/transition tests above and authenticated declaring-class execution, never the H2 host adapter as a source facade. |
| Complete installable family | Existing application manifest, canonical prototype arrays, templates, receipts and exact dependencies remain the package path. Add atomic multi-definition/tree lowering and package integration, without a parallel installer. |

No children, slots, presentation, bindings or subscription placeholder is emitted
by 0.19. The unresolved runtime pieces are prerequisites to the 0.20 goal of a
complete installable component authored without hand-written JSON/SEWN.
