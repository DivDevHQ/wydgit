# WydStore — 0.2-E

The [reviewed package-policy foundation](reviewed-package-policy-reconciliation.md)
adds native stopped-App plan/review/apply with separate policy revisions and durable
host approval. Package requirements, execution placement, SEAM, Gate membership and
store ownership remain independent; direct policy-file edits still fail drift checks.

Current [0.3-J site-policy contract](backoffice-scoped-policy-and-store-authorization.md):
Store alpha.4 adds optional versioned trusted operation rules, current Gate permission
and execution context checks at protected provider admissions, preserving the owner
tuple and both adapters. Earlier checkpoints below remain historical where superseded.

> I0 uses a separate registry/resource configuration per App and retains service-level
> App/publisher/package/scope checks even for equal logical store names. Local resource
> roots are confined per App. See [I0](milestones/0.3-I0/README.md).

**Libraries provide capabilities. SEAM grants authority.**

The proposed [execution-context and domain architecture](execution-contexts-and-administrative-domains.md)
extends the isolation design to site, account and host ownership, preserving exact
existing ownership checks. FrontEnd and BackOffice share their own site domain
under separate authorization; account/provider stores remain isolated. Domain
schema changes and administrative provisioning are not implemented by that design.

WydStore is the first implemented canonical library: identity `wydstore`, Node
package `@wydgit/store`, publisher `wydgit.core`, trust `canonical`, target `server`.
It lives in `packages/wydstore` and has independent version `0.1.0-alpha.2`; the
platform is `0.2.0-alpha.5`. It uses the existing explicit library loader. The demo
installs but disables WydStore and remains file-content rendered.

## Host configuration

A trusted operator creates a private, existing data directory, then enables this
entry in `wydgit.config.json`. Replace the example absolute root with that directory:

```json
{
  "id": "wydstore",
  "package": "@wydgit/store",
  "enabled": true,
  "version": "^0.1.0-alpha.2",
  "publisher": "wydgit.core",
  "trust": "canonical",
  "options": {
    "stores": [{
      "id": "main",
      "app": "appA",
      "publisher": "acme",
      "package": "acme/demo",
      "provider": "json",
      "root": "/srv/wydgit-data",
      "collections": [{
        "id": "users",
        "fields": {
          "name": { "type": "string", "required": true },
          "active": { "type": "boolean", "default": true }
        }
      }]
    }]
  }
}
```

All shown structural fields are required. `required` and `default` on fields are
optional. Unknown fields, duplicate store/collection IDs, unsupported providers,
invalid schemas, and dangerous JSON keys fail closed. Store configuration owns
schemas; records cannot define or alter them. Collection fields support `string`,
finite `number`, `boolean`, `object`, `array`, and `null`. Nested objects/arrays
contain JSON data, not a recursive schema language. Unknown record fields are
rejected. Missing fields receive defaults, then required fields and types are
checked. `id` is reserved for record identity, not a data field.

Only host configuration contains provider settings and filesystem roots. Portable
requirements name `wydstore` and a semantic version range. Canonical App data,
contexts and returned record handles contain no Node implementation wiring.

## Host policy and portable API

The host issues the context and binds the registry; it passes only the resulting
facade to package code. Context construction and the raw registry are host-only.

```js
// Trusted host code:
const context = new ExecutionContext({
  publisher: 'acme', package: 'acme/demo', app: 'appA', self: 'card',
  capabilities: ['store.records.read', 'store.records.create',
                 'store.records.write', 'store.records.delete'],
  scopes: { wydstore: [{ store: 'main', collection: 'users' }] }
});
const STORES = createStores(registry.bind(context));
// createStores is the portable export from @wydgit/store/client.

// Application operations:
const users = STORES.get('main').collection('users');
const user = users.create('user1', { name: 'Ada' }); // unsaved draft
await user.save();                                // insert, version 1
user.set('name', 'Ada Lovelace');
console.log(user.original.name, user.current.name, user.dirty);
await user.save();                                // update, version 2
const fetched = await users.get('user1');
const active = await users.query({ where: { active: true }, limit: 10 });
const history = await users.history('user1');
await fetched.delete();                          // tombstone, version 3
```

`get(store)` and `collection(name)` construct handles; access is checked when a
service operation occurs. `create(id, data)` creates an in-memory draft; it inserts
only on `save()`. Field names, identity and JSON safety are checked locally;
collection schema and authority are checked at the service. `set(name, value)`
changes a field, `reset(name)` removes it (defaults reapply on save), and `get(name)`
reads its current value. Removing a required field without a default fails on save.

