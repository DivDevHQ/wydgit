# Object model — 0.2-B

`wydgine/object-model/index.js` implements the portable model. It has no filesystem,
HTTP or DOM dependency. The founding architecture remains unchanged.

## Prototypes

`new PrototypeRegistry(definitions)` resolves a single `extends` chain. A definition
has an immutable `id` (`publisher/name`), matching `publisher`, optional `public`
and `abstract` flags, `properties` and `slots`. Resolved definitions are deeply
frozen. Derived property and slot rules replace same-named base rules; other rules
are inherited. Abstractness is local: a concrete subtype can instantiate an
abstract base's definitions. Identity and ancestor membership remain separate
from containment.

Inheritance is allowed within a publisher or from a public base in a host-approved
official publisher (default `wydgit.core`). `public: true` alone does not authorize
cross-publisher inheritance. Registration is a trusted host operation; package
verification and namespace assignment are not implemented. JSON cannot change a
registry or mint grants.

Property rules support JSON `type`, `required`, `default`, and optional `enum`.
Unknown properties are rejected. Slots define `accepts` (prototype IDs, including
subtypes), `ordered: true`, `min` (default zero), and optional `max`. All slots are
ordered arrays; no unordered collection abstraction is needed yet.

## Canonical data and runtime

Each envelope contains `schema: "wydgit/0.2"`, `id`, `prototype`, `properties`,
`slots`, and `provenance`. All six must be own enumerable data fields. Slots
recursively embed envelopes. Missing, inherited, hidden, symbol and extra envelope
fields are rejected. `schema.js` defines this shared validation contract. IDs are
supplied by the creator, never generated during hydration.
They start with a letter and contain letters, digits, underscores, periods or
hyphens. Friendly routes and titles are independent properties.

`hydrate(jsonOrObject, registry)` validates the complete tree before returning a
runtime. There must be exactly one App (or App subtype), at the root. Each other
instance occurs once, in one slot. Duplicate IDs, repeated object references,
cycles, unknown slots, wrong child types, cardinality violations and abstract
instances fail with stable error codes. Nested-only persistence has no detached
object table in which to hide orphans. Extra envelope fields are rejected.

Instances are immutable snapshots with ID, prototype identity, properties,
provenance, and slot arrays of child IDs. The host runtime's `get(id)` returns
these frozen instances. Parent and sibling indexes are private hydration state.
`scope(context)` supplies the mediated relationships described in [SEAM](seam.md).
Use `runtime.edit(context)` for controlled edits that produce a new snapshot.
See [mutation-model.md](mutation-model.md) for operations, grants, identity,
change sets and revision semantics.

`dehydrate(runtime)` returns an independent JSON-compatible tree; `serialize`
returns its deterministic JSON. Default values and empty declared slots are
materialized. Property, provenance and slot keys use deterministic ordering;
child arrays retain their authored order. Parent/root/sibling references never
appear in persistence. Provenance is inert metadata, never authority.

Reserved keys `__proto__`, `constructor`, and `prototype` are explicitly rejected
in property data, provenance, slot names and prototype definitions, including
nested values. The envelope's required string `prototype` field is the necessary
schema exception. Non-JSON values, non-plain objects, accessors and non-finite
numbers are rejected. Hidden/symbol fields and sparse or extended arrays are
also rejected throughout JSON data. Negative zero normalizes to zero, matching
JSON serialization. Mutation inputs pass these same checks. Hydration bounds
object depth to 64 and count to 10,000;
JSON value nesting is bounded to 128. This is not a general hostile-JavaScript
sandbox; use JSON at untrusted ingestion boundaries, not live proxies.

Errors are `WydgitError` instances with `code`, `message`, and `details`.
`toJSON()` emits `{ok:false,code,message,details}`. `resultOf(operation)` provides
an explicit synchronous result boundary and hides unexpected host exceptions.
Transport byte limits before parsing remain a host responsibility.

## Demo and web compatibility

`content/app.json`, canonical `content/pages/*.json`, and canonical
`content/navigation.json` are the editable demo source. The trusted repository
loader assembles page files (sorted by filename) and navigation into the App's
slots before hydration. `content/app.json` is therefore an App fragment, not a
standalone export. `dehydrate` produces the complete canonical export. All page
files participate; there is no separate Site publication list.

`prototypes/objects.json` contains the canonical registry, including an abstract
base. `wydgine/web-model.js` projects the hydrated tree into the existing web
renderer's mutable DTOs. Site is now only a web-renderer compatibility view of App.
The older individual prototype files remain web validation/presentation metadata,
not runtime prototype identities. Skins remain trusted web presentation resources,
not additional runtime Wydgit instances. No CSS or HTML implementation is added to
the portable kernel. The renderer retains its numeric `order` presentation sorting;
canonical sibling order is slot array order.

Architectural differences from 0.1 are intentional: App replaces Site ownership,
and invalid persisted structure fails the entire App instead of admitting a
partially valid graph. Web presentation/link errors still degrade locally.
Direct mutations in legacy renderer tests affect only DTOs, never the runtime.
Home/About/Contact styling, navigation, sanitization and layout remain intact.

