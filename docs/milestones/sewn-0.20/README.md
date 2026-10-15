# WBasic / SEWN 0.20 — Complete server component authoring

0.20 extends the intermediate `04447a0` checkpoint with executable server composition,
typed templates, event wiring and trusted lifecycle execution. Canonical JSON defines
objects, SEWN defines behavior, SEAM grants authority, and the existing installer and
renderer consume the artifacts. Source language never grants privileges.

The supported execution target is **Wydgine server**. WydClient H2 rejects executable
component contracts. Alpha.5 is a validation/distribution update, not H3 execution.
See [verification](verification.md) and the [H3 contract](wydclient-handoff.md).

## Getting started

The complete [Taskboard family](../../../examples/wbasic-taskboard/) has six source
files, an existing package manifest and a trusted build helper. No prototype JSON or
SEWN is required from its author. The public entry composes a typed model, list and
navigation component; the list expands keyed task cards; navigation raises a typed
event; a private handler changes the model selection and rendered list.

A complete small source class can combine these declarations:

```vb
PUBLIC CLASS Panel EXTENDS wydgit.core/section
    META Id = "divdev/panel"
    PUBLIC PROPERTY Selected AS Number = 1
    CHILD Pager AS "divdev/task-navigation" INTO blocks
    END CHILD
    PRIVATE SUB OnPageChanged(PageNumber AS Integer)
        Me.Selected = PageNumber
    END SUB
    BIND EVENT Pager.PageChanged TO Me.OnPageChanged
    PUBLIC SUB SelectPage(PageNumber AS Integer)
        Me.Pager.GoToPage(PageNumber)
    END SUB
    PRESENTATION SERVER
        HEADING "Selected page"
        CONTENT Me.Selected
    END PRESENTATION
END CLASS
```

The navigation class declares `PUBLIC EVENT PageChanged(PageNumber AS Integer)`
and executes `RAISE EVENT PageChanged(NewPage)` from its public GoToPage method.
[TaskCard](../../../examples/wbasic-taskboard/task-card.bas) demonstrates literal
Markdown, public property bindings and all five hook bodies. The renderer escapes
scalar presentation text; Markdown uses the existing sanitized server path.

From the repository root, with Node 24 and installed dependencies:

```js
import {build} from './examples/wbasic-taskboard/build.mjs';
import {readFileSync} from 'node:fs';
import {compileDefinitions} from './wydgine/repository.js';
const result = await build({
  definitions: compileDefinitions(JSON.parse(readFileSync('prototypes/objects.json','utf8'))),
  verifiedPackages: {'divdev/wbasic-taskboard': 'divdev'}
});
```

`verifiedPackages` must come from independent trusted host approval, not source or
manifest claims. For a standalone build the tested canonical dependency snapshot is
`compileDefinitions(JSON.parse(readFileSync('prototypes/objects.json','utf8')))` from
`wydgine/repository.js`. The build API is pure and returns the existing manifest,
dependency-ordered definitions, entry instance template and resource-path/text map.
Stage `result.resources` and `manifest.json` in a package directory. Use the existing
`planPackageInstall` and `applyPackageInstall` APIs with independently approved
permissions, installation context and placement. [The executable installer
acceptance](../../../test/wbasic-taskboard.test.js) shows these exact steps in a
temporary application, reloads installed artifacts and executes a real Page request.

For example, the following **trusted local operator script** stages this reviewed
example, installs it at the end of the existing `home` Page and starts the host.
Run it from the repository root in a disposable site checkout. The independent
publisher map and approvals here are site-owner choices, not package authentication.
It uses the `result` from the build above:

```js
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadRepository} from './wydgine/repository.js';
import {ExecutionContext} from './wydgine/seam/context.js';
import {planPackageInstall,applyPackageInstall} from './wydgine/packages/index.js';
import {createHostApp} from './app.js';
const root = process.cwd(), packagePath = '/tmp/wbasic-taskboard-package';
const verifiedPackages = {'divdev/wbasic-taskboard':'divdev'};
await mkdir(packagePath, {recursive:true});
await writeFile(path.join(packagePath,'manifest.json'), JSON.stringify(result.manifest));
for (const [file,text] of Object.entries(result.resources))
  await writeFile(path.join(packagePath,file), text);
const site = loadRepository(root, {verifiedPackages});
const placement = {page:'home',parent:'home',slot:'sections',
  index:site.runtime.get('home').slots.sections.length};
const grants = ['home',...site.runtime.get('home').slots.sections,
  'taskboard','taskboard-*'];
const plan = await planPackageInstall({root,packagePath,placement,verifiedPackages,
  approvals:result.manifest.permissions,storageMappings:{},
  installationContext:new ExecutionContext({publisher:'operator',self:'home',
    app:site.runtime.rootId,visible:grants,editable:grants,
    capabilities:['object.instances.edit']})});
await applyPackageInstall(plan);
const app = await createHostApp({root,execution:{verifiedPackages}});
app.listen(3000,'127.0.0.1');
```