Handles are frozen. `id` is immutable; `original` and `current` are deeply frozen
snapshots. Change fields only with `set`/`reset`. Caller-owned input objects are
copied. Neither paths, adapters, raw services, context factories nor Node objects
are reachable through the facade. `client` denotes this portable facade, **not**
a WydClient implementation or a browser transport.

## Identity, lifecycle and concurrency

IDs are caller-supplied ASCII letters followed by letters, digits, `_` or `-`,
1–128 characters, excluding `constructor`, `prototype`, and `__proto__`. Store,
collection and App identifiers use the same rule. Record IDs are unique within a
collection and do not derive from mutable display fields. Portable WydBASIC `NewId()` can supply an explicit ID; it grants no storage authority.

- New: `version === 0`, `original === null`, `dirty === true`; save inserts at 1.
- Unchanged: current equals original; save returns the same handle without I/O,
  authorization work or a revision check. It is not a refresh operation.
- Modified: current differs by deterministic JSON equality; save submits the
  original revision and replaces the stored record only if it still matches.
- Deleted: explicit `delete()` requires an existing record and matching revision;
  the handle becomes read-only and clean, discarding unsaved field edits. It retains
  its last fetched/saved values for inspection. A tombstone occupies the next version.

Updates increment the revision only when data changes. The provider performs
compare-and-write atomically; stale updates/deletes throw `STORE.CONFLICT`. A
failed validation, limit check or revision comparison leaves persisted state and
the handle's original revision intact;
working edits remain available for the caller to inspect. An I/O failure during
finalization can have an uncertain outcome; fetch before retrying. Fetch again to resolve a
conflict; there is no automatic merge. Concurrent operations on one handle fail
`STORE.BUSY` while a save/delete is pending.

Deleting reserves the ID permanently in both adapters. Recreating that ID
fails `STORE.DUPLICATE_ID`; tombstones preserve history and prevent stale handles
from updating a different incarnation. Missing/deleted records cannot be fetched.

## History and query

History is enabled unconditionally. Each successful update/delete retains the
previous logical record version in the same atomic write. `history(id)` returns
immutable `{version, data, deleted}` entries in ascending revision order, including
the current state or deletion tombstone. Insert begins at version 1. No-op saves
produce no history entry. There is no pruning, restore API or history-disable flag.

History is **not backup**: it lives in the same provider file as current records
and cannot protect against loss or corruption of that file.

`query({where?, limit?})` lists nondeleted records, sorted by case-sensitive lexical
ID order. `where` is an AND of equality comparisons on declared fields; object/array
equality uses deterministic JSON values. An absent field does not match. `limit`
is an integer from 0 through 10,000 (default 10,000). No offset, joins, expressions,
sorting syntax, full-text search or provider-specific predicates exist.

## Authority and ownership

| Operation | Required capability |
| --- | --- |
| get, query, history | `store.records.read` |
| create/save new | `store.records.create` |
| update/save modified | `store.records.write` |
| delete | `store.records.delete` |

Capabilities answer **what**; exact `scopes.wydstore` pairs answer **where**. Both
are required. There are no wildcard scopes. A store also has an immutable configured
ownership tuple `(app, publisher, package, store)`; the caller must match the first
three identities. A different publisher, package or App cannot use a copied grant
to reach someone else's data. Store names alone are not ownership. Cross-owner
sharing is deliberately deferred.

The dispatcher captures a genuine host-issued `ExecutionContext`, checks the
manifest's capability, calls the service's authorization policy, and passes the
same frozen context to the handler. WydStore checks ownership/scope again inside
its service. Request data cannot replace that context. Loading a library, receiving
a result, changing records, inheritance, containment and provenance grant nothing.
`visible`, `editable` and traversal grants are independent of storage scopes.

## Internal adapter contract

`src/adapter-contract.js` defines normalized requests, snapshot shapes, exact JSON
equality, ID ordering, revision transitions and shared record validation. It is
internal to `@wydgit/store`, not a package export. The facade and SEAM policy did
not change for SQLite. `core.js` chooses the provider from host configuration only.

Adapters implement asynchronous `execute(operation, request)` and return JSON
values. The core authenticates/authorizes the caller and validates the request and
collection schema first. Every request contains logical `store` and `collection`;
the following table lists the remaining fields. Extra fields are rejected.

