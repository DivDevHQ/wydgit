# WydGate — 0.2-F

**Libraries provide capabilities. SEAM grants authority.**

`@wydgit/gate@0.1.0-alpha.1` is the independently versioned canonical library
`wydgate`, with publisher identity `wydgit.core`, trust `canonical`, target `server`. It
requires WydStore `^0.1.0-alpha.2` through the portable library requirement contract.
No provider, filesystem or database API is imported by WydGate. The same service
calls work with either JSON or SQLite. The demo leaves both libraries disabled.

## Identity and portable API

The host passes `createGate(registry.bind(caller))` to application code. The facade
is exported as `@wydgit/gate/client`; it is not a WydClient implementation.

```js
const user = await GATE.createUser({
  username: 'Alice', displayName: 'Alice', password: 'a long private passphrase'
});
await GATE.getUser(user.id);
await GATE.findUserByUsername('ALICE');
await GATE.updateUser({id:user.id, username:'alice-new', displayName:'New label'});
const result = await GATE.authenticate('alice-new', 'a long private passphrase');
// result: {authenticated:true, user:{id, username, displayName, active}}
await GATE.changePassword(user.id, 'a different private passphrase');
await GATE.updateUser({id:user.id, active:false});
```

User IDs are generated UUID v4 values prefixed with `u_`. IDs never change when
username, display name, password or active state changes. Callers cannot supply an
ID at creation or replace an ID during update. User IDs are distinct from Wydgit
instance IDs, package identities, usernames, credentials and sessions.

Safe user results contain exactly `{id, username, displayName, active}` and are
frozen. There is no credential, storage revision, storage scope, hash, provider,
context or raw service handle in these projections. Missing users produce
`GATE.USER_NOT_FOUND` for authorized user reads/updates.

## Username and password policy

Usernames are 3–32 ASCII characters: a letter followed by letters, digits, `_` or
`-`. Input may have leading/trailing ASCII spaces; these are removed, then ASCII
letters are lowercased. Input is bounded to 64 characters before normalization.
Tabs, Unicode lookalikes, email syntax and embedded spaces are rejected. Lookup,
authentication and uniqueness all use the same normalized value. The stored and
returned username is normalized; a separate display name preserves presentation.
Display names are well-formed Unicode strings of at most 128 code points, default
empty. There is no email, profile document, role or group model.

Passwords accept 15–128 Unicode code points, including spaces and passphrases.
They must be well-formed Unicode and are bounded to 256 UTF-16 code units (at most
512 UTF-8 bytes). No trimming, case folding, Unicode normalization or composition
rules are applied. Wrong types, invalid Unicode, short and oversized inputs fail.
Password creation/change reports `GATE.INVALID_PASSWORD`; authentication uses the
generic failure below. Plaintext passwords are never sent to WydStore or logged.

