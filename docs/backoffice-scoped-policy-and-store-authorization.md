# Scoped site policy and WydStore authorization — 0.3-J increment 3

Status: implemented site-level security foundation, with qualification and limits
below. Starting point: clean `develop/0.3`,
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

Host store access policy uses explicit `wydstore.authorization/1` metadata,
separate from collection data schemas and physical ownership. Existing stores
without this opt-in retain capability/ownership/scope-only behavior. Within a
policy-bound store, omitted collection/operation rules deny; public operations
must be explicit. Unknown/invalid policies reject. No stored records, revisions,
history or immutable accepted package artifacts need migration.

The existing stopped-App placement/generation fence remains authoritative.
Execution acquisition accepts an optional host-supplied resolved identity, without
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
Host operation rules are immutable for a loaded registry. Changing them requires
a stopped host, closing old registries and loading reviewed configuration; no live
host-policy file watcher or automatic accepted-catalog reconciliation is provided.
Gate membership/assignment/session changes, in contrast, are reread on each action.

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

## Versions, migration and compatibility

Platform/Wydgine/WydHosting advance to **0.3.0-alpha.18**, Gate to
**0.1.0-alpha.5**, Store to **0.1.0-alpha.4**. Gate and Store retain canonical API
1.0.0 but require platform `^0.3.0-alpha.18` for these trusted registration hooks.
WydHosting retains its exact engine dependency; Search/Stream peer compatibility
adds this engine version. Lockfile, active development fixture pins and displayed
sample revision follow those versions. WydClient remains **0.1.0-alpha.11** and
WydSUB 0.1; no client implementation/bundle or historical artifact is changed.

No account/membership/session/data/ownership/catalog schema changes are needed.
`wydstore.authorization/1` is a versioned **host operational policy**, never part
of record bodies, collection schemas, metadata results or owner-derived filenames.
Adding it to a standalone trusted store configuration does not rewrite its records,
revisions, history, App IDs, memberships or physical resource identity. Existing
stores without it retain their prior capability/ownership/scope contract. This is
an explicit protected-resource classification, not fallback for a failed lookup.
An older Store rejects the new configuration field; new Gate/Store reject an
older engine at startup. No ambiguous membership becomes an administrator and no
permissions are assigned automatically, even to an owner.

For a new installed application, provision the private Gate directory and reviewed
store policy **before** accepting package installation. For legacy installed Apps,
do not edit accepted host configuration/catalogs/receipts in place: existing base
fingerprints reject that as `PACKAGE.DRIFT`. No arbitrary host-policy reconciliation
or production migration utility is added. Adoption on such Apps requires a separate
reviewed, stopped-App configuration reconciliation increment; remain safely denied
instead of rewriting acceptance hashes. Back up complete source/data/history through
trusted operator procedures. External/live installations were neither inspected
nor migrated. Existing installed Gate administrative code must use trusted
BackOffice placement, enabled membership and explicit current permissions under
its independently approved capabilities. A legacy administrator label no longer
satisfies those installed operations.

JSON retains its whole-document validation, cooperating local lock/queue, synced
temporary file and atomic rename/directory synchronization. SQLite retains fixed
prepared SQL, native transactions, FULL synchronization and rollback journaling.
The adapters' existing locking, capacity, interrupted-write/recovery and local
filesystem assumptions remain different. Logical authorization parity does not
qualify power-loss durability, distributed writers or OS-enforced tenant isolation.

## Acceptance mapping

The three dedicated files are `test/scoped-policy.test.js` (Gate policy and an
asynchronous credential-write revocation race), `test/scoped-store-authorization.test.js`
(the same logical resource contract against each real provider), and
`test/scoped-policy-lifecycle.test.js` (separate processes and actual installed
placement/package lifecycle). No new provider is mocked.

| Governing case | Qualified site-level evidence | Partial/deferred boundary |
| --- | --- | --- |
| STO-01 | Shared owner-derived store; FrontEnd read, BackOffice write, explicit public read and independently denied policy/capability/context | No generic record-owner ACL or cross-package sharing is added |
| STO-02 | Foreign App/publisher/package/principal denial, equal store names, shared trusted root and colliding account/session/role IDs | Managed account/provider and OS isolation remain 0.4 |
| STO-05 | Forged request identity/decisions, branded-caller checks, native-handle injection, copied identifiers and old generation/record/service handles | Native hosts remain trusted; they must not deliberately distribute executable bound closures |
| GAT-01 | Exact independent App directories, memberships and permissions; equal names/IDs never merge authority | Same-principal fixture collisions do not implement cross-App account federation, account/host membership or SSO |
| GAT-02 | Capability and live permission intersect; owner/admin names do not grant either | No role-to-SEAM mapping or grant expansion |
| GAT-03 | Every admission rereads persisted state; expiry/idle, logout, revocation, suspension/departure, disablement, role/group changes, missing/corrupt/unavailable Gate deny | Work admitted before a concurrent change can finish; no native cancellation or atomic multi-store policy transaction |
| ADM-01 | Installed Gate operations and protected store reads/history/metadata/batches/mutations enforce at resource entry; FrontEnd HTTP administrator still denied | UI/module contribution framework and full administration remain unimplemented |
| CTX-05 | Neutral inherited method keeps original caller; BackOffice-restricted receiver and privileged native handle deny FrontEnd; library-private Gate binding stays private | AccountAdmin/HostAdmin unavailable; no privileged hosting qualification |
| CTX-06 | Actual replace/relocate/update/retire/reinstall invalidates old generations and cached handles; replacement evaluates current Gate state | Existing stopped-App drain requirement; no live cutover |
| LIF-01 | Retained JSON/SQLite records/history survive lifecycle; existing shared/protected dependency regressions retained | Wider package-migration/purge and account/provider recovery gates remain open |