| Operation | Additional request fields | Result |
| --- | --- | --- |
| `get` | `id` | `{id, version, data}` for a live record |
| `query` | optional `where`, `limit` | Array of live snapshots, sorted by ID |
| `history` | `id` | Ascending `{version, data, deleted}` entries, including current/tombstone |
| `create` | `id`, `data` | New snapshot at version 1 |
| `update` | `id`, `data`, expected `version` | New snapshot, or unchanged snapshot for equal data |
| `delete` | `id`, expected `version` | `{id, version, deleted:true}` |

IDs are immutable and scoped to collections. Create never overwrites live records
or tombstones. Missing IDs fail `STORE.NOT_FOUND`; duplicate creates fail
`STORE.DUPLICATE_ID`. Updates/deletes of a tombstone or with a stale revision fail
`STORE.CONFLICT`. The authoritative comparison and history/current-state write
must be atomic. An update containing identical data checks the expected revision
first, then returns without incrementing the version or adding history. The facade's
local unchanged `save()` bypasses dispatch entirely, as documented above.

The core materializes defaults before an adapter receives data. Providers preserve
JSON types, exact equality, negative-zero normalization, lexical ID ordering and
absent-field behavior; they do not apply database type coercion. Results contain no
provider identity or implementation handles. Expected failures are `StoreError`
codes, and unexpected provider failures are sanitized before crossing dispatch.

`test/wydstore-conformance.test.js` is the executable definition of this contract:
the same tests run against both providers through the real loader and facade.
They cover lifecycle, CRUD, no-ops, tombstones, reopened history, conflicts, schema,
identity, scopes and hostile inputs. A paired query test compares results for all
six supported field types. Separate tests retain JSON file-security coverage and
exercise SQLite-specific initialization, rollback, concurrent processes and safety.

## Provider configuration and ownership

Both providers use the host entry shown above. Set `provider` to `"json"` or
`"sqlite"`; `root` remains a host-approved, existing absolute directory. There is
no filename, connection string, URI, SQL, table, pragma or driver option in the
configuration or portable request. Each provider derives its own filename from
the ownership tuple; records cannot influence paths. SQLite uses `.sqlite`, JSON
uses `.json`. Changing provider selects a different store file; it does **not**
convert or migrate existing data.

One library can host both providers in its `options.stores` array, for example
`json-main` with provider `json` and `sqlite-main` with provider `sqlite`. They may
share a host root, but their logical scopes and ownership remain independent.
The same `STORES.get(id).collection(name)` facade accesses either. A grant to one
does not grant access to the other, even when collection/record IDs are identical.

## JSON provider

The JSON adapter uses one file per ownership tuple, with a SHA-256-derived name;
caller strings are never used as paths. It verifies an absolute normalized root,
all directory ancestors and realpath, rejects symlink roots/ancestors, and opens
files without following symlinks. Existing data must be a regular, singly linked
file no larger than 16 MiB. The entire document, ownership, schema, records and
history are validated on every operation; corrupt input is never silently reset.
A file missing after initialization is corruption. Startup creates missing stores.

Writes use an exclusively created random temporary file (mode 0600), file fsync,
then atomic rename. Temporary files are removed on handled failure. In-process
queues serialize operations; an exclusive local lock file prevents overlapping
read/modify/write by cooperating processes. A busy lock fails `STORE.BUSY`; no
waiting/retry or distributed lock service is implemented. After a crashed process,
an operator must establish that no writer remains before removing its stale lock.

This adapter targets small stores on a host-controlled local filesystem. The root
must not be writable by untrusted OS users; these checks are not protection against
a malicious privileged process replacing directories during operations. Network
filesystem locking/rename semantics are unsupported. File fsync plus rename avoids
partial JSON writes but does not promise power-loss durability of the directory
entry. Startup initialization is not a transaction across multiple stores. There is no backup/recovery system. Limits are distinguished below.

## SQLite provider

The canonical library alone depends on **better-sqlite3 13.0.3**, pinned in its
workspace package and lockfile. It supports Node >=22, covering the platform's
Node >=22.12 baseline, and supplies SQLite rather than requiring a system database
server. Prepared statements and synchronous transactions keep revision checks and
writes in one short atomic operation. There is no ORM or vendored engine. See the
[driver API](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/docs/api.md).
A clean install was verified on Node 24.21.0 / npm 11.19.0. Native setup may invoke
node-gyp and need Node headers, Python and make; deployments must permit the
reviewed dependency setup. The installed driver is smoke-tested by the SQLite
provider suite. The dependency is not exposed to ordinary Wydgits. The portable `/client` export
has no Node/SQLite import. JSON-only initialization does not load the SQLite adapter.

