# WydGate identity and membership — 0.3-G

The [modular BackOffice action framework](backoffice-action-framework.md) adds
installed site-scoped action declarations, private discovery and trusted service
invocation in alpha.20. It preserves the independent authority and lifecycle checks;
UI, AccountAdmin and HostAdmin remain deferred.

The [reviewed package-policy foundation](reviewed-package-policy-reconciliation.md)
adds native stopped-App plan/review/apply with separate policy revisions and durable
host approval. Package requirements, execution placement, SEAM, Gate membership and
store ownership remain independent; direct policy-file edits still fail drift checks.

The [0.3-J scoped-policy increment](backoffice-scoped-policy-and-store-authorization.md)
supersedes the installed-administration authorization described at this historical
alpha.4 checkpoint. Gate alpha.5 requires BackOffice, current explicit permission
and independent SEAM authority; role labels alone no longer authorize those actions.
Existing account/membership data schemas and self-service contracts remain intact.

> I0 hosts independent Gate directories and Session resolvers per App. Membership and
> valid cookies from one App do not authenticate another. No SSO is added; domain and
> cookie-origin routing remain I1. See [I0](milestones/0.3-I0/README.md).

WydGate `@wydgit/gate@0.1.0-alpha.4` provides canonical API `1.0.0`.
Accounts establish authentication identity; membership describes an account's
relationship with the configured App; SEAM independently grants execution authority.
An owner or administrator membership grants no service capabilities, storage access,
package installation, platform administration, or access to another App.

Accounts use opaque `u_` UUIDs. Memberships use separate `m_` UUIDs with an immutable
App ID and account reference, status (`active`, `suspended`, `left`), role (`owner`,
`administrator`, `member`) and optional display name. Real names and email are not
required. Usernames are unique only within this identity directory; no email,
provider claim or age assertion merges accounts. Existing roles, groups, profiles,
and domain permissions remain supported and never populate SEAM grants.
An App owner is a membership fact. A platform administrator is a separately trusted
host principal. Neither substitutes for the other.

The proposed [execution-context and domain architecture](execution-contexts-and-administrative-domains.md)
reuses membership/roster/role Wydgits at site, future account and host scopes. These
are separately trusted domain bindings, not automatic federation or capabilities.
The current API below remains App-scoped; hosting customer accounts are distinct
from Gate authentication accounts.

## Host configuration and storage

Keep the existing private WydStore identity directory, host dependency binding,
and ownership `publisher: wydgit.core`, `package: library:wydgate`, with the exact
configured App. Add an **optional** field to its collection definition:

```json
"membership": {"type":"object"}
```

Enable the membership extension in the WydGate host options:

```json
{
  "app":"myApp", "store":"identity", "collection":"directory",
  "sessionTtlMs":3600000, "sessionIdleMs":900000,
  "membership": {
    "registration":"disabled", "maxMembers":256,
    "passwordMinLength":15, "bootstrapPrincipal":"host:gate",
    "recoveryTtlMs":900000, "invitationTtlMs":86400000
  }
}
```

Registration choices are `disabled` (default), `invitation-only`, and `open`.
Invitation-only registration requires both the invited username and an unexpired
256-bit random invitation secret. Only its hash persists. The explicitly authorized
inviter receives the secret for trusted private delivery; it must never be logged or
stored in Wydgit properties. Reissuing retires earlier invitations; consuming an
invitation and creating account/membership commit together. Knowing a username does
not permit claiming its invitation.
Omitting membership retains the legacy account API and disables new membership
operations. Package installation does not alter registration policy or create
accounts. Host ceilings: 256 accounts/members, 1,024 live sessions, password minimum
15–128 code points, absolute session lifetime at most 24 hours, idle lifetime no
longer than absolute lifetime, recovery lifetime at most 15 minutes, invitation lifetime at most 24 hours. Defaults are
one-hour sessions and idle lifetime equal to absolute lifetime. Passwords always
retain the existing upper size and Unicode bounds.