Mission adversarial checks 1–5 and 8–14 are covered by Gate/store intersection and
actual placement tests; 7 by independent role names/IDs. Check 6 is qualified for
the exact same principal IDs in two separately trusted native fixture directories
with independent membership/permission outcomes; shared production authentication
accounts across Apps are unsupported. Check 15 qualifies copied IDs/snapshots and
rejection of native handle injection through the portable boundary, subject to the
native-host limitation above. Checks 16–19 use actual stale generations/replacement
and inherited/BackOffice receiver attempts. Checks 20–24 cover public reads,
authorized writes, history and batch denial and same-name/shared-root storage.
Checks 25–27 include real separate-process JSON/SQLite restart, removed Gate and
temporarily unavailable backing files. Checks 28–30 retain full client/SUB,
standalone-engine and reserved-context regressions. No account/provider domain,
federation, native/mobile or complete BackOffice UI qualification is claimed.

Host-only schema, export/checkpoint, purge and recovery APIs remain outside the
portable service registry with their existing independent operator capabilities,
exact owned-resource/checkpoint checks and lifecycle barriers. There is no ordinary
Wydgit recovery/export/schema operation to authorize through Gate in this increment.
This is not a user-facing Gate-authorized package installer or recovery console.

## Remaining limits and next increment

The native host, approved libraries, configuration and local filesystem maintenance
writers remain trusted. No OS containment, malicious-native-code sandbox or
cross-domain credentials are supplied. Errors contain stable denial codes and no
record, credential, path, SQL or reusable policy token. Existing host operational
counters and Gate security-event ring remain available; no new secret-bearing log
or durable per-store policy audit ledger is introduced. Collection permission rules
do not infer arbitrary record-level ACLs. Existing budgets, retention and `save()`
semantics remain unchanged.

Recommended next 0.3-J increment: a narrow, reviewed stopped-App policy-configuration
reconciliation contract, followed by the site BackOffice action/UI framework using
these boundaries. Do not implement it by granting membership permission to mint
installer capabilities. Account/provider provisioning, privileged brokers and
managed WydHosting qualification remain 0.4. The independently open
`WYDGINE-0.3-HTTP-LIMIT` / intermittent `SEWN.LIMIT` HTTP 500 issue remains open.

## Final verification

Verified on 2026-10-18, Node **24.21.0**, on `develop/0.3`:

- Baseline `npm test`: **1,358 passed** from the original clean checkpoint.
- Final `npm test` (including `build:client`): **1,386 passed**, zero failed,
  cancelled, skipped or todo (78.728 seconds). This includes client/SUB,
  standalone, real HTTP, provider, security and package lifecycle regressions.
- `node --test test/scoped-policy.test.js test/scoped-store-authorization.test.js
  test/scoped-policy-lifecycle.test.js test/backoffice-placement.test.js
  test/wydstore-conformance.test.js test/wydstore-foundation.test.js`:
  **88 passed**, zero failures; **28 dedicated new tests**, 13 per provider plus
  common invalid-policy and asynchronous revocation tests. Providers are real JSON
  and SQLite; restart cases use separate Node processes.
- Final dedicated/version-sensitive run with `test/launcher.test.js`,
  `test/transport.test.js`, `test/package-boundaries.test.js` and
  `test/wydstore.test.js`: **60 passed**, zero failures.
- `npm run check`: **passed**, three complete pages, 42 internal links and unique
  anchors. Relative Markdown file-link check over changed documents: **138 checked,
  zero missing**. External URLs were not revalidated.
- `npm ls --all --json`: **passed**; workspace versions/dependencies/peers agree.
  `git diff --check`: **passed**. Regenerated client/regex artifacts have no tracked
  difference; historical client distributions and public artifacts remain unchanged.

The first version-finalization full run had 1,380 passing and six failing tests:
old version assertions, an old launcher verified-version argument and the old
next-unapproved-version fixture. Expectations were synchronized to the new release
without weakening any security assertion, followed by the complete passing run.
Earlier new-test failures were fixture syntax/import/setup errors; the accepted
configuration drift barrier was preserved by provisioning policy before installation.
Sandbox file-level/native-process failures are not functional qualification evidence;
the counts above use unrestricted local test execution. No privileged OS changes,
deployment, remote push, live data or secret changes occurred.

Implementation commits: `e7382aa` (Gate/SEAM trusted policy) and `36f4351`
(protected Store policy and provider/lifecycle qualification). Version/documentation
finalization is a separate local commit. No final passing run closes the existing
HTTP reliability issue or changes any 0.4 qualification gate.
