# Scoped site policy and WydStore authorization — 0.3-J increment 3

Status: implementation in progress. Starting point: clean `develop/0.3`,
`7b48869`, platform/Wydgine/WydHosting alpha.17, WydClient alpha.11,
WydGate alpha.4 and WydStore alpha.3.

## Inventory and integration decisions

WydGate already persists an exact App directory, opaque accounts, separately
identified memberships (`active`, `suspended`, `left`), roles, groups, direct
permission assignments and revocable absolute/idle-bounded sessions in one
versioned WydStore record. Effective permissions resolve by account inside that
directory. Membership role labels have never been SEAM capabilities. No new
membership schema, implicit owner permissions or identity federation is needed.

The canonical registry retains the genuine branded initiating ExecutionContext.
Private dependency bindings use separate implementation identities, especially
`library:wydgate`; these must never replace the public caller in policy evaluation.
HTTP resolves the exact App before cookies/session and checks CSRF. Its public
adapter excludes BackOffice. Bound service dispatch and raw trusted handlers can
also reach state, so HTTP-only authorization cannot solve this mission.

WydStore already checks App/publisher/package/principal, optional installation,
exact collection scopes and per-operation capabilities before its JSON/SQLite
adapters. Transactions prepare every member before provider entry. Prepared request
caching is structural validation, not a suitable live policy cache. Local drafts
and unchanged `save()` perform no protected I/O. Schema/purge/recovery APIs remain
host-only package maintenance, outside ordinary canonical dispatch.

Minimal integration: a private evaluator registered only by canonical WydGate in
the existing loader; WydStore invokes it with its original caller and trusted
operation rule before each protected provider admission. No public policy service,
reusable decision token, parallel capability engine or new identity provider.
Installed Gate administration also checks current explicit permission and
BackOffice at its own resource boundary, including CAS retries. Native operator
Gate provisioning remains a separate host-only contract.

Host store access policy will use explicit `wydstore.authorization/1` metadata,
separate from collection data schemas and physical ownership. Existing stores
without this opt-in retain capability/ownership/scope-only behavior. Within a
policy-bound store, omitted collection/operation rules deny; public operations
must be explicit. Unknown/invalid policies reject. No stored records, revisions,
history or immutable accepted package artifacts need migration.

The existing stopped-App placement/generation fence remains authoritative.
Execution acquisition needs an optional host-supplied resolved identity, without
changing any installed grants. Every protected action must independently verify
that identity against current Gate state. AccountAdmin/HostAdmin and managed
hosting remain unavailable/deferred to 0.4.

## Scoped Gate policy (stages B/C)

The loader accepts a single private evaluator from the approved canonical
`wydgate` implementation. Its private `authorizeSitePolicy(caller, requirement)`
checks the original live, server, App-bound context before and after evaluation.
It never exposes a policy result or token through portable service discovery.
The requirement comes from trusted implementation/configuration, not operation
input. Gate reads its current validated directory for each evaluation.

Required facts: exact configured App, authenticated user/session, matching persisted
session creation/expiration, active account, unrevoked absolute/idle-valid session,
exact current membership ID in that App and active membership. The required
permission must appear in current direct, group or role assignments. Role names,
cached identity permission arrays and membership labels supply no permission.
Missing/invalid/unavailable policy denies. Account/host policy is not enabled.

Installed Gate administrative account, credential, session, profile, role, group
and membership operations require BackOffice plus the explicit permission named
by their existing operation capability (for example `gate.roles.manage`). These
are independently checked approvals even when their strings match. The existing
owner/administrator membership restriction on roster management also remains.
Current-account/membership and self-service, login, registration and recovery
retain their existing distinct checks. Native contexts with `installation:null`
retain trusted operator provisioning; packages cannot choose their installation.
They are not a browser or package-facing policy exemption.

Administrative mutations repeat policy checks on every compare-and-write retry;
permission changes during credential hashing cannot authorize a later write.
The host placement acquisition accepts optional `identity`, still with exactly
the receipt-approved grants and the existing durable generation guard.

## WydStore policy (stages D/E)

Trusted store definitions accept this optional operational policy, outside physical
ownership and persisted collection schemas:

```json
{
  "authorization": {
    "schema": "wydstore.authorization/1",
    "collections": {
      "published": {
        "get": {"contexts":["FrontEnd","BackOffice"],"public":true},
        "query": {"contexts":["FrontEnd","BackOffice"],"public":true}
      },
      "records": {
        "get": {"contexts":["FrontEnd","BackOffice"],"permission":"content.records.read"},
        "update": {"contexts":["BackOffice"],"permission":"content.records.write"},
        "history": {"contexts":["BackOffice"],"permission":"content.history.read"},
        "transaction": {"contexts":["BackOffice"],"permission":"content.records.write"}
      }
    }
  }
}
```