The aggregate remains `wydgate.local/0.2`; its optional membership extension is
`wydgate.membership/1`, containing `app`, `members`, `invitations`, `audit`,
`bootstrapped`, and optional `challenges`. Each challenge has `c_` UUID, account
reference, SHA-256 digest, creation/expiry times and consumed flag. Audit entries have integer
millisecond time, event name and optional account reference. No secrets, IPs,
contacts, delivery failures, browser claims or native handles enter public records.

The bounded directory arrays provide exact username, account, session-digest and
membership lookup. There is no claim of a scalable database index. Accounts,
credentials, sessions, memberships, invitation consumption, owner claims and
recovery consumption share one WydStore revision. JSON and SQLite compare-and-write
provide the same atomicity across independent registries/processes. Conflicts
reread and revalidate up to three times; exhaustion fails closed. No multi-record
transaction assumption, process-local ownership lock or query-then-create race is
introduced. Directory and recovery schemas are validated before acceptance.

Existing exact WydStore collection metadata cannot be changed in place by editing
host JSON. Use a newly provisioned directory for the membership extension, or retain
the existing schema until a separately reviewed data migration is available.
There is no automatic reset, migration or destructive account removal.

## Canonical contracts

Invoke via `SERVICES.Invoke("wydgate", "1.0.0", operation, input)` with separately
approved capability and exact `scopes.wydgate: [configuredApp]`. The portable
`createGate` facade provides camelCase methods; existing legacy calls remain
supported for the original operations only. New operations require the exact API
version; the facade pins 1.0.0 for them. App IDs, credential hashes, persistence handles, capabilities and
caller identity cannot be supplied as operation fields.

| Operations | Required capability | Input / behavior |
| --- | --- | --- |
| `register` | `gate.registration.use` | username, password, optional displayName/invitationToken; atomic account and membership; trusted policy |
| `current-account`, `current-membership` | `gate.accounts.use`, `gate.members.use` respectively | empty input; current verified session subject |
| `update-account`, `update-membership` | corresponding self-service capability | displayName only |
| `change-own-password` | `gate.accounts.use` | currentPassword, password; rechecks credential in CAS; revokes sessions and recovery |
| `disable-account` | `gate.accounts.use` | empty; disables own account and revokes sessions/recovery |
| `join-app`, `leave-app` | `gate.members.use` | empty; policy-bound joining / terminal leaving; owners cannot self-leave |
| `list-sessions`, `revoke-own-session` | `gate.accounts.use` | empty / session ID; returns only own session IDs and times |
| `list-members` | `gate.members.manage` | offset 0–256, limit 1–50, defaults 0/20; safe App-scoped members and total |
| `manage-member` | `gate.members.manage` | membership ID, status and/or role; cannot manage owner; status/role transitions revoke sessions |
| `invite-member` | `gate.members.manage` | normalized username; returns a private one-use invitation secret and expiry |
| `bootstrap-owner` | `gate.members.bootstrap` | username, password, optional displayName; additionally requires configured host package/principal, no installation, and `scopes.wydgateBootstrap: [app]` |
| `request-password-reset`, `reset-password` | `gate.registration.use` | username / token and password; described below |

`login`, `authenticate`, `resolve-session`, `logout`, administrative account and
credential management, roles/groups and profiles preserve the existing contracts
and capability checks. Login optionally accepts `previousToken` for an atomic
rotation; the browser supplies this through the trusted transport, never through
package properties or submitted fields. A login result's token is a secret intended
for trusted credential handling; it must never be rendered or stored as Wydgit data.

Membership self-service trusts no supplied user ID or role. It locates the persisted
session by the host context's user/session IDs and verifies active account,
absolute/idle lifetime and membership status again. Sensitive mutations repeat
these checks on every revision retry. Authentication/session resolution recheck
membership suspension. Browser re-login rotates/revokes the old session; password
change, reset, account disable and membership suspension revoke sessions.