Deferred: package installation, interface-type slots, service
execution, persistence adapters and other later-phase systems. No founding
architecture revision or unresolved architectural decision is required.


0.2-H adds a request-local execution layer without changing canonical App ownership.
Hydration remains immutable. `scope(context,startId)` can select another already
visible object for trusted host adapters, without changing self or any grants.
Minimal Form/Field prototypes use semantic values and validation data; renderer
HTML stays outside the model. See [events.md](events.md) for Session/Page execution.


## 0.2-M: portable prototype methods

**Prototype = class; Wydgit instance = object.** There is one inheritance model.
A trusted registry definition may carry `behavior`, a validated `sewn/0.3` program
with an empty workflow body. Its procedure declarations are the prototype's public
methods. They retain their lexical procedure table, so a method can call other
procedures in its module. All declared procedures are public methods in this first
version; there is no partial access-modifier system.

The repository explicitly associates source through `behaviorSource` strings in
`prototypes/objects.json`. `loadRepository` compiles these with `compilePrototype`
before registration. There is no directory scan, executable file discovery, remote
loading or portable JavaScript callback. Other trusted hosts can compile explicit
source definitions or supply canonical SEWN behavior directly. Prototype modules
contain SUB/FUNCTION declarations and cannot contain EVENT blocks. Definitions
without behavior retain their existing semantics.

Method names are canonical lowercase and source names are case insensitive.
Duplicates and names colliding with kernel facade methods are rejected. Lookup
starts at the actual prototype, following the existing single `extends` chain.
Derived definitions must explicitly list inherited names in `overrides`, e.g.
`"overrides":["setmessage"]`. Kind, parameter count, each parameter type and FUNCTION
return type must match exactly; no coercion or overloads. Cross-publisher rules are
unchanged. Resolved behavior is frozen and cannot be modified by portable code.

`Me` is the receiver, including when it is a draft. Methods reuse SEWN's typed ByVal
parameters, isolated frames, completion rules and whole-execution budgets. They
retain the caller's exact ExecutionContext and contextual service bindings.
**A prototype provides behavior. It does not provide authority.** Publisher,
public/core status, method ownership and inheritance confer no grants.

## Construction drafts

`NEW` creates an invocation-local builder, never a detached canonical runtime
instance. Its private candidate envelope materializes the same inherited defaults
used by hydration. Unknown/abstract prototypes, App roots, invalid IDs, unknown
properties, wrong types/enums and dangerous keys fail before attachment. Required
properties without defaults and minimum slot cardinalities may remain incomplete
while building; child insertion and final attachment require a complete subtree.

Drafts have immutable explicit IDs and prototype identities. They expose property
reads, validated `Set`, prototype methods and nested draft `Insert`. There are no
fabricated parent/root/sibling relationships, traversal into the App, independent
authority, persistence or cross-request heap. Nested insertion copies a complete
child into the parent builder and consumes the child's token. Final Insert/Replace
uses the ordinary validated containment mutation and consumes the root token only
on success. Every alias of a consumed token becomes stale, including after nested
insertion. To use the attached object, reacquire a normal scoped handle through an
already-authorized relationship; attachment grants no visibility or traversal.

Failed operations leave the accepted builder/tree intact and the token usable until
invocation exit. WydBASIC has no TRY/CATCH yet, so an unhandled failure ends that
invocation. All builders expire on executor completion/failure/deadline. Their
opaque references cannot appear in JSON, service payloads or workflow results.
Only containment makes their data canonical; there is no detached object table.

The explicit host grant is `object.instances.construct` plus exact prototype IDs
in `context.scopes.prototypes`. It authorizes private builder edits, not edits to
existing objects. Attachment still needs `object.instances.edit` and every existing
and prospective ID's ordinary visibility/edit scopes. No implicit persistence is
added. `acme/message-panel` and its derived important panel are explicit demo
prototypes; their portable source and HTTP integration prove this model.

Base calls, access modifiers, nominal prototype types, multiple inheritance,
interfaces/mixins, overloads/static members, reflection/dynamic names, closures,
automatic IDs/persistence, remote loading and slot-property sugar are deferred.


## 0.2-N portable Forms

Form now inherits Section. Section blocks and optional Block children accept nested layout and semantic Fields. All Form descendants share ownership; duplicate names and nested Forms fail canonical validation, including draft graphs. Property rules can declare a nonempty array of JSON types for nullable and single/multi values. Default exports redact PasswordInput values; trusted internal edits explicitly preserve sensitive state. See [forms.md](forms.md).


## 0.2-O: one Form containment model

Form inherits Section and fields participate in the ordinary containment tree,
through inherited `blocks` and permitted descendant slots. Form behavior discovers
descendant Fields recursively by containment ancestry. `Form.fields` is removed;
persisted content using that slot fails with `OBJECT.UNKNOWN_SLOT`. No alias or
migration is retained. Recursive field semantics and nested-Form denial are unchanged.
