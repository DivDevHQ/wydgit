# 0.3-H0 inspection baseline

Starting HEAD: `2c4a2bab703531afb4dac9aa7640ea1bb06fe4c1`, branch
`develop/0.3`, clean working tree. Repository AGENTS.md, development and
founding architecture instructions apply; no nested AGENTS.md was found.

The registry owns qualified prototype IDs, namespace/publisher agreement, single
inheritance (same publisher or public official base), inherited property/slot
merging, explicit method overrides and exact signature validation. Properties
are exact JSON names; SEWN procedures and compiled methods currently use lowercase
names. There is no access or discoverability metadata enforcement, nor inherited
case collision detection. Methods retain their lexical procedure table, receiver,
and caller SEAM context, but have no separate declaring-class access context.

Hydration validates JSON types, enums, defaults, required properties, immutable
IDs, App roots, acyclic containment and slot cardinality. Mutation produces new
snapshots; invocation-local construction drafts reuse these validations. Host
runtime.get and internal dehydrate(includeSensitive:true) retain full state.
Public serialization, scoped handles and draft enumeration only redact password
values. The web projection copies all other properties. These are disclosure
boundaries requiring correction. Error boundaries hide execution messages, while
property validation diagnostics currently include member names.

SEWN uses opaque reference tokens and closed versioned grammars. WydBASIC uses
one tokenizer/parser/compiler; facade member names are case insensitive, JSON
map reads are exact, and property writes use Me.Set("name", value). Direct
Me.Content access, member assignment and bracket member syntax are absent.

Installer planning checks manifest/prototype namespace agreement, host approvals,
App placement and ownership. Receipts pin resource hashes, publisher, grants,
installation and instance IDs. Startup checks receipt/catalog agreement and drift.
Publisher identity is host-approved local package identity, not a cryptographic
remote publisher registry. App ownership and instance provenance are not publisher
verification. Cross-publisher friendship cannot be safely granted by this policy.

Content remains a typed object such as {type:"markdown",value:""}; rendering
accepts Markdown and sanitizes generated HTML. Child slots are separate from
content. Presentation templates and web DTOs are host-specific. Existing object,
SEWN, WydBASIC, construction/HTTP, package/installer, security and canonical
library tests provide regression coverage; they must remain intact.
