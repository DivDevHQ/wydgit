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
