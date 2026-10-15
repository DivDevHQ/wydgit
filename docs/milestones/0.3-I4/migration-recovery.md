# Migration and recovery contract

I3 proves stopped, bounded, local JSON relocation with fresh destination validation;
it does not prove live migration, general provider transfer, power-loss recovery or
exclusive ownership across independent controllers. No zero-downtime promise.

## Provider transaction and durability

Proposed `wydhosting.operation/1` journal records operationId, kind, customer/App,
source/destination deployment and pool generation, expected registry revision,
resource ownership epoch, state, evidence digests and route revision. Secrets are
references, never journal payloads. A single-host exclusive provider-state writer
serializes mutations. Persist intent and completion with synced file+directory
replacement or a qualified transactional store; do not call a plain JSON write durable.
Ambiguous/corrupt journal blocks affected placements for operator reconciliation.

Migration states: `planned → provisioned → staged → quiescing → source-fenced →
final-transfer → destination-validated → route-committed → verified → retired`.
Any phase may become `blocked` or `rollback-required`. Commands are idempotent by
operationId plus expected revision; reread durable state after lost acknowledgements.
Stage can copy immutable execution inputs while source runs, but authoritative final
data transfer requires clean stop and exclusive write ownership. No runtime objects move.

## Free-to-paid workflow

1. Independently authorize subscription/tier change and App ownership. Verify supported
   providers, confidential backup, storage capacity, destination engine/library versions,
   package approvals, domains and rollback policy before mutation.
2. Broker provisions paid customer's restricted Linux account, approved directories and
   dedicated unit/cgroup. Destination process remains stopped/non-writing.
3. Stage sealed content/packages/config; provision trusted native dependencies separately.
   Validate canonical App/catalog/receipts and independently approve destination mappings.
4. Remove source traffic for migrating App, deny direct admissions and quiesce mutations.
   Stop using I0 and require clean stopped state; timeout/failed cleanup is not a valid
   I3 snapshot. In shared pools, keep siblings running if only this App retires.
5. Establish exclusive ownership: retire source lifetime, ensure no other process holds
   source resources, lock registry ownership, record source-fenced epoch. For external
   providers revoke/fence source credentials or block migration if impossible.
6. Perform final provider-consistent transfer. I3 local snapshot uses new private target;
   verify all hashes and trusted provenance. Keep source unchanged and stopped.
7. Restore into a new approved destination, rebind roots, validate owner/policy, recovery
   markers, packages and services. Allocate new runtime contexts/tokens. Record validated
   destination epoch; only then allow destination writes under exclusive ownership.
8. Start destination privately with approved same hostname policy; probe safe operation
   without admitting public writes. Commit provider route pointer/revision and atomically
   replace edge configuration where supported. During uncertain cutover return unavailable.
9. Verify real App operation and service access at destination, recording results without
   leaking credentials. Keep recoverable source/backup and routing revision.
10. Retire source placement/storage only after verification and retention approval.
    Shared source pool survives; new membership inventory is a later maintenance replacement.

Downgrade and paid-to-dedicated relocation reuse this transaction with additional
entitlement and shared-isolation consent checks. Never change canonical App identity
because UID, hostname, customer plan or directory changed.

## Provider qualification matrix

| Resource | I3 evidence | I5 requirement / refusal policy |
| --- | --- | --- |
| Canonical content, installed package resources/catalog/receipts | Copied and revalidated; source authoring dirs/node_modules excluded | Preserve separate authoring backup; destination executable dependency closure and publisher approval independently verified |
| Local JSON Store/history | Clean stopped transfer under data | Prove locks/consistent snapshot and crash restore; I3 bounds 8191 entries/depth32, 16 MiB/file, 128 MiB total and exact alpha.12 profile remain until versioned change |
| SQLite | Existing provider restart, relocation rejects | Explicit consistent backup/export with WAL/journal handling, version compatibility and restore tests; reject migration until profile qualified |
| Custom provider/data roots | Not general relocation support | Require registered adapter `preflight/quiesce/export/import/verify/fence/rollback` with declared consistency; no arbitrary hooks from publishers |
| Gate credentials/membership/persisted Sessions | Included intentionally via Store; restart may reopen same App session | Confidential encrypted transfer/backup, key access approval; decide session retention/revocation, never transplant operator/OS authority or transient Sessions |
| Files local / Stream local data+metadata | Local bytes/state copied; not full interrupted-upload recovery certification | Reconcile metadata/content and pending tickets, expiration, staging/orphans and checksums; incomplete upload policy tested |
| S3-compatible Files | Tool rejects | Independently approve destination namespace/credentials; coordinate exclusive writer, object version/checksum/list consistency and revocation; do not merely copy credentials |
| Search | Store-owned state copied, normal source indexing on startup | Verify canonical sources; rebuild when compatible/required under bounded capacity; stale index is not authoritative source data |
| Secrets/signing keys | Host routing/dependencies not supplied by manifest | Transfer only explicitly required App secrets by separate encrypted channel; retain/rotate service credentials deliberately; never copy provider/operator/package-author signing keys by default |
| Runtime contexts/tokens/adapters/listeners/I2 meters | Not portable, rebuilt | Old authority must fail; usage resets are documented, not durable commercial accounting |

I3 manifest hashes are unkeyed, not authentication. Recovery locks never auto-clear;
package fingerprint reconciliation remains restricted to approved transformations.
An independent process can reopen an old copy despite I0 token retirement. Provider
ownership enforcement is additional work, not a property of relocation metadata.

## Failure and rollback behavior

| Interruption | Required reconciliation |
| --- | --- |
| Before source fence | Source remains owner; discard only verified new staging; destination cannot serve writes |
| During final copy / worker restart | Destination incomplete and unrouted; revalidate source stopped ownership, restart transfer into a new target or trusted cleanup; never resume live source automatically |
| After destination starts, before route commit | Compare journal and actual ownership; one writer only; source stays fenced |
| Crash during route replacement | Read durable intended/committed revision and actual edge config; converge to one owner or explicit 503. Route atomicity alone does not fence data writers. |
| After destination accepted writes | Old source is stale. Stop destination and consistently transfer new state back under new epoch, or restore approved backup with explicitly acknowledged loss. Never just flip DNS/proxy back to stale source. |
| Supervisor/worker SIGKILL | Confirm cgroup death, acquire exclusive locks, inspect provider recovery state before activation; logical timeout is not proof of death |
| Power loss | Replay synced journal, inspect partial directories/units/proxy config and provider durability; block ambiguity. VM crash/power-cut tests required before claiming recovery. |
| Backup restore | Restore registry/config/secret references and provider-consistent data together, verify ownership/domain policy, use new generations/epochs, disable old workers/credentials; test disposable restore routinely |
| External source cannot be fenced | Migration blocked; maintenance/export procedure with proven exclusive access or provider-specific fencing required |

Multi-host later work needs authoritative distributed ownership and provider-enforced
fencing (epochs/leases enforced at the write boundary), clock/partition rules and
consensus/recovery testing. A route revision, PID, local lock or heartbeat is not
sufficient. I5 starts single-host and rejects cross-host automatic migration.