Private schema version **1** uses three fixed `STRICT` tables:

- Metadata: ownership tuple and exact configured collection definitions.
- Records: logical collection/record ID, current revision, canonical JSON data and
  deletion marker; a composite primary key reserves identity.
- History: prior live revisions and canonical JSON data, keyed by collection, ID
  and version and referencing the current record/tombstone.

SQLite `user_version` records the private schema version. Newly and exclusively
created files are initialized transactionally. Existing empty, incompatible or
newer databases are rejected, never reset. Startup verifies the version, fixed
schema, metadata, integrity/foreign keys, records and history continuity. Every
operation checks metadata/schema again; accessed values are validated and history
checks detect revision gaps. Changed collection definitions require an explicit
future migration; this milestone has no collection migration mechanism.

All SQL identifiers are fixed implementation constants. Logical IDs, ownership,
record JSON and revisions use bound parameters. The only assembled SQL execution
is choosing among constant schema statements; fixed pragmas configure the private
adapter. No caller-controlled SQL fragment or identifier is accepted.

Writes run in a synchronous **BEGIN IMMEDIATE** transaction: read/compare the
current revision, insert its prior state into history, update current state, commit.
A conditional revision update is checked as well. Any exception rolls back both
history and current-state changes. Simultaneous writers wait up to one second for
the transaction; a writer whose expected revision is then stale gets
`STORE.CONFLICT`. Lock timeout is sanitized to `STORE.BUSY`. Read operations use a
consistent read transaction, so history and current state cannot straddle a write.
Connections open per operation and always close; no pooling, lifecycle hook or
background work was added. Synchronous work can block the host event loop.

Queries scan records in binary ID order (identical to the permitted ASCII IDs'
portable lexical order), evaluate the shared JSON equality predicate and apply the
portable limit after filtering. JSON values are not coerced through SQL equality.
History returns prior versions followed by current state/tombstone, exactly as JSON.

The existing safe-root checks are shared unchanged. SQLite files are exclusively
created with mode 0600; files and `-journal`, `-wal`, `-shm` sidecars must be regular,
singly linked, nonsymlink files. The driver is opened with `fileMustExist`; a missing
file during service execution fails rather than recreating data. Only rollback
journal mode with 4096-byte pages is supported. Trusted-schema execution is disabled;
extra triggers/views/tables or changed table definitions are rejected. No extension
loading or caller-selected driver options exist.

Use a private, host-controlled **local filesystem**. SQLite opens by pathname, so
pre-open checks cannot defeat a privileged process replacing files/directories
between check and open. An interrupted first-time initialization can leave an
invalid file that requires operator inspection; it is not automatically deleted.
An ordinary transaction crash uses SQLite's rollback journal recovery. Backups,
restore, distributed coordination and network filesystems remain out of scope.

## Limits

Portable limits remain 128-character IDs, JSON nesting of 64, 10,000 records per
collection including tombstones, and query limits 0–10,000. Provider capacities
are implementation safeguards, not new query syntax or capabilities:

| Provider | Additional limits |
| --- | --- |
| JSON | Entire store document, including history, at most 16 MiB |
| SQLite | Database at most 65,536 4096-byte pages (256 MiB); each inspected sidecar at most 256 MiB; each serialized record data value at most 16 MiB |
| SQLite results | At most 32 MiB of serialized record data per query/history response; history returns at most 10,000 versions including current |

SQLite can hold more than 16 MiB across records/history. Oversized responses fail
`STORE.LIMIT`, never silently truncate history. All retained versions remain stored;
there is no pruning or history pagination. Provider capacity failures do not change
identity, versions, equality or authority. No per-tenant quotas are implemented.

## Errors and deferred work

Portable calls reject with `StoreError` and a stable `.code`; `toJSON()` gives
`{ok:false, code, message, details:{}}`. Dispatch itself returns safe result objects.
Expected codes include `STORE.INVALID_CONFIG`, `STORE.UNKNOWN_STORE`,
`STORE.UNKNOWN_COLLECTION`, `STORE.NOT_FOUND`, `STORE.DUPLICATE_ID`,
`STORE.INVALID_RECORD`, `STORE.INVALID_FIELD`, `STORE.DENIED`, `STORE.CONFLICT`,
`STORE.DELETED`, `STORE.BUSY`, `STORE.LIMIT`, `STORE.CORRUPT`, and `STORE.IO`.
Missing service capability is `SEAM.DENIED`; invalid dispatch JSON is
`SERVICE.INVALID_REQUEST`; unexpected handler/authorization failures are
`SERVICE.FAILED`. Missing scope is denied before exposing whether a store exists.
Normal error payloads omit host paths, exception messages and internal stacks.

