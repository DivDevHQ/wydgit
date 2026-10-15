# Canonical Wydgit OOP contract — 0.3-H0

This is the runtime-neutral contract for Wydgit objects. JSON is authoritative;
Wydgine implements the contract. Future WydClient and native runtimes must use
these semantics rather than defining another object model. This stage does not
implement a new client runtime.

## Identity, ownership and lifecycle

A prototype is a class identified by an exact qualified `publisher/name` ID. Its
publisher must match its namespace. An instance has an immutable ID and prototype
identity, JSON properties, ordered named child slots and inert provenance. App,
publisher, package, installation, prototype and instance IDs are distinct.
Package publishers own definitions; the App owns instantiated objects.

Single `extends` inheritance is supported within a publisher, or from an explicitly
public official prototype. Inheritance defines identity, never execution authority.
Containment is separate: one App root, one parent per nonroot instance, no cycles,
no detached object table. Parent/sibling references are derived rather than stored.
Hydration validates a complete graph. Edits produce a new validated snapshot.
Construction drafts are invocation-local, incomplete until attachment, bounded,
nonserializable references that expire or are consumed. No automatic persistence
or additional lifecycle behavior is introduced.

## Properties and methods

A prototype may declare:

```json
{
  "id": "acme/list",
  "publisher": "acme",
  "properties": {
    "content": {"type":"object","default":{"type":"markdown","value":""}},
    "cache": {"type":"object","default":{},"access":"private","hidden":true},
    "shared": {"type":"string","default":"","access":"friend"},
    "records": {"type":"array","default":[],"requires":["store.records.read"]}
  },
  "friends": ["acme/card", "acme/*"],
  "methodRules": {"refresh":{"access":"protected","hidden":false}},
  "behavior": {
    "schema":"sewn/0.5", "body":[],
    "procedures":{"refresh":{"kind":"sub","params":[],"body":[]}}
  }
}
```

Properties accept JSON `string`, finite `number`, `boolean`, `object`, `array`,
`null`, or a nonempty list of these types. `required`, `default` and `enum` retain
existing validation semantics; no implicit coercion occurs. Defaults are validated
when materialized into an instance or draft. Object type means JSON object, not a
native runtime object or a nominal Wydgit reference. Nested content format rules
remain host/content validation concerns; `type:object` alone is not a rich-content
schema validator.

Methods are portable SUB/FUNCTION procedures in a validated behavior with an empty
workflow body. Typed parameters, return type, isolated frames, recursion denial and
shared execution budgets apply. `methodRules` keys must identify locally declared
methods; metadata belongs to the declaring prototype. There are no portable
callbacks. WydBASIC still compiles declared method names to lowercase for existing
source compatibility. Canonical `sewn/0.5` permits exact case-preserving method
identifiers; previous SEWN versions retain their lowercase declaration grammar.

Properties and methods share one collision policy and the following metadata:

- `access`: `public`, `private`, `protected`, or `friend`. Omission always means
  `public`, regardless of creation date.
- `hidden`: boolean, default false. Hidden affects discovery independently of
  access. An underscore has no access or visibility significance.
- `requires`: optional list of SEAM capabilities. Every requirement is checked
  against the unchanged execution authority, including lexical helper calls.
  Generic public exports omit such properties even when their access is public.

## Access and declaring-class context

Object-reference visibility, traversal, App ownership and installation scopes
must first permit reaching the object. OOP access cannot create that permission.
Public members are accessible through an authorized reference. Private members
are accessible only while executing behavior declared by their exact owner.
Protected members are accessible to that owner and legitimate descendants approved
by the existing inheritance policy. Friend members are accessible to their owner
and explicitly approved, verified friend prototypes. Friendship applies only to
members marked `friend`.

The runtime carries a separate, trusted declaring-prototype frame when dispatching
a method. An inherited method executes as its original declaration, not the
receiver's derived class. An override executes as the overriding declaration.
Arguments are evaluated in the caller's frame; the caller's frame and receiver
are restored on return or failure. Lexical procedure calls retain their owning
behavior table and declaring context. Workflow-level code has no declaring-class
privilege merely because its ME object has that prototype. JSON, parameters,
provenance, session roles and a supplied publisher label cannot create a class frame.

SEAM capabilities, resource scopes, service bindings and budgets remain the original
caller's throughout dispatch. Neither private access nor friendship grants any
capability. Sensitive password values remain redacted through object references.
A public method may deliberately return authorized private data: that is an
explicit behavior contract, rather than generic reflection or serialization.

## Friends and publisher verification