Permission names above are ordinary assignments in Gate's existing three-part
permission grammar, not new production service APIs or automatic grants. A trusted
operator explicitly chooses them. Rules cover `get`, `query`, `count`, `metadata`,
`history`, `create`, `update`, `delete`, `transaction`. Inside a policy-bound store,
omitted operations or collections deny; `{collections:{}}` denies all access.
Each rule requires one or both supported server contexts and exactly one of an
exact permission or `public:true`. Unknown versions, keys, collections, operations,
wildcards, empty/duplicate contexts and ambiguous rules reject configuration.
Public means no Gate membership requirement, while SEAM/ownership/scopes still apply.

Authorization sequence: validate genuine current caller, exact App/publisher/package/
principal/optional installation and exact collection scope; check per-operation
capability and bounded request/schema; select the trusted operation rule; evaluate
fresh Gate state if required; recheck original caller/ownership/lifetime; enter
provider. Transaction envelope and every member's actual operation/collection must
pass before any mutation. Request preparation caches no authorization decision.
Canonical versioned calls, legacy calls, native raw resource handlers and cached
facades use the same resource implementation. Missing/foreign ownership, policy
denial and Gate failure return sanitized `STORE.DENIED` before reading target records.
Unknown resources covered only by genuinely host-approved scopes retain existing
`STORE.UNKNOWN_STORE`/`STORE.UNKNOWN_COLLECTION` diagnostics.

FrontEnd and BackOffice share the same owner-derived physical resource. Context
does not enter the ownership hash or split the database. Existing App/publisher/
package/store/principal/installation distinctions remain intact. Identical store
names and colliding account/session/role IDs do not merge Apps. Public operation
rules work without Gate; absent store policy retains the earlier explicit
capability/ownership/scope contract. Protected stores have no permissive fallback.
The Gate directory must retain its private dependency identity and unprotected
implementation storage contract; making its reads require its own evaluator
would be a recursive configuration error that fails initialization.

Cached facade operations revalidate. Loaded snapshots remain local data;
unchanged `save()` and unsaved draft edits still perform no I/O, so cannot prove
current permission or erase previously disclosed data. Dirty saves, deletes,
history, queries and new reads always dispatch. JSON-only service boundaries reject
native handle injection; copied record IDs/snapshots are resolved under the new
caller's own binding. Native hosts must keep bound facades in their initiating
domain rather than deliberately passing their executable JavaScript closures to
another domain. Ordinary Wydgits cannot import this native facade/registry or
exchange native service handles through canonical results.

## Freshness and lifecycle

There is **no allow-decision cache** or grace period. Each new protected operation
reads the current validated Gate record. Completed policy changes, group removal,
role downgrade, suspension/departure, account disablement, logout, revocation and
absolute/idle expiry deny subsequent admissions, including through an old facade.
Policy evaluation does not refresh session last-seen activity; trusted session
resolution retains that responsibility. Background work must retain its initiating
session and live execution; this increment adds no autonomous service identity.

This is admission freshness, not cancellation. A policy read already admitted before
a concurrent change may complete; Gate state and another store are not one atomic
transaction. Each batch member is checked before provider entry, without claiming
an atomic cross-directory policy snapshot. Native work already admitted may finish
or commit after revocation/fencing. There is no promised rollback/cancellation of
already started operations. The existing stopped-App, drained-writer maintenance
contract remains required; no live distributed cutover is introduced.

Actual installation acquisition binds the supplied identity to the exact App and
receipt-approved authority. Placement replacement, relocation, package update,
retirement and retained uninstall/reinstall invalidate old service/record handles
through existing durable generation guards. New executions evaluate current Gate
state; they inherit no old decision. Context/identity/grants cannot be supplied as
canonical operation fields. Reserved AccountAdmin/HostAdmin remain unavailable.

## Qualification and final contract

Stage B/C focused run: 57 passing tests across new scoped-policy, membership,
authorization, canonical-service and real HTTP tests. Sandbox file-level reports
are not counted as security qualification. Unrestricted baseline: 1,358 passed.
Stage D/E expanded focused run: 88 passing tests (28 dedicated policy/provider/
lifecycle tests plus existing provider and BackOffice-placement regressions).
Both adapters pass the same logical contract, including real separate-process
restart, physical same-name isolation in a shared trusted root, native directory
unavailability, history/batches, current group/direct/role policy, inherited
methods, old-generation handles, package update and retained uninstall/reinstall.
The equal-principal-ID test deliberately seeds colliding IDs into two independent
native test directories; it does not implement shared accounts or federation.
Final acceptance mapping and version metadata follow in stage F.