## Browser and SEAM trust transition

The existing generic component renderer and approved transfer binding render the
package forms. WydGate's canonical transport handles their bounded URL-encoded
bodies, rejects duplicate/unapproved fields, and invokes the existing service
implementation. Wydgine contains no membership form layout or prototype-specific
login behavior. Password inputs always render empty, with portable autofill hints
and character bounds. Returned responses contain no passwords or session tokens.
Public registration returns the same accepted projection for success and policy or
duplicate rejection; it does not expose an account record or username availability.
Public authentication failures share the existing generic error.

Host `execution.gateContext` must explicitly grant session resolution for the App.
It is separate from package grants. A new opaque token is accepted by the kernel
only after trusted Gate resolution, then issued as `__Host-wydgit-auth`, `Path=/`,
`HttpOnly`, `Secure`, `SameSite=Lax`, bounded Max-Age. Anonymous cookies and their
server-side session records are retired on successful authentication and logout.
Retirement releases resolver capacity, invalidates retained anonymous authority
and emits Session.End once. Failed login preserves the anonymous session so its
approved form can be retried. HTTPS is required for browser deployments; Secure
is unconditional and no forwarding header controls it. This implementation does
not add proxy trust configuration, TLS, hostname routing or distributed cookies.
The disposable HTTP demonstration manually supplies cookies to loopback fetch;
it tests real transport behavior without pretending an HTTP origin is production TLS.

CSRF tokens bind a private session secret to App, Page, target and approved library
operation. Missing, wrong-session, stale or cross-binding submission tokens fail
before credential handling. Bodies are limited to 4 KiB and transfer reading to ten
seconds. All HTTP Page responses are no-store to avoid caching identity-bound forms.
Invalid cookie sessions are rejected and their auth cookie is expired so the next
public request can establish an anonymous session. Logout/password-change delete auth cookies after committed revocation. The transport
can transition cookies only through host methods; ordinary package code has no
reserved-cookie write access. The same HTTP pipeline remains usable without Gate.

Trusted Gate resolution produces the existing identity facts plus membership ID,
active status and membership role. The host passes these frozen facts into a branded
ExecutionContext with **separately approved** capabilities, scopes and installation
receipt. Roles are never converted into grants. Installed administration requires both an explicit SEAM capability and a freshly
validated owner/administrator membership; the check repeats inside every CAS retry.
Package code receives only bound
services; it cannot construct contexts or reach the registry, kernel ports or private
storage credential. Contexts are snapshots; the host re-resolves cookies before each
request and sensitive operation. Revocation cannot undo an already committed action.

Host `execution.authenticatedPages: [pageId]` optionally requires authentication
before rendering chosen Pages. This does not issue grants or infer roles. Membership
operations enforce their own live session/membership checks.

## Recovery, audit and retention

No mail service or contact verification is added. Without a trusted delivery adapter,
`request-password-reset` returns `{accepted:true,available:false}`, creates no token,
and `reset-password` is disabled. Nothing claims delivery occurred.

A host may supply `libraryAdapters.wydgate.deliverRecovery` to `createHostApp`, or
`adapters.wydgate.deliverRecovery` to `initializeHost`. It must be a trusted function
which resolves the account to a preconfigured, verified delivery channel. It receives
only App/account/username, a transient token and expiry. The host must keep it private
and must not log its input. Merely supplying arbitrary client contact details is not
a trusted delivery channel. The portable library configuration cannot contain this
function and packages cannot install it.

Configured recovery returns `{accepted:true,available:true}` for existing and unknown
accounts. This reports service availability, not delivery. Only hashed 256-bit random
tokens persist. Issuing a new challenge retires prior ones. Delivery exceptions retire
the issued challenge and use the same public response. Expiration and one-use checks
occur inside credential-replacement CAS; concurrent reset attempts have at most one
winner. Credential changes/disable/suspension invalidate existing challenges.
Reset submission is available through the canonical API; a reusable browser reset
form and email delivery implementation are not included.