`execution.verifiedPackages` is carried through startup, renderer and request reloads;
it independently verifies installed declaring prototypes and grants **no capabilities**.
The stored approved package permissions still determine its Page execution context.
The [TCP acceptance test](../../../test/wbasic-taskboard.test.js) additionally packages
a WBasic `EVENT Page.PreRender / CALL Me.SelectPage(2) / END EVENT` workflow through
existing manifest bindings, proving authenticated navigation in the normal host.
Without independent publisher verification, that emission fails closed with HTTP 403.
The example's public method can also be invoked by approved host workflows as shown
in the controller tests; it does not claim a browser navigation callback.

Run the complete reproducible acceptance:

```sh
node --test --test-isolation=none test/wbasic-taskboard.test.js test/sewn-shared-budget.test.js
npm test
npm run check
```

The Taskboard data provider is deterministic in-memory WBasic business logic. A
public typed provider method populates the list's Array property. Approved SERVICES
calls may supply data through existing caller-bound contracts; presentation never
executes service calls, SQL, host expressions or callbacks. WydStore remains storage,
not a compulsory Model layer. No production database is needed for this example.

## Grammar and compiler APIs

Existing 0.19 source and result shapes remain compatible. One class per file remains.
New grammar includes:

- `CHILD Name AS "publisher/type" INTO Slot`, literal `PROPERTY Name = value`,
  `END CHILD`; a surrounding `SLOT Slot ... END SLOT` supplies explicit placement.
- `SLOT Slot ACCEPTS ["publisher/type"] MIN 0 MAX 8 ... END SLOT` declares a
  canonical slot contract. Derived class contracts may narrow but not weaken it.
- `CONTENT MARKDOWN "literal"` supplies the canonical content property default.
- `PRESENTATION SERVER`, `HEADING value`, `CONTENT value`, `END PRESENTATION`.
  Values are scalar literals or statically resolved `Me.Property` reads.
- Presentation-local `REPEAT Item IN [homogeneous scalar literals] LIMIT 256`
  uses existing presentation `each`, without creating Wydgits.
- `TEMPLATE Card AS "publisher/card" INPUT "publisher/record" KEY Key`, typed
  `BIND Title TO Item.Title` entries, `END TEMPLATE`.
- Class-level `REPEAT Card FROM Me.Tasks INTO blocks LIMIT 8` creates canonical
  child instances through that validated template.
- `BIND EVENT Pager.PageChanged TO Me.OnPageChanged`, also Me and supported Page
  sources. Trusted builds may enable App-root Server/Session declarations with
  `hostEvents:true`; execution still needs actual host authorization.
- `Me.NamedChild.PublicMethod(...)` and public child property reads/writes.
- `RAISE EVENT DeclaredName(typed arguments)` within an authorized class body.

`compileClass(source, options)` and `compileFamily(fileToSource, options)` retain
trusted manifest, approved dependency and publisher options. Family builds resolve
parent, interface, child, template input/output and slot dependencies deterministically.
Cycles, unresolved dependencies, namespace disagreement and invalid whole trees
fail atomically before returning resources. There is no remote fetching or source
execution at build time. Existing `resources.prototypes`/template package contracts
are reused, including current restrictions on foreign package template instances.

Diagnostics retain error code and source location where the frontend can identify
the declaration; canonical validator/runtime errors intentionally sanitize values
and host details. Exact slot/property identities are preserved. No hidden helper
procedures become public instance methods.

## Language-neutral artifacts

Old classes retain `wydgit.definition/0.19`. Extended classes use
`wydgit.definition/0.20`, with build composition and closed canonical prototype
metadata `wydgit.component/0.20`. Shared lowerers own validation; no WBasic AST is
required by the lowerer, installer, runtime or independent JSON fixture.

```json
{"component":{"schema":"wydgit.component/0.20","children":[{"name":"Pager","type":"divdev/task-navigation","slot":"blocks","properties":{}}],"subscriptions":[{"source":"Pager","event":"PageChanged","handler":"onpagechanged"}],"templates":[],"repeaters":[]}}
```

The resolved registry derives subscription declaring owners; serialized metadata
cannot supply or forge them. A template contains `{name,type,model,key,bindings}`;
a repeater contains `{template,property,slot,limit}`. These are validated canonical
composition contracts, not callbacks or another template interpreter.

