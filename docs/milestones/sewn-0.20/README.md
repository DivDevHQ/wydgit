# WBasic / SEWN 0.20 — implementation in progress

**The 0.20 work order is not complete.** This checkpoint implements source-authored
package composition, server presentation and trusted family builds. It does not
implement typed event delivery, symbolic runtime child references, instance
lifecycle execution, dynamic typed child repeaters or the required Taskboard
acceptance application. Those are remaining server work, not browser deferrals.

Canonical JSON remains authoritative; SEWN executes behavior; SEAM owns authority.
No runtime, registry, installer, dispatcher or rendering model is replaced.

## Supported grammar and complete sample

Existing 0.19 programs and APIs retain their results. New constructs are:

- `CHILD Name AS "publisher/prototype" INTO ExactSlot`, literal `PROPERTY Name = value`
  initializers, then `END CHILD`.
- `SLOT ExactSlot`, ordered CHILD declarations without INTO, then `END SLOT`.
  This selects an inherited canonical slot; it does not declare a new slot contract.
- `PRESENTATION SERVER`, scalar `HEADING value` / `CONTENT value`, then
  `END PRESENTATION`. Values are scalar literals or known `Me.Property` references.
- Within presentation, `REPEAT Item IN [scalar literals] LIMIT 256` and `END REPEAT`.
  Repetition emits existing bounded presentation `each`; it creates no instances.
  Only nonempty homogeneous String/Number/Boolean literal arrays are currently
  accepted. Dynamic arrays, typed record templates and arbitrary expressions fail.

```vb
PUBLIC CLASS StatusCard EXTENDS wydgit.core/block
    META Id = "divdev/source-card"
    PUBLIC PROPERTY content AS Object = {"type":"markdown","value":""}
    PUBLIC PROPERTY Title AS String = "Ready"
    PUBLIC PROPERTY Status AS String = "Pending"

    PUBLIC SUB Complete()
        Me.Status = "Complete"
    END SUB

    PRESENTATION SERVER
        HEADING Me.Title
        CONTENT Me.Status
        REPEAT Item IN ["Source authored", "Canonical JSON"] LIMIT 256
            CONTENT Item
        END REPEAT
    END PRESENTATION
END CLASS
```

The executable [example family](../../../examples/source-components/card.bas) adds
an ordered [Section container](../../../examples/source-components/panel.bas).
Literal Markdown remains the canonical `content` property; it is sanitized by the
existing Wydgine Markdown renderer. Presentation CONTENT means escaped scalar text,
not Markdown, HTML, a slot or executable source. H2 Markdown stays literal text.

Existing `format` and `skin` properties remain authorable with PROPERTY declarations
or child initializers. The compiler adds no CSS, stylesheet, selector or skin
registry. Actual skin resource approval and rendering remain host responsibilities.
The fixed H2 format vocabulary is not a claim that server presentation and H2
implement equivalent styling or rendering.

## Build and install without prototype JSON

One source file still defines one class. `compileFamily` consumes an explicit
file-to-source map and trusted 0.19 build options plus an entry descriptor:

```js
import {compileFamily} from './wydgine/wydbasic/index.js';
const result = compileFamily({'card.bas': cardSource, 'panel.bas': panelSource}, {
  manifest, verifiedPackages, definitions, registryOptions,
  entry: {type: 'divdev/source-panel', id: 'source-panel'}
});
```

`manifest` is the existing `wydgit-package/0.1` manifest. `verifiedPackages` is
independent host approval; source and package metadata cannot supply authentication.
Dependencies are an explicit approved canonical snapshot. There are no downloads.
Classes resolve parent, interface and child dependencies in deterministic order;
unknown dependencies, cycles, duplicates and namespace disagreement fail before
returning any output. Linked libraries and interfaces retain exact manifest pins.
Foreign child composition is rejected: this installer's Section templates require
package-owned prototype instances and have no ordinary foreign-component approval
surface. Parent inheritance retains existing official/same-publisher rules.

The result contains `manifest`, dependency-ordered `definitions`, canonical
`template` and `resources`, keyed by the existing manifest resource paths. Write
those resources to a staged package directory, together with the existing manifest
and any separately supplied workflow resources. There is no new package format.
The [trusted build helper](../../../examples/source-components/build.mjs) accepts
host approval and an output directory; it reads these two example source files.
Compilation is atomic; filesystem publication is the embedding host's responsibility.

Use the existing `planPackageInstall` / `applyPackageInstall` API with owner approvals,
placement and a trusted installation context. The installer still validates resource
sizes, namespace, complete containment, grants and receipts; startup reloads stored
canonical artifacts without source compilation. Run:

```sh
node --test --test-isolation=none test/wbasic-families.test.js
```

This test builds, installs and reloads the family in a temporary application;
constructs its complete tree; executes Complete under a caller context; and verifies
escaped rendering before and after the state change. It also executes the independent
JSON/SEWN golden fixture. No production database is needed.

## Shared IR and generated artifacts

Old classes use `wydgit.definition/0.19` unchanged. New declarations select
`wydgit.definition/0.20`; the canonical `definition` may contain existing presentation,
and optional build-only `composition` holds ordered
`{name,type,slot,properties}` records. `type` avoids reserved JSON prototype keys.
`lowerDefinition` returns `composition` only for the deliberately versioned new IR.
`lowerFamily` is language-independent and accepts IRs from any future frontend.
Neither lowerer depends on WBasic AST nodes. Composition is not a new prototype
field; it produces the existing package instance template.

Generated presentation:

```json
{"schema":"wydgit.presentation/0.1","template":{"tag":"section","children":[{"tag":"h2","text":{"get":"properties.Title"}}]}}
```

Generated method body uses existing sewn/0.5, with no new executable wire schema:

```json
{"op":"memberSet","target":{"op":"context","name":"ME"},"name":"Status","value":{"op":"literal","value":"Complete"},"exact":true}
```

A child becomes a canonical envelope, with deterministic build-assigned identity:

```json
{"schema":"wydgit/0.2","id":"source-panel-First","prototype":"divdev/source-card","properties":{"Title":"First task","Status":"Pending","content":{"type":"markdown","value":""},"anchors":[],"format":{},"order":0,"position":"main"},"slots":{"children":[]},"provenance":{}}
```

## Composition and binding semantics

Child names are case-insensitively unique and cannot collide with ordinary members.
Slots and property initializer names preserve exact canonical identities. Ordering
is source order per slot; inherited children precede newly declared children.
Inherited child names cannot be redeclared. Known child prototype, public initializer,
type, enum, required-value, acceptance and maximum-cardinality checks occur in the
shared lowerer. Whole-family expansion additionally checks minimum cardinality,
acyclic composition, identity collisions, Form contracts, and installer node/depth/
resource bounds (256 nodes, depth 32, 64 KiB per generated resource).

Compilation retains no live instances or runtime references. These names/IDs are
not credentials. Arbitrary NEW does not expand build-only composition. Runtime
`Me.Child` lookup is still unsupported; the package template is the supported
construction path at this checkpoint. Existing canonical complete-tree hydration
and installation validate the generated tree again.

Presentation binding is one-way and evaluated on each existing server render.
Only public discoverable properties without capability requirements may bind.
Exact bracket spelling works. Object/Array-to-text coercion, arbitrary functions,
restricted/private values and unsupported client targets fail compilation.
Canonical values remain declarative; no JavaScript callback or source evaluator
is emitted. There is no update propagation graph, so there are no binding cycles
or two-way updates. A later render reads the supplied current projection; it does
not automatically schedule a render. Existing renderer bounds and error behavior
remain in force. Service-backed data-source authoring is still missing.

## Events, lifecycle and remaining completion gates

0.19's typed EVENT declarations and five isolated hook modules still compile.
RAISE EVENT remains rejected, hook modules remain unreachable as ordinary methods,
and the existing Page/Server/Session dispatcher is unchanged. There is no new
instance state machine, hook invocation policy, subscription lifecycle, shared
handler SEWN budget or declaration-authenticated emitter in this checkpoint.
Do not use this example as proof of those required behaviors.

Remaining 0.20 gates:

- Authenticated symbolic child references with visibility, ownership and lifetime checks.
- Typed templates and dynamic bounded child repetition, key/update/disposal rules.
- Data-provider and approved service bindings.
- Shared step/time/construction/service budgets across the existing event chain.
- Declared custom emission and child/host subscriptions using actual event contracts.
- Trusted server Init/Preload/Render/Unload/Dispose controller and cancellation/cleanup tests.
- Complete Taskboard family and independent full-family golden equivalence.
- Portable validated browser artifacts and the executable conformance handoff.

These are unfinished implementation, not claimed incompatibilities with the
canonical design. Supported server presentation is explicitly server-only; client
packages fail instead of discarding it. No WydClient artifact/version changes are
required for this build-only checkpoint. The [verification matrix](verification.md)
and [browser handoff](wydclient-handoff.md) distinguish actual evidence from future work.