The granting prototype owns an explicit `friends` array. Allowed patterns are
exact qualified IDs and `publisher/*`. Universal `*`, partial or nested globs,
malformed IDs and cross-publisher declarations are rejected. Duplicate entries
are rejected. Friendship is not transitive and is not inherited by either newly
declared grantors or newly declared descendant behavior. An inherited method
retains the privileges of its actual declaring class; this does not give newly
declared derived methods those privileges. Inherited friend members continue to
use their original owner, never the receiver's `friends` array.

`acme/*` matches only prototypes independently bound to publisher Acme by the
trusted host. App ownership, instance provenance, a package manifest's publisher
claim, or execution context publisher metadata cannot establish that binding.
The host must verify both grantor and friend. Exact friendships also require
verified identities. There is no grant across an otherwise denied App,
installation or object-reference boundary.

Wydgine's trusted registry option `verifiedPrototypes` maps exact prototype IDs to
verified publisher IDs. Portable definitions cannot set it. Repository-owned
prototype files are trusted host definitions and receive bindings from the loader.
Installed packages receive bindings only if the embedding host supplies an
independent `verifiedPackages` package-to-publisher map to `loadRepository` and
`planPackageInstall`. Existing receipt/resource/namespace checks still apply;
receipts alone are not publisher authentication. The ordinary installer CLI does
not assert publisher verification and therefore rejects packages granting friends.
Hosts using this extension must retain their publisher verification policy across
restart. No cryptographic publisher registry or automatic claim verification is
implemented. Cross-publisher friendship has no safe approval surface in the current
host policy and is rejected; a future trusted authorization policy must explicitly
approve it before this restriction can change.

## Exact and ordinary resolution

Canonical JSON member names preserve exact spelling and case. Exact lookup matches
one exact declared name, including hidden names, then checks access and SEAM.
Ordinary lookup compares locale-independent Unicode lowercase spellings without
Unicode normalization (WydBASIC identifier tokens are ASCII), omits hidden members,
and succeeds only when one member matches. It resolves to canonical spelling before
execution. Ambiguity is an error, never a guessed override. Public property bags
continue to use exact JSON keys and contain only public discoverable values.

The existing parser is extended only at dotted members and assignments:

```vb
Me.Content = {"type":"markdown", "value":"Hello"}
Me.content = {"type":"markdown", "value":"Hello"}
Me.[content] = {"type":"markdown", "value":"Exact lowercase property"}
Dim cached As Object = Me.[cache]
Call Me.[refresh]()
```

Brackets contain one existing identifier token after a dot; array literals retain
their existing grammar. Brackets are exact lookup, never elevated access.
`Me.[cOnTeNt]` succeeds only if that exact name is declared. Direct member reads and
assignment require a Wydgit reference; arbitrary JSON map writes are not added.
Kernel facade names keep their existing ordinary syntax. A bracketed name targets
a canonical member instead of the kernel facade. Existing `Me.Set("content", value)`
remains exact and now checks the same access rules. Legacy `.properties.content`
remains exact access to the filtered public bag.

New operations are `memberRead {target,name,exact}` and
`memberSet {target,name,value,exact}` in `sewn/0.5`. Method operations in that schema
can carry `exact:true`; ordinary calls use case-insensitive resolution. Compiler
output uses 0.5 when the new member syntax is required; old source retains old wire
versions. Prior wire grammars remain closed.

## Collisions, overrides and dispatch

New ordinary prototypes reject case-equivalent names across properties and methods,
including inherited names. Exact spelling overrides remain supported. Similar
case is never an override. A trusted host can pin specific historical spelling
pairs using `caseCollisionCompatibility[prototypeId]`: only the explicitly listed
colliding names are admitted, not an unrestricted package flag. Ordinary lookup
then rejects ambiguous matches and exact lookup is required. Descendants require
their own explicit compatibility pin. No existing repository prototype requires
this mechanism.

Method overrides require explicit `overrides` entries with exact names and identical
kind, parameter types/count and return type. Access must remain identical;
requirements cannot be removed and hidden members cannot become discoverable.
Private methods and properties cannot be overridden in this iteration. This avoids
redirecting declaring-class private calls into descendant behavior. Protected
virtual calls from an ancestor are authorized against the inherited method slot,
then dynamically execute the selected override in its own declaring frame.
Externally calling that protected slot remains denied. Friend method overrides use the
actual overriding owner and its explicit friend declarations, not inherited grants.

Property schema overrides retain the inherited slot's declaring owner and preserve
type, access, inherited enum constraints and capability requirements. Required inherited values must stay required or have a supplied
default; hidden state cannot be exposed. The existing core Checkbox, RadioGroup,
CheckboxGroup and Select `value` specializations retain their historical JSON types
as a narrowly named compatibility exception. Lowercase `content` is unchanged.

## Serialization, diagnostics and presentation