Presentation remains existing `wydgit.presentation/0.1`:

```json
{"schema":"wydgit.presentation/0.1","template":{"tag":"section","children":[{"tag":"h2","text":{"get":"properties.Title"}}]}}
```

Child envelopes remain `wydgit/0.2`. Declared children have deterministic IDs such as
`taskboard-Pager`; IDs carry no authority. Executable wire schemas are unchanged:

```json
{"op":"invoke","target":{"op":"context","name":"ME"},"method":"related","args":[{"op":"literal","value":"child"},{"op":"literal","value":"Pager"}]}
```

Emission uses the existing EVENT.Raise operation with a literal declared name, ME
and an object of typed parameters. The controller authenticates the declaring
frame and live receiver, then queues the existing dispatcher event under stable
`declaring/prototype#EventName` identity. Legacy string EVENT.Raise cannot forge
these names. No new SEWN wire opcode or browser executor is introduced.

New component packages require platform `>=0.3.0-alpha.8 <0.4.0` and server runtime;
build and installation reject weaker version floors and client execution claims.
The floor prevents older runtimes silently accepting inert component metadata.

## Composition and symbolic references

Children are uniquely named, ordered within explicit canonical slots, single-owned
and checked for known types, initializer visibility/types/constraints, required
values, acceptance/cardinality and complete-tree validity. Inherited children precede
new declarations. Compile-time templates retain no native objects or live references.
Ordinary NEW now expands default static children into bounded invocation-local
canonical drafts. Init runs only after trusted attachment/activation, not compilation
or draft construction. Every constructed prototype needs the caller's explicit scope.

Named runtime lookup rechecks children traversal, visibility, actual containing slot,
expected prototype, owning root and live lifetime through the current instance's
opaque adapter. Forged names/IDs, removed relationships and disposed handles fail.
It is not arbitrary tree traversal or a WBasic-only reference type.

Logical slots retain canonical contracts. Current visual server placements are App
pages/navigation, Page sections/navigation, Section blocks, Block children and Form
blocks/fields. Unsupported visual slots/targets fail `COMPONENT.TARGET`; HTML nesting
never establishes canonical ownership. Field/navigation child slots are unsupported. A source component cannot combine Form
presentation replacement with composed fields/blocks: native field placement inside
that presentation has no current contract, so the target explicitly rejects it.

## Presentation, styling and data binding

Bindings are one-way declarative exact property reads, reevaluated at explicit
render. Sources must be public, discoverable, unrestricted scalar properties; no
Object/Array-to-text coercion, private/protected read, executable markup, script,
inline handler, arbitrary CSS or dynamic host expression is permitted. There is no
reactive propagation graph or two-way binding, hence no cyclic update mechanism.
Invalid canonical values fail validation; existing renderer errors are sanitized.
Methods/services update model properties separately from rendering.

`format` and `skin` remain ordinary canonical property declarations/initializers.
Existing fixed alignment/width/tone/layout vocabularies and approved skin identity
resolution are reused. Unsafe/missing skins and unsupported format values fail the
existing renderer checks. The compiler does not create a styling registry.

Server presentation is HTML-oriented and more capable than H2. Scalar content and
fixed format *concepts* are portable, but this milestone does not claim its server
presentation tree is a browser presentation contract. SERVER declarations and
component execution on client targets explicitly fail. H2 literal content/Markdown
and its independent roots remain supported by H2, with Markdown displayed literally.
Future portable presentation lowering/capability validation belongs to H3; no raw
HTML escape hatch is provided.

## Templates and repeaters

Template input is a named canonical prototype's public property schema, applied to
plain JSON records, not serialized instance handles. Target bindings require matching
types and public unrestricted properties; full required values, enums and constraints
are revalidated at runtime. Source Array reads are authorized ordinary property reads.
Each dedicated repeater slot has one owner and one explicit limit (1–256).

Keys must be unique nonempty bounded ASCII identifiers (alphanumeric first, then
alphanumeric/underscore/hyphen, maximum 64 characters). Reorder preserves live IDs
and Init count; retained keys update validated properties; empty data removes all
items. Removed keys are retired; reappearing keys receive new lifetime IDs. Removed
subtrees are invalidated and cleaned up child-first. Reconciliation runs after
activation, methods/workflows/handlers and before render. No database pagination
is inferred. Native edits validate a complete candidate before publication; earlier
successful application mutations/service commits are not transactionally rolled
back if subsequent reconciliation fails. No silent partial list truncation occurs.

Expansion shares SEWN construction/step/deadline accounting, maximum active tree
256/depth 32, maximum controller lifetime identities 4096, and at most 32 reconciliation
rounds. Exhaustion/cancellation stops the chain. A failed child Init/Preload invalidates
the controller's owned tree; reactivation requires fresh trusted hydration.

