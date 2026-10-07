# WydStore — 0.2-E

**Libraries provide capabilities. SEAM grants authority.**

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
collection and do not derive from mutable display fields. No ID generator exists.

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
