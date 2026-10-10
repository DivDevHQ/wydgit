# WydGate — 0.2-H

**Libraries provide capabilities. SEAM grants authority.**

`@wydgit/gate@0.1.0-alpha.3` is the independently versioned canonical library
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
empty. A separate minimal profile contains a biography; roles and groups are described below.

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

`updateUser({id,active:false})` disables authentication and revokes all sessions
without deleting identity or history. Re-enabling the user does not revive them. `changePassword` is an explicitly authorized **administrative credential
management operation**; it does not require the old password. It replaces the
current credential and revokes all sessions atomically, leaves identity/profile intact,
and does not activate a disabled user. The old password stops authenticating against current state.
Self-service password-change policy and forgotten-password recovery are not added.

## WydStore layout and atomicity

One private collection contains a single fixed record, `local-identity`, with:

- `schema`: `wydgate.local/0.2`;
- `users`: an array of safe user metadata;
- `credentials`: an array of `{userId, passwordHash}` entries;
- `roles`, `groups`, `assignments`, `profiles`, `sessions`: separate logical arrays.

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
Old hashes are never used for authentication. Expired/revoked sessions are removed from current state on successful login, but
retained history is not purged. No backup or restore API is introduced. History is not a backup.

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
    "credentials": {"type":"array", "required":true},
    "roles": {"type":"array", "required":true},
    "groups": {"type":"array", "required":true},
    "assignments": {"type":"array", "required":true},
    "profiles": {"type":"array", "required":true},
    "sessions": {"type":"array", "required":true}
  }
}
```

Use this collection in the ordinary WydStore host configuration, selecting `json`
or `sqlite` and a private root there. WydGate's host entry is:

```json
{
  "id": "wydgate", "package": "@wydgit/gate", "enabled": true,
  "version": "^0.1.0-alpha.3", "publisher": "wydgit.core", "trust": "canonical",
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
| authenticate, login | `gate.credentials.authenticate` |
| logout, resolveSession | `gate.sessions.use` |
| revokeSession | `gate.sessions.manage` |
| create/get/update/deleteRole, assignUser | `gate.roles.manage` |
| create/get/update/deleteGroup | `gate.groups.manage` |
| getAuthorization, getProfile | `gate.users.read` |
| updateProfile | `gate.users.update` |
| changePassword | `gate.credentials.manage` |

These are App-scoped service grants. Administration applies across that App;
logout/resolution also require possession of the bearer token. Gate permissions
do not grant these runtime capabilities, and no self-service administration policy
is inferred from identity. Returning a safe user after creation/change or successful authentication does
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
`GATE.CONFLICT`, `GATE.BUSY`, `GATE.LIMIT`, `GATE.IO`, `GATE.SESSION_INVALID`,
`GATE.INVALID_AUTHORIZATION`, `GATE.INVALID_PROFILE`, `GATE.ROLE_NOT_FOUND` and
`GATE.GROUP_NOT_FOUND`. The dispatcher additionally
uses `SEAM.DENIED` and `SERVICE.INVALID_REQUEST`. Store/driver exceptions, raw hashes,
SQL, paths, storage identifiers and internal stack traces do not appear in normal
package-facing errors.

Shared JSON/SQLite tests cover user lifecycle, normalized duplicate claims, safe
results, disabled users, password replacement, persistence reopening, explicit
authority and credential isolation. Focused tests cover hashing bounds, races,
corrupt credentials, hostile inputs and dependency policy.

Deferred: browser cookies, token renewal, nested groups, deny rules, ABAC, MFA, password reset/email,
email verification, external identity providers, federation, admin UI, WydClient,
SEWN and WydStitch. No founding-contract change was necessary.


## Server-side sessions

`login(username,password)` verifies the existing local credential, then creates a
fresh session. It returns `{token, session:{id,userId,createdAt,expiresAt}, user}`.
The token is 32 cryptographically random bytes encoded as 64 lowercase hex digits
(256 bits of entropy), with no embedded user information. A separate random UUID
prefixed `s_` is the immutable administrative session ID, not a bearer credential.
No caller-supplied token, session ID or expiry is accepted at login, preventing
session fixation. The implementation uses Node's crypto primitives, no JWT or new
dependency. Random opaque identifiers and digest-only persistence follow the
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Persisted sessions contain `{id,userId,createdAt,expiresAt,revoked,digest}`. Only the
SHA-256 token digest is saved, including in WydStore history; raw tokens are returned
only by login and are never logged or returned by other APIs. A fast digest is
appropriate for these high-entropy tokens; passwords still use Argon2id.

Times are integer Unix milliseconds from the trusted host clock. Host option
`sessionTtlMs` defaults to 3,600,000 (one hour), accepts 1–86,400,000 milliseconds,
and sets an absolute expiry, without sliding renewal. Resolution rejects tokens
at or after expiry, before creation, after revocation, or when the user is disabled.
Unknown/malformed, expired and revoked tokens all produce `GATE.SESSION_INVALID`.
There is no background timer: each resolution checks current persisted state.

- `resolveSession(token)` returns safe current identity and effective authorization.
- `logout(token)` atomically revokes that session; a repeated logout rejects the
  invalid token rather than restoring or silently accepting it.
- `revokeSession(id)` is an administrative revocation by immutable session ID;
  repeating it for a retained session is harmless.
- Disabling a user or changing their password revokes every session atomically;
  re-enabling does not restore sessions. Username/profile changes preserve them.

Login rechecks the verified credential and active user inside every CAS attempt.
Concurrent password changes/disabling cannot be bypassed by committing a stale
verification result. Logout and administration use the same WydStore CAS mechanism.
Successful login prunes expired/revoked entries from current state, then inserts;
at most 1,024 unexpired sessions may remain. Failed operations leave state intact.
History still retains prior session digests; history growth remains a capacity limit.

These are transport-independent bearer semantics. No HTTP endpoint, cookie,
remember-me feature or session token exchange protocol is added. Hosts must keep
bearer tokens private and avoid logging them. Revocation affects subsequent
resolutions; it cannot cancel an already-running operation or mutate an existing
ExecutionContext snapshot.

## Roles, groups and explicit permissions

Roles are `{id,name,permissions}`. IDs are generated UUIDs prefixed `r_`, independent
of mutable names; names have no authorization meaning and need not be unique.
Groups are `{id,name,members,roles,permissions}` with UUID IDs prefixed `g_`.
Members are existing user IDs; roles are existing role IDs. Nested groups and
unknown references are rejected. Both have create/get/update/delete operations.
Create requires all fields except generated ID; update accepts ID plus one or more
fields. List fields replace the complete set; duplicates are removed and values
sorted. Empty sets remove assignments.

`assignUser({userId,roles,permissions})` replaces a user's direct grants.
`getAuthorization(userId)` returns `{userId,roles,groups,permissions}`.
Effective permissions are the sorted, duplicate-free union of direct permissions,
direct-role permissions, group permissions and group-role permissions. Effective
role IDs include direct and group roles; group IDs reflect explicit membership.
All evaluation uses current state. Removing members, assignments or permissions
affects the next evaluation and next session resolution. Deleting a role also
removes its references from users/groups in the same atomic write; deleting a group
removes its membership and grants. No deny precedence, nesting or implicit grants.

Permission names use three lowercase dot-separated segments, each beginning with a
letter and continuing with letters, digits or hyphens, at most 128 characters total.
Example: `forum.post.moderate`. No wildcard, prefix or case-insensitive matching.
There are at most 64 roles and 64 groups; each direct role/permission list accepts
at most 64 entries and each group at most 256 members. Effective permissions may
combine more than 64 values.

**WydGate permissions are application/domain authorization. SEAM capabilities are
runtime authority.** Their similar spelling does not connect their grant stores.
Even a Gate permission literally named `store.records.write` never grants that
SEAM capability. Having that capability does not imply the Gate permission either.
Application/host logic explicitly checks domain permission membership as appropriate;
Gate does not intercept unrelated application operations or turn roles into policies.

```js
const role = await GATE.createRole({name:'Moderator', permissions:['forum.post.moderate']});
const group = await GATE.createGroup({name:'Editors', members:[user.id], roles:[role.id], permissions:[]});
await GATE.assignUser({userId:user.id, roles:[], permissions:['forum.post.read']});
const access = await GATE.getAuthorization(user.id);
// access.permissions: ['forum.post.moderate', 'forum.post.read']
await GATE.updateGroup({id:group.id, members:[]});
```

## Minimal profiles

Every user has a separate logical profile `{userId,bio}` in the directory's
`profiles` array. `getProfile(userId)` reads it; `updateProfile({userId,bio})` replaces
the biography, a well-formed Unicode string of at most 1,024 UTF-16 code units,
initially empty. No arbitrary JSON, URL/avatar fetching or HTML interpretation is
added. Existing `displayName` remains in safe user metadata for compatibility.
Profile changes cannot alter credentials, immutable IDs, sessions or permissions.

## Trusted ExecutionContext construction

Trusted host code resolves the session through an explicitly granted Gate context,
then constructs the application context with separately chosen runtime grants:

```js
// Host-only: registry and ExecutionContext must never be given to package code.
const identity = await hostGate.resolveSession(token);
const context = new ExecutionContext({
  publisher:'acme', package:'acme/forum', self:'forum-instance', app:identity.app,
  identity,
  capabilities:[], scopes:{} // Host policy alone supplies runtime grants.
});
```

`identity` contains `{authenticated:true,app,userId,sessionId,createdAt,expiresAt,
roles,groups,permissions}`. ExecutionContext validates its metadata shape and App
match, copies it and deeply freezes it. Default identity is null. It does not add
capabilities, scope, visibility, traversal or edit rights. No package-side context
factory or session insertion service exists; ordinary dispatch requires a branded
host-issued context. Do not trust a client-supplied identity object: resolve the
token using Gate and pass that result. The constructor is a trusted-host primitive,
not an independent verifier of an arbitrary identity assertion.

Construct per request/operation from fresh resolution. Identity metadata is a
snapshot, not a live permission cache: old contexts do not notice revocations or
role changes. The host must resolve again before subsequent authenticated work.

## Compatibility and limits

0.2-G changes the private directory schema to `wydgate.local/0.2` and requires the
expanded collection definition shown above. Existing 0.2-F directory/store schemas
are rejected without rewriting or deleting them. WydStore validates exact collection
metadata, so changing host JSON alone cannot migrate an existing store. Use a fresh
test/development store for 0.2-G; deployments with existing identities must retain
them until an explicit migration is implemented. No automatic migration or data
reset is provided by this milestone. The demo keeps Gate disabled and unchanged.

The 256-user, single-record aggregate remains a deliberately small local model.
All session and authorization writes retain whole-directory WydStore history,
including sensitive old credential hashes and session digests. JSON's 16 MiB
whole-store bound can therefore be reached quickly with frequent logins; this is
not a high-volume session backend. No pruning of history, scalable session store,
rate-limiting service, purge or migration framework is claimed.


## 0.2-H Session lifecycle integration

Gate 0.1.0-alpha.3 emits safe `Start`, `Authenticated`, `Logout`, `Timeout`, `End`
notifications after successful storage commits through the library host lifecycle
hook. Login emits Start/Authenticated; logout marks revoked before Logout/End.
Every authorized Gate call detects expired live Sessions and records revocation
before Timeout/End. Thus timeout processing is authoritative and request/service
triggered, not a Page-owned timer. Repeated or racing resolutions do not emit End
again because only the winning transition from unrevoked state emits events.
Administrative revocation, disable and credential changes emit End without Logout.

No token/digest/hash is in the notification. Host handlers receive Session metadata
under separately supplied SEAM authority; notification identity grants nothing.
Notifications are post-commit best effort and not replayed after process failure;
a failed observer cannot reactivate the Session or suppress subsequent End attempts.
The private directory schema remains `wydgate.local/0.2`; no migration/reset occurs.
Expiry now produces a retained WydStore revision when it changes state.

Wydgine can resolve a host-owned auth cookie using an explicitly supplied Gate
resolver context and recheck it before privileged Page service calls. It does not
implement an auth-cookie issuance/login endpoint. In-flight committed operations
are not cancelled by logout. See [events.md](events.md) for request and lifecycle
integration, reserved-cookie rules and browser verification limits.