## Trusted instance lifecycle

The controller owns transitions:

```text
constructed -> initializing -> initialized -> preloading -> active
                                 ^                       |  Render (repeat)
                                 +------ Unload ----------+
any live/failed state -> disposing -> disposed
```

Init runs at most once per live hydration. Activation is idempotent, Preload runs on
first activation/reactivation, Render runs on newly active instances and explicit
renders. Unload detaches activation subscriptions and returns to initialized; Dispose
permanently retires authority and is idempotent. Child teardown precedes parent.
Init/Preload failure cannot leave a usable partial activation. Cleanup continues
through hook failures and exhausted budgets: application hooks may fail, host
invalidation still completes. Error details are sanitized and bounded.

Hooks are isolated modules, never ordinary callable methods. Only trusted entry
tokens bound to the exact registry, context and live receiver can execute them.
Removal/disposal invalidates references and subscriptions before cleanup callbacks;
pending work cannot later mutate or resurrect the object. Budgets survive hook and
method boundaries. An Unload or Dispose hook may update its own authorized cleanup
state but cannot traverse/mutate containment or raise events.

Page requests use independent hydrated trees and the controller automatically.
Server App roots use an explicitly trusted `createInstanceController` supplied as
`instances` to `createLifecycle`, or `execution.lifecycleInstances` plus the same
`lifecycleContext` to HTTP host configuration. start activates it before Server.Start;
stop delivers Server.Stop then disposes even on cleanup failure. App controllers do
not execute Page descriptors: Page instances are request-scoped. Nothing supplies
capabilities from package/source metadata. Crash/network/browser-close cleanup is
best effort, not durable exactly-once delivery.

## Events and host wiring

A typed raise is accepted only from its verified live authorized declaring receiver,
with visibility/member access, payload schema, `event.custom.raise` and lower-case
logical event scope (for example `pagechanged`). Events use the **existing** sequential
FIFO dispatcher. Handlers run in deterministic registration order, are awaited,
and nested raises wait until remaining handlers and the current default complete.
No bubbling occurs. Original source identity is preserved, never replaced by the
subscriber or publisher. Disallowed mutation fails normally under caller SEAM.

Cancelable custom events can stop remaining delivery via EVENT.Cancel/Handled;
structural Page lifecycle delivery cannot be canceled/suppressed. Exceptions stop
the chain and pending queued work, with sanitized errors. Disposed subscribers are
skipped, disposed emitters stop remaining delivery; stale queued targets fail closed.
Source removal and pending cancellation do not undo already committed mutations.
Nested raises share the chain's depth, event, handler, step, time, construction,
service and allocation limits. No handler/library/hook receives a fresh budget.

Subscriptions derive from validated metadata only while recipient/source are live
and authorized. Child binding resolves actual ownership and public event signature;
handler access is checked against the original declaring prototype. Page bindings
use actual Start (Page root only), Initialize, Load, Validate, PreRender, Unload.
These share the native Page dispatcher queue, including legacy workflows/defaults.
Server.Start/Stop and Session.Start/Authenticated/Logout/Timeout/End require a verified
App root, explicit trusted build policy, `event.lifecycle.subscribe`, exact lower-case
host event scope and genuine host context. Source declaration alone cannot subscribe.
There is no separate canonical App event family; App/Client pseudo-sources are rejected.
Browser components cannot impersonate Server/Session contexts.

## Budgets, compatibility and limitations

`createExecutionBudget` tokens are opaque and exact-context-bound. Default maxima
remain existing SEWN ceilings (including time, steps, services, drafts/construction),
plus dispatches 256, handlers 2048, raises 256, depth 16; native queue bound is 64.
Caller limits only reduce effective ceilings. A Page request shares one ledger across
all phases, events, defaults, hooks and cleanup. A host operation shares its ledger
across nested handlers/hooks/libraries; each independent host lifecycle delivery has
one ledger. Exhaustion is terminal for that ledger. Standalone execute retains an
independent ledger when none is supplied. Presentation retains its separate existing
bounded output/evaluation policy, never an executable service path.

No H3 execution, browser compiler, new VM/package installer/event system, remote
dependency downloads, generalized two-way reactivity, arbitrary HTML/CSS/JS, durable
lifecycle guarantees or unrestricted tree authority is added. Arbitrary third-party
visual slots and foreign package templates remain subject to existing renderer and
installer policy. Firefox/Safari/native execution and an independent exhaustive
security audit are not claimed. Follow [the handoff](wydclient-handoff.md) for the
next browser execution milestone.
