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

## Qualification and final contract

Stage B/C focused run: 57 passing tests across new scoped-policy, membership,
authorization, canonical-service and real HTTP tests. Sandbox file-level reports
are not counted as security qualification. Unrestricted baseline: 1,358 passed.
Store rules, provider/lifecycle evidence, final acceptance mapping and version
metadata will be completed in the following stages.