The package pins **argon2 0.45.1** and uses Argon2id v19 with 19 MiB memory, two
iterations, one lane, a random 16-byte salt and a 32-byte digest. The maintained
[Node Argon2 implementation](https://github.com/ranisalt/node-argon2) supplies hashing
and verification; this meets the current minimum Argon2id configuration in the
[OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The native dependency supports Node 22 and is confined to the WydGate package.
Only the exact bounded encoding/work factors produced by this version are accepted
from storage, preventing corrupted parameters from requesting excessive work.
Changing the hash format/work factors will need explicit future migration handling.

There are at most two simultaneous hash/verify jobs per registered Gate instance;
excess work fails `GATE.BUSY` without an unbounded queue. This is a resource bound,
not account/IP rate limiting. The milestone adds no public authentication endpoint;
a future host endpoint must supply transport security, request bounds and abuse
controls. It must not log credential-bearing requests. No brute-force protection
or production authentication deployment readiness is claimed here.

## Authentication, disabling and credential changes

Authentication requires its own explicit capability and App scope. Wrong passwords,
unknown usernames and disabled users all produce `GATE.AUTH_FAILED`. Unknown users
still perform verification against a random dummy hash using the same parameters.
Disabled users perform the password verification work but cannot succeed. This
reduces avoidable account-existence timing differences; it is not a constant-time
claim for the whole storage-backed operation. Invalid username/password values fail
generically before hashing; malformed request envelopes fail validation. Infrastructure/resource failures keep their safe `GATE.IO` or
`GATE.BUSY` codes instead of masquerading as invalid credentials.

After successful verification, Gate reads current state again and checks that the
user is active and that username and credential have not changed during hashing.
The result is an identity assertion for that operation, not a session or bearer
token. It neither modifies the caller context nor grants privileges.

`updateUser({id,active:false})` disables authentication without deleting identity
or history. `changePassword` is an explicitly authorized **administrative credential
management operation**; it does not require the old password. It replaces the
current credential atomically, leaves identity/profile intact, and does not activate
a disabled user. The old password stops authenticating against current state.
Self-service password-change policy and forgotten-password recovery are not added.

## WydStore layout and atomicity

One private collection contains a single fixed record, `local-identity`, with:

- `schema`: `wydgate.local/0.1`;
- `users`: an array of safe user metadata;
- `credentials`: an array of `{userId, passwordHash}` entries.

Users and credentials remain separate logical data. Their physical aggregate is a
deliberate initial compromise: WydStore has atomic single-record changes, but no
portable transaction spanning records. Committing one directory revision makes
creation, username uniqueness, rename and credential replacement atomic on both
providers, including competing registry instances/processes. No uniqueness claim
relies on a process-local mutex or a separate query-then-insert sequence.

Mutations reread and retry up to three WydStore revision conflicts. Each retry
revalidates uniqueness/current state, and exhaustion yields `GATE.CONFLICT`. Hashing
occurs before the revision update and is not repeated on each retry. Initial load
creates the empty directory if missing; a missing/corrupt directory during operation
fails closed rather than recreating identities. All loaded data is validated for
schema, duplicate IDs/usernames, valid hash format and one credential per user.

The directory is capped at **256 users**. Whole-directory reads, writes and retained
history make this appropriate for small local identity stores, not large user bases.
WydStore capacity limits still apply and yield `GATE.LIMIT`. WydStore history retains
old hashes and prior directory snapshots; they remain sensitive, host-only data.
Old hashes are never used for authentication. No purge, deletion, backup or restore
API is introduced. History is not a backup.

## Host wiring and SEAM boundaries

The host enables WydStore with a dedicated store owned by App `appA`, publisher
`wydgit.core`, package identity **`library:wydgate`**. That identity is a logical
runtime principal, not an npm path. Its collection schema is:

```json
{
  "id": "directory",
  "fields": {
    "schema": {"type":"string", "required":true},
    "users": {"type":"array", "required":true},
    "credentials": {"type":"array", "required":true}
  }
}
```

Use this collection in the ordinary WydStore host configuration, selecting `json`
or `sqlite` and a private root there. WydGate's host entry is:

```json
{
  "id": "wydgate", "package": "@wydgit/gate", "enabled": true,
  "version": "^0.1.0-alpha.1", "publisher": "wydgit.core", "trust": "canonical",
  "options": {"app":"appA", "store":"identity", "collection":"directory"},
  "bindings": [{
    "library": "wydstore", "app": "appA",
    "capabilities": ["store.records.read", "store.records.create", "store.records.write"],
    "scopes": {"wydstore":[{"store":"identity", "collection":"directory"}]}
  }]
}
```

The library manifest declares the portable `wydstore` requirement; the loader
verifies it and registers dependencies first. Host `bindings` explicitly approve
implementation resource access. For the binding, the loader issues a frozen context
with the consumer manifest's publisher, `package: "library:wydgate"`, the configured
App, and **only** the configured capabilities/scopes. No library can request new
grants through registration or choose that principal's identity. Missing bindings,
missing/disabled/incompatible requirements and dependency cycles fail startup.

The binding is available only to trusted library registration code. Gate uses it
for its fixed private directory; request data cannot select a store, collection,
record or provider. The original application context still authorizes every Gate
operation and is passed unchanged to its handler. Private implementation authority
is never transferred to that caller. This is service-owned persistence, not an
application gaining WydStore rights by calling a privileged object.

Application callers require matching `context.app` and `scopes.wydgate: ["appA"]`,
plus the appropriate capability:

| Operation | Capability |
| --- | --- |
| createUser | `gate.users.create` |
| getUser, findUserByUsername | `gate.users.read` |
| updateUser (including rename/disable) | `gate.users.update` |
| authenticate | `gate.credentials.authenticate` |
| changePassword | `gate.credentials.manage` |

These are App-wide administrative service grants, not per-user roles or self-service
rules. Returning a safe user after creation/change or successful authentication does
not require the separate general-read capability. No capability is granted merely
by loading Gate. Generic WydStore grants to an ordinary publisher/package cannot
match the private store's ownership, even if they name the same store/collection.
The host must keep context constructors, the registry and implementation bindings
private; this is not a sandbox for arbitrary imported JavaScript. Trusted host code
with deliberately issued private-owner credentials can inspect persistence.

## Failures and deferred behavior

Expected failures are stable `GateError.code` values; `toJSON()` provides a safe
`{ok:false,code,message,details:{}}`. Codes include `GATE.INVALID_CONFIG`,
`GATE.INVALID_USER`, `GATE.INVALID_USERNAME`, `GATE.INVALID_PASSWORD`,
`GATE.USER_EXISTS`, `GATE.USER_NOT_FOUND`, `GATE.AUTH_FAILED`, `GATE.DENIED`,
`GATE.CONFLICT`, `GATE.BUSY`, `GATE.LIMIT` and `GATE.IO`. The dispatcher additionally
uses `SEAM.DENIED` and `SERVICE.INVALID_REQUEST`. Store/driver exceptions, raw hashes,
SQL, paths, storage identifiers and internal stack traces do not appear in normal
package-facing errors.

Shared JSON/SQLite tests cover user lifecycle, normalized duplicate claims, safe
results, disabled users, password replacement, persistence reopening, explicit
authority and credential isolation. Focused tests cover hashing bounds, races,
corrupt credentials, hostile inputs and dependency policy.

Deferred: sessions, cookies, tokens, roles/groups/RBAC, MFA, password reset/email,
email verification, external identity providers, federation, admin UI, WydClient,
SEWN and WydStitch. No founding-contract change was necessary.