Generic public representations include only public, discoverable properties with
no declared capability requirements. This filter applies to scoped/draft property
bags, instance `toJSON`, default dehydrate/serialize and web projections. Form
Values also omits restricted/hidden values. Generic Change event payloads and returned envelopes redact restricted
values as well. Private/protected/friend/hidden state
is absent even if the caller has a visible object reference. Execution diagnostics
are sanitized; property validation messages do not enumerate private member names
or values. Host-only runtime snapshots and
`dehydrate(runtime,{includeSensitive:true})` retain full internal state for edits
and protected persistence. They must never be forwarded as public responses or
ordinary package handles. Persistence storage protection is a host responsibility.

Service inputs and results remain governed by each canonical service contract and
SEAM, not by automatic OOP field inference. Explicit member reads require `requires`
capabilities; method returns may disclose data intentionally. There is no general
information-flow/taint engine. Presentation delivery bindings remain trusted host
contracts and canonical-library authority checks remain mandatory. Package code
never receives a raw host runtime. Literal Insert/Replace property initializers
also pass member access checks; validated private draft defaults are retained on
attachment. Tree removal/replacement retains existing SEAM mutation authorization.

Content values keep `{type:"markdown",value:"..."}`. They are not universal `.Text`
strings and are distinct from child-object slots and presentation templates.
Wydgine currently renders supported Markdown through sanitized HTML; ordinary
packages do not supply executable markup. HTML-oriented templates, skins and web
DTOs are host renderer concerns, not a native-runtime requirement. A future
runtime-neutral rich-content representation is reserved without specifying WYML or
another new markup language. This iteration does not rewrite presentation.

## Compatibility and deferred work

Existing omitted access remains public. Existing ordinary prototypes need no mass
renaming, and existing public Set/property-bag APIs remain available. Explicitly
restricted members now enforce access, visibility and export rules consistently.
Hosts must use internal exports for persistence of restricted state: a public
export is intentionally not a complete round-trip backup of secret properties.
WydClient implementers must reproduce identity, lookup, declaring frames, trusted
publisher bindings, visibility, override and serialization rules, while maintaining
separate SEAM authority. The existing client adapter is not expanded here; future
client member adapters must establish trusted object bindings rather than exposing
raw DOM or native objects.

Deferred: cross-publisher friendship approval, remote publisher verification,
private base-call/shadowing syntax, richer content, client implementation, multiple
inheritance, interfaces/mixins, overloads, static members, arbitrary reflection,
package upgrades and cross-App identity. No platform version bump or release is
performed for this corrective stage; the platform stays `0.3.0-alpha.7`, and the
new executable wire contract is explicitly versioned `sewn/0.5`.


## 0.19 language-neutral class declarations

Ordinary prototypes may now carry closed `methodContracts`, `events` and `lifecycle`
metadata. `methodContracts` maps exact method names to kind, ordered parameter type
names, optional function returns, access, abstract and virtual flags, plus optional hidden and capability requirements. Abstract
signatures have no executable body; concrete prototypes must implement them.
Explicit contracts constrain overriding to virtual slots; existing JSON methods
without this metadata keep their established override behavior. Canonical signature,
visibility and capability checks still apply. Linked static helper procedures are
excluded from instance method tables.

`events` maps event names to access and ordered `{name,type}` data parameters.
The registry derives declaring owners; declarations cannot supply host event families
or callbacks. `lifecycle` maps Init/Preload/Render/Unload/Dispose to validated SEWN
modules with empty workflow bodies and parameterless hook SUBs. These modules
remain separate from ordinary callable methods. Omitted hooks mean no application
hook work, not an automatically implemented state controller.

The universal abstract Wydgit authoring contract is implicit and has no installable
root prototype or privilege. Existing semantic ancestry and JSON definitions need
no migration. At 0.19 automatic hooks and typed emission were deferred; 0.20
implements the supported server path below. Class compilation never grants H2 host
construction access. See [0.19](milestones/sewn-0.19/README.md) for exact contracts,
metadata trust, portable property type restrictions and runtime prerequisites.

## Component contracts (0.20)

The optional closed `wydgit.component/0.20` prototype field records children,
subscriptions, typed templates and bounded repeaters. See the [full contract](milestones/sewn-0.20/README.md).
Shared canonical validation applies equally to handwritten JSON and compiler output: finite
default composition, known types, ordered accepted slots, public typed initializers,
template bindings and exact handler signatures. Resolved subscription owners and
lifecycle owners are derived by the registry, never accepted as authority from JSON.
Modern derived class slot declarations cannot weaken inherited acceptance/cardinality.

Named-child access returns existing opaque member adapters through trusted current
ownership/slot/type checks. IDs/names are not credentials. NEW creates bounded default
composition drafts; host attachment/activation establishes lifetime. No second object
tree, class registry or live reference wire representation exists. Platform alpha.8
is the minimum executing component runtime; H2 alpha.5 rejects these contracts.