Tests use isolated temporary roots, removed afterward; they never write demo data.
Deferred: providers beyond JSON/SQLite, migrations, cross-owner sharing, cross-store
transactions, distributed locking, replication, backups, restore, query languages,
admin UI, WydClient, and executable third-party package isolation. No founding
architecture change or unresolved architectural decision was needed.


## 0.2-P local packages

Packages declare logical collection fields and receive separately approved mappings to already configured stores/collections. Providers/roots remain host-owned. `NewId()` supplies a portable explicit record ID; ordinary create authority still applies. See [packages](packages.md).


For local declarative packages, the trusted interactive installer can enable the
already installed canonical WydStore and provision JSON or SQLite after separate
operator approval. No manual directory or config editing is needed for this path.
It offers compatible reuse first, translates package logical fields into existing
WydStore collection rules and uses host-owned `.wydgit-data/` by default. The package
cannot select provider, filesystem root or physical resource IDs. Planning writes
nothing; staged apply creates infrastructure only after final confirmation. See
[trusted infrastructure policy](packages.md#trusted-infrastructure-policy).

## 0.3-B foundation (current)

WydStore implementation version is **0.1.0-alpha.3**, service API **1.0.0**.
The current platform version is 0.3.0-alpha.3. The preceding sections describe the
retained legacy API and backend safeguards; this section extends those contracts.
SQLite is the recommended production backend. JSON remains a small development
backend. Application behavior is portable; capacity and durability are backend properties.

### Invocation and compatibility

Use `registry.bind(context).invoke('wydstore','1.0.0',operation,input)` in trusted
canonical code, or `SERVICES.Invoke("wydstore", "1.0.0", operation, input)` in
WydBASIC (operation must be a source literal). All operations use the existing
registry, context, authorization and structured error boundary. Versioned Page calls
apply the existing approved logical storage mappings, just as legacy Page calls do.

The manifest explicitly lists the six legacy operations allowed through `.call`:
get, query, history, create, update, delete. Other versioned libraries still reject
legacy calls by default. New count, metadata and transaction operations require
explicit invocation. The portable facade selects the versioned path for these
new operations; existing handles keep their legacy dispatch and capacities.

Canonical and legacy WydStore calls use the same loader-owned service profile:
17 MiB request JSON, 33 MiB response value JSON, depth 64 and 262,144 value nodes.
All byte budgets measure **serialized UTF-8 JSON**, including keys, punctuation,
escaping and values; the fixed dispatcher `{ok:true,value}` envelope and transport
headers are excluded. There is no universal 64 KiB record limit. Other canonical
services default to 64 KiB request/response bytes, depth 32 and 4,096 nodes.
Host settings and stored-record/query/transaction budgets are separate; see
[resource policies](#resource-policies). WydStore checks single-operation results
and aggregate transaction results before committing writes. No implicit truncation
occurs. Existing large WydGate directories and multi-megabyte record tests retain
their supported behavior; WydGate's own legacy interface is unchanged.

### Query contract

`query` adds `filter`, `sort` and `offset` to the existing `where` and `limit`.
`where` remains an AND of exact JSON equalities; when both are supplied, `where`
and `filter` must both match. A filter is one of:

```json
{"field":"score","op":"gte","value":10}
{"and":[{"field":"active","op":"eq","value":true},{"field":"score","op":"lt","value":100}]}
{"or":[{"field":"name","op":"eq","value":"Ada"},{"field":"name","op":"eq","value":"Grace"}]}
```

Predicates: eq, ne, lt, lte, gt, gte. Comparison predicates accept only declared
number/string fields and matching values. There is no coercion, SQL, expression,
join or full-text syntax. Equality supports all six JSON field types. Numbers are
finite, negative zero normalizes to zero, object key order is immaterial, array
order matters. Null matches only a declared null field; optional missing fields
match no predicate, including ne. Boolean values never coerce to numbers.

`sort:[{field:'score',direction:'desc'}]` supports up to eight distinct scalar
fields; strings compare by JavaScript UTF-16 lexical order (not locale collation),
numbers numerically, booleans false before true. Missing sorts before present in
ascending order and after present in descending order. Equal keys always break
by ascending ASCII record ID. Object/array sort is unsupported. `offset` is an
integer 0–10000; `limit` remains 0–10000, default 10000. Pagination applies after
filtering/sorting; pages from separate requests are not a stable snapshot across
concurrent changes. Filters allow at most 64 nodes, depth eight, and 16 children
per nonempty Boolean group. Unknown keys/operators/fields and invalid types fail.

`count` accepts the same request fields as query, counts all matched live records,
and ignores sorting/pagination. The facade `count({where?,filter?})` exposes only
its relevant options. `metadata` accepts only store/collection and returns the
host collection definition, with no provider, path or adapter handle. Both require
store.records.read. Existing create/update/delete revisions and history are retained.

### Schemas, collection provisioning and uniqueness

Host collection definitions can add `schemaId` (safe logical ID) and `schemaVersion`
(positive safe integer); both must appear together. Fields additionally accept
`unique:true` and `index:true`. Example:

```json
{"id":"users","schemaId":"usersSchema","schemaVersion":1,"fields":{
  "name":{"type":"string","required":true,"unique":true,"index":true},
  "active":{"type":"boolean","default":true}
}}
```

The existing host configuration/approved installer creates collections when
provisioning new stores. Packages cannot create arbitrary physical tables or
alter schemas at runtime. Metadata is read-only. Required/optional/default/type
rules are unchanged. Unique values use exact JSON equality per field among live
records: absent values do not participate; explicit null does. Deletion releases
field values, but reserves the record ID. Composite uniqueness is unsupported.
Indexes are logical declarations; both adapters currently scan portable JSON
values and neither promises a physical field index or SQL query performance.

New JSON documents persist exact collection definitions; legacy JSON files without
metadata remain readable only with unversioned host schemas. They cannot acquire
an explicit schema version silently. SQLite retains its fixed private schema v1;
explicit schema definitions are stored in its existing metadata table. Exact
configured/persisted definitions must agree. Schema changes fail explicitly with
STORE.SCHEMA_INCOMPATIBLE (legacy incompatible SQLite metadata retains STORE.CORRUPT).
A declaration is not a migration. Unversioned legacy JSON cannot prove that its
original host schema has not changed; this compatibility limitation is retained,
not described as version-aware protection. Adoption requires future explicit migration.

### Transactions and durability

`transaction` requires store.records.write plus every member's ordinary capability
and exact collection scope. Input:

```json
{"store":"main","collection":"users","operations":[
  {"operation":"create","input":{"id":"ada","data":{"name":"Ada"}}},
  {"operation":"count","input":{}}
]}
```

A batch has 1–64 members (reduced by trusted context limits.storeOperations), runs
in order, sees its own writes, and returns an ordered array of ordinary results.
Members support get/query/count/history/create/update/delete; nested transactions
and metadata members fail STORE.UNSUPPORTED. Input may choose another authorized
collection in the same store, but cannot choose another store. Every member is
validated and authorized before starting. Any operation, schema, uniqueness,
revision, capacity or aggregate-result failure rolls the whole batch back. Aggregate
result byte/node accounting runs after each member, including array syntax and
depth, and stops before executing further members once the effective budget fails.
Handles loaded earlier are not updated by a batch; refetch after commit.

JSON applies the batch to one private document under its existing queue/local lock,
then performs **one** temporary-file fsync and rename for that store. There is no
multi-file transaction, journal or invented JSON database. Handled failures before
rename preserve the prior document; readers see the old or new complete document.
An interruption before rename can leave an orphan temporary file/stale lock;
temporary files are ignored, and stale locks require operator inspection/removal.
Rename does not fsync the parent directory. Power loss may lose the replacement;
filesystem/device failure may corrupt data. There is no guaranteed power-loss
recovery, and failure after rename may have an uncertain outcome. Local filesystems
and cooperating writers only; no cross-store atomicity or automatic lock recovery.

SQLite executes the entire batch within its existing native BEGIN IMMEDIATE
transaction, with synchronous FULL and rollback journaling. Native rollback covers
operation failure and uncommitted process death. Durable commits rely on SQLite's
local filesystem/device synchronization assumptions; they are not a substitute for
backups. Concurrent writers serialize; stale revisions fail STORE.CONFLICT and
lock timeout fails STORE.BUSY. No asynchronous callback transaction, savepoint,
manual begin/commit, distributed transaction or cancellation framework is exposed.
Restart persistence and native interrupted-transaction recovery have regression tests;
no power-failure simulation or guarantee is claimed for JSON.

### Scope, errors and subsequent work

The immutable app/publisher/package tuple and exact collection grants remain
mandatory. Every caller's principal must match configured `principal`, defaulting
to the owning package under the current one-installation model. Host stores may
add `installation` to require that exact non-null receipt identity. These configured
identity fields also enter the physical ownership key; adding them selects a new
resource, not a migration. Legacy package stores remain package-owned rather than
retroactively receiving invented installation IDs. Incoming identity/context fields
never grant authority. No authenticated-user ACL or cross-owner sharing is added.

Added errors: STORE.INVALID_QUERY, STORE.UNIQUE, STORE.SCHEMA_INCOMPATIBLE,
STORE.UNSUPPORTED. Existing missing, duplicate, conflict, denial, capacity and
sanitized I/O errors are retained. SQL remains fixed/parameterized inside the
trusted adapter; logical queries execute shared predicates. No filesystem path,
SQL statement, connection or internal adapter becomes a portable operation.

`test/wydstore-foundation.test.js` and the existing shared conformance tests run
identical expectations against both backends. The small
[portable application fixture](../examples/store-portability/index.js) receives a
caller-bound dispatcher and uses identical application logic for either provider.

For 0.3-C, WydSearch should consume this public versioned contract, use its own
explicit capabilities/resource policy, and treat index declarations as metadata,
not a search index. Separate query/count calls are not one snapshot; a bounded
read batch can provide one-store consistency. No change feed, cursor, streaming
scan or search lifecycle guarantee is implemented here. Future schema migrations
must explicitly reconcile persisted definitions before opening; automated schema
upgrades, cross-adapter and package lifecycle migrations, and multiple installations
remain deferred to 0.4. No WydSearch, WydStream or WydGate enhancement is included.

### Resource policies

Only trusted host configuration controls these settings. The library entry accepts
`serviceLimits`; each `options.stores` definition accepts `limits`. They do not
belong to package manifests, requests, schemas or installation receipts. Changing
limits does not change storage ownership or migrate data. Unknown keys, noninteger,
zero/negative and over-ceiling values fail startup rather than silently clamping.
SQLite capacity must be a positive multiple of 4,096 bytes. This **4 GiB ceiling is
current v0.3 host policy**, not a fundamental WydStore or SQLite architecture limit.

| Host setting | Default | Hard ceiling |
| --- | --- | --- |
| serviceLimits.requestBytes (generic / WydStore) | 64 KiB / 17 MiB | 33 MiB |
| serviceLimits.responseBytes (generic / WydStore) | 64 KiB / 33 MiB | 65 MiB |
| serviceLimits.maxNodes (generic / WydStore) | 4,096 / 262,144 | 1,048,576 |
| serviceLimits.maxDepth (generic / WydStore) | 32 / 64 | 64 |
| limits.recordBytes | 16 MiB | 16 MiB |
| limits.queryResultBytes | 32 MiB | 64 MiB |
| limits.historyDataBytes | 32 MiB | 64 MiB |
| limits.transactionRequestBytes | 17 MiB | 33 MiB |
| limits.transactionResultBytes | 33 MiB | 65 MiB |
| limits.jsonDocumentBytes | 16 MiB | 64 MiB |
| limits.sqliteDatabaseBytes | 256 MiB | 4 GiB |
| limits.maxNodes | 262,144 | 1,048,576 |
| limits.maxDepth | 64 | 64 |
| limits.maxOperations | 64 | 64 |

Omitted keys retain defaults. Example settings within an existing WydStore host entry:

```json
{
  "serviceLimits": {
    "requestBytes": 17825792,
    "responseBytes": 34603008,
    "maxNodes": 262144,
    "maxDepth": 64
  },
  "options": {
    "stores": [{
      "id": "main", "app": "appA", "publisher": "acme", "package": "acme/demo",
      "provider": "sqlite", "root": "/srv/wydgit-data",
      "limits": {"sqliteDatabaseBytes": 536870912},
      "collections": [{"id":"users","fields":{"name":{"type":"string"}}}]
    }]
  }
}
```

Stored-record bytes cover `data` after defaults, excluding ID/revision envelopes.
Field values have no independent byte allowance. Query bytes cover the complete
snapshot array. History retains the existing sum-of-serialized-data-value budget;
its envelopes are additionally covered by the service response budget. Transactions
measure their whole input/output arrays and envelopes, independently of each
member's ordinary record/query/history limits. JSON document bytes include all
metadata, retained versions and tombstones. Its existing whole-document depth 64
check remains, without a new aggregate document-node cap; logical requests,
records and responses have the separate node policies above. SQLite's private
metadata and serialized data inspection retain their 16 MiB integrity safeguard.
Each inspected SQLite database/sidecar file remains bounded by configured capacity;
this is not an aggregate directory quota.

The loader captures immutable policies after validating the host-approved canonical
identity. It supplies the larger WydStore profile without requiring existing hosts
to edit configuration. Canonical and legacy WydStore requests/results use the same
budgets. Other legacy providers retain prior behavior unless the host explicitly
sets serviceLimits for that entry. Generic versioned boundaries return
SERVICE.INVALID_REQUEST / SERVICE.INVALID_RESULT; WydStore's independent checks
return STORE.LIMIT, including pre-commit response failures. These error layers are
the same for both adapters.

A genuine host-issued context may **reduce** serviceRequestBytes,
serviceResponseBytes, serviceNodes, serviceDepth, or storeOperations. Effective
limits are minima of host/service/store settings and applicable context reductions.
Large context values cannot raise host ceilings. The actual frozen effective
service policy is passed to the trusted handler, so transaction pre-commit checks
honor host-lowered service response bytes, nodes and depth. Package-supplied limits
or identity fields are rejected; spoofed contexts cannot bind a dispatcher.

The 262,144-node default was checked against multi-megabyte strings, a 250,000-value
record, full 10,000-record queries, 10,000-version histories, and existing WydGate
session capacity. Byte capacities are retained; byte size alone does not guarantee
acceptance of an extremely wide structure. Values above the node budget now fail
explicitly on both call paths. A host can raise both applicable node policies to
1,048,576; larger structures remain unsupported by this v0.3 policy. Reducing limits
can reject existing reads/writes without deleting or rewriting data. Limits are
operational policy rather than persisted schema compatibility metadata.

Budgets are inspected before boundary copies. Preparation is reused across
resource authorization and execution; record serialization is reused for SQLite
writes. SQLite unsorted queries/counts stream ID-ordered candidates, and pagination
stops after enough matching records; limit zero closes its native iterator cleanly.
Field sorting retains matched candidates, so its **candidate working set** must
also fit the effective query-result/service-response byte, node and depth budgets,
before pagination. Both adapters enforce this restriction; a selective filter or
higher trusted budget can permit a larger sorted scan. Transactions account for
aggregate output incrementally before collecting another member. These safeguards
avoid unbounded result accumulation and preserve authorization/rollback.

Byte/node budgets are not exact heap limits or global admission control. Parsed
objects, driver buffers, validation, sorting and immutable boundary copies have
additional memory overhead; concurrent calls/stores multiply it. JSON still reads
and validates a whole document, with one cooperating operation per file at a time.
There is no process-wide memory quota, bounded global waiting queue, streaming
response transport or distributed concurrency framework. Operators must provision
memory and bound host request concurrency accordingly. No new WydSearch or media
storage implementation is implied by raising these budgets.

## Host operational accounting (I2)

The [I2 resource inventory](milestones/0.3-I2/README.md) distinguishes existing
provider quotas from new host admission and outbound-payload accounting. Canonical
registry dispatch outcomes are measured without input/record/file contents; nested
implementation dependencies retain their own library counts. No second storage
quota ledger or durable cross-provider allocation guarantee is added. Temporary
files, journals, external writers and peak physical allocation remain subject to
the provider's documented boundary. Host snapshots do not grant service authority.

## Trusted package lifecycle checkpoints

`@wydgit/store/trusted/lifecycle` is a versioned host-only export
(`wydstore.lifecycle/1`), absent from the canonical service registry. Wydgine loads
it only for explicitly requested storage lifecycle work; WydStore remains optional
for other applications. Ordinary Wydgits cannot import npm modules or obtain
adapter handles, raw SQL, filenames or this API through SEAM.

The host contract validates complete owned-store checkpoints, including all record
history and tombstones. JSON publishes a bounded document through synced atomic
rename and an operation-specific temporary file. SQLite validates its fixed
platform schema and changes collections/records/history inside one native
transaction. Per-store barriers stop ordinary adapter calls during package
reconciliation. Exact package ownership, schema and before/after checkpoint
comparison are mandatory. A different owner, linked file, ambiguous collection,
unknown sidecar or changed content refuses safely.

The [package lifecycle contract](package-lifecycle.md) specifies approval,
lossless migration syntax, multi-resource compensation, committed-upgrade rollback,
whole-store purge and the intentionally retained private recovery copy. This is
not distributed atomicity, secure erasure or a generic provider migration facility.
Earlier future-work notes in this document describe broader adapters and migration
forms that remain unsupported; the bounded local contract above is implemented.