Current security audit is a host-only ring of 128 events; there is no package audit
query. Membership mutations and successful session/security transitions audit in
the same revision. Non-mutating authentication and failed-authentication audit writes
are best effort, and cannot undo a completed security transition. Events include
registration, bootstrap, invitations, login/failure, logout, timeout, revocation,
password changes/resets, disabling/leaving, and member administration. No credential,
reset token, token digest, contact or IP appears in audit.

WydStore history retains old directory snapshots, including verifiers and hashed
challenges/sessions. The current ring does not bound historical storage. Session
activity writes last-seen times, so this small aggregate is not a high-volume session
backend. Host-owned WydStore retention and a future reviewed account-removal operation
are explicit extension boundaries; no package deletion/purge authority is added.
Attempts are capped at 30 per minute per Gate runtime instance/App for authentication, registration
and recovery separately; Argon2 retains its two-job concurrency bound. This coarse
limiter is intentionally bounded and independent of account existence. Multiple
processes share persistent sessions/revocation but have separate rate counters.
Production hosts may add trusted ingress abuse controls; no distributed limiter or
session service is claimed.

## Installation, bootstrap and demonstration

Provision Gate and private WydStore first. Use the existing `planPackageInstall` /
`applyPackageInstall` or operator installer with `examples/membership`, placement,
manifest grants and operator installation context. Its symbolic `current-app` scope
resolves only to the host-configured App; arbitrary App selection is rejected.
There are no package-owned storage mappings. Installation receipts, rollback and
one-package-principal-per-Page rules remain in force.

The installable includes `divdev/login`, `divdev/register`, `divdev/logout`,
`divdev/account-profile`, `divdev/change-password` and a section wrapper.
`divdev/member-list` is supplied but deliberately not attached or granted by the
default package; an explicitly approved administrator package composition can attach
it and request `gate.members.manage`. No role can approve that capability for itself.

A trusted host bootstraps exactly once by constructing its configured host principal,
granting `gate.members.bootstrap` and exact `wydgate`/`wydgateBootstrap` scopes, then
calling `bootstrapOwner` with credentials obtained through a trusted operator input.
No production credentials are hardcoded or generated at package installation.
Competing ownership claims are serialized by the directory revision.

Run the self-cleaning demonstration from the repository root:

```sh
node examples/membership/demo.js json
node examples/membership/demo.js sqlite
```

It installs the package into a temporary ordinary App, generates random credentials,
bootstraps an owner, registers through an actual browser-form POST, logs in, requires
an authenticated Page, rejects anonymous and bad-CSRF requests, rotates the cookie,
updates a profile, logs out, rejects the former session and denies another App's
member query. It removes the temporary App/storage on exit.

Deferred: shared cross-App account directories and multi-App routing, provider
credentials/account linking, verified contacts, OAuth/OIDC, passkeys/WebAuthn,
AgePass and identity proofs, external delivery implementations, ownership transfer,
rejoining a departed membership, scalable indexes/session storage, automatic migration,
retention/purge automation and administration consoles. Age proof must never imply
legal identity without a future explicit trust contract. No identity documents are
collected. These extensions must preserve independent identity, membership and SEAM.

## Hostname selection and credentials (I1)

The [I1 routing contract](milestones/0.3-I1/README.md) selects the exact active App
before authentication, CSRF, execution, services and assets. Hostname mapping is
trusted operator configuration, not a package permission or proof of ownership.
Public HTTPS requires an exact approved proxy peer and validated effective origin.
Credentials stay host-only: reserved __Host-wydgit-* with Secure for HTTPS, reserved
wydgit-* for explicit local HTTP. Deletion uses matching attributes. Cross-App Gate
replay is denied; SameSite does not replace exact Origin and session CSRF checks.
Parking routes use an ordinary service-free App and consume/issue no credentials.
There is no cross-App SSO, tenant routing API or automatic domain verification.
