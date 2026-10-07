# WydStore — 0.2-D

**Libraries provide capabilities. SEAM grants authority.**

WydStore is the first implemented canonical library: identity `wydstore`, Node
package `@wydgit/store`, publisher `wydgit.core`, trust `canonical`, target `server`.
It lives in `packages/wydstore` and has independent version `0.1.0-alpha.1`; the
platform is `0.2.0-alpha.4`. It uses the existing explicit library loader. The demo
installs but disables WydStore and remains file-content rendered.

## Host configuration

A trusted operator creates a private, existing data directory, then enables this
entry in `wydgit.config.json`. Replace the example absolute root with that directory:

```json
{
  "id": "wydstore",
  "package": "@wydgit/store",
  "enabled": true,
  "version": "^0.1.0-alpha.1",
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

Deleting reserves the ID permanently in this initial adapter. Recreating that ID
fails `STORE.DUPLICATE_ID`; tombstones preserve history and prevent stale handles
from updating a different incarnation. Missing/deleted records cannot be fetched.

## History and query

History is enabled unconditionally. Each successful update/delete retains the
previous logical record version in the same atomic write. `history(id)` returns
immutable `{version, data, deleted}` entries in ascending revision order, including
the current state or deletion tombstone. Insert begins at version 1. No-op saves
produce no history entry. There is no pruning, restore API or history-disable flag.

History is **not backup**: it lives in the same storage document as current records
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

## Adapter and JSON persistence

The core validates schemas, requests and ownership independently of the provider.
The internal adapter contract is `execute(operation, request)` for the six operations
above. It returns JSON record snapshots/history and implements authoritative
revision comparison with atomic changes. It exposes no files or document operations
to the core or facade. A later SQLite adapter can implement this contract without
changing the public API; adapter selection currently accepts only `json`.

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
entry. Startup initialization is not a transaction across multiple stores. Records
(including tombstones) are capped at 10,000 per collection, documents at 16 MiB,
and accepted WydStore JSON nesting at 64 levels. There is no backup/recovery system.

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
Deferred: all additional providers, migrations, cross-owner sharing, cross-store
transactions, distributed locking, replication, backups, restore, query languages,
admin UI, WydClient, and executable third-party package isolation. No founding
architecture change or unresolved architectural decision was needed.
