# Customer, plan, pool and App model

Proposed provider schema `wydhosting.registry/1`; not an existing persistence API.
Canonical hierarchy: **Customer → Plan → Pool(s) → App(s)**. Plans are reusable policy
records; each customer subscription pins a plan revision, never silently follows edits.

## Separate records and constraints

| Record | Required fields / invariants |
| --- | --- |
| Customer | Opaque provider `customerId`, lifecycle state, subscription reference; separate operator-approved contact/account associations |
| Plan | `planId`, immutable revision, tier free/paid/dedicated, App count, pool count and resource entitlements; no SEAM capability grants |
| Subscription | `customerId`, `planId`, revision, effective state; billing integration deferred |
| Linux identity | Optional `accountId`, numeric uid/gid, managed home, provisioning operation; absent for free customer, required per paid customer; no login shell by default |
| Pool | `poolId`, hostId, mode shared/dedicated-customer/dedicated-app, uid/gid, desired generation, desired state, immutable inventory revision, OS resource policy |
| Placement | `appId`, customerId, poolId, deploymentId, ownership epoch, state; exactly one write owner per canonical App/resources |
| App registration | Exact canonical `appId`, customerId, approved source path, deployment snapshot digest, package approval reference, service-root and external namespace references |
| Domain | Normalized exact hostname, verification/approval evidence, appId, route state, placement epoch and revision; unique active hostname; no identifier-derived authority |
| Gate membership | App-owned user/membership facts stay in Gate data; provider links, if any, require independent authorization; never infer uid/operator rights |

All references are validated before mutation: reject unknown fields/schema, case
collisions in App inventories, unknown owners, duplicate active placements, overlapping
paths/namespaces, entitlements overflow and route targets absent from the approved pool.
Identifiers are bounded opaque strings (provider IDs 1–128 ASCII letters/digits/_/-);
canonical App IDs retain existing `validId` rules. Hostnames use the engine parser.
Use revisions and compare-and-swap for registry changes. The single-host provider
writer holds an exclusive state lock; transactional journal durability is specified in
[migration/recovery](migration-recovery.md). No distributed consensus is implied.

## Tier guarantees

| Tier | Default placement | Enforced boundary and shared risk |
| --- | --- | --- |
| Standalone | One selected App per independently managed Node process | Engine logical security; host/process manager supplies OS policy |
| Free | One App/customer, unrelated customers in a provider-owned restricted worker identity | Per-App SEAM, service ownership, bounded admission/output; shared event loop, heap, native modules, UID and crash fate. No arbitrary publisher Node or mutable publisher deployment. |
| Paid | Multiple Apps/customer, one restricted Linux uid and dedicated process/pool/customer | Process/uid access separation between customers, cgroup pool budgets; same-customer Apps retain separate SEAM identities but share process risk |
| Higher | Dedicated App process or pool, optionally container/server | Per-site failure/resource separation as configured; containers share kernel and require separately qualified policy; dedicated server strongest placement boundary here |

Plans set pool and App reductions; they do not expand package capabilities. A free
pool UID can physically access all state it serves, so a trusted native compromise
can cross Apps. Operators must disclose that risk and offer stronger placement.
Separate paid UIDs alone do not prevent network access to public services or kernel
vulnerabilities; filesystem/network restrictions and patched OS remain necessary.

## Lifecycle and operations

1. Register customer and pinned entitlement; authorize requested canonical App and
   domain separately. Provision UID only where required, through privileged broker.
2. Stage approved package/content snapshot; reject recovery markers and unauthorized
   native dependencies. Allocate roots/namespaces and reserve pool capacity atomically.
3. Persist placement intent, validate complete worker inventory, start a new generation,
   activate required Apps, then publish route after readiness and ownership checks.
4. Pause/suspend first removes routing/admission; drain and revoke worker lifetime.
   Resume creates a fresh controller/generation after revalidation. Meters reset;
   entitlements do not. Persistent usage/billing ledger is separate future work.
5. Upgrade free to paid follows the stopped exclusive-owner migration protocol.
   Downgrade needs explicit agreement to shared-process risk, App-count compliance,
   quotas and data retention; never silently delete excess Apps or data.
6. Rebalance uses the same migration transaction, never copies an active writable
   deployment. Immutable inventory means adding/removing a pool member currently
   replaces its controller/process: drain the whole affected pool, preserving siblings'
   data and surfacing maintenance downtime. Dynamic reconfiguration is deferred.
7. Delete: authorize and audit, remove domain routes, stop/fence ownership, revoke
   external credentials, quarantine retained data/backups per policy, then erase after
   retention approval. Do not recycle account IDs/UIDs while old files remain accessible.
8. Recovery reconstructs desired placements from durable provider state, reconciles
   OS processes/units and routes, and rejects ambiguous ownership before startup.
   Customer deletion does not imply deleting a shared pool or other customers' files.

## Capacity hypothesis and qualification

Initial maximum is **16 total controller entries**, including ordinary parking Apps;
with one parking entry, at most fifteen tenant Apps. It is not sixteen free customers
plus unlimited infrastructure Apps. Provider may impose lower limits.

Before 20–50 Apps, revise deliberately: `validateAppInventory` apps length <=16;
`operations.js` optional length <=16; 64 KiB inventory and 128 KiB operational policy;
routing limit 256 routes, 16 zones/peers; per-tree 8192/depth32 scans; repeated complete
inventory validation on every activation; sequential operational startup and per-App
phase deadlines; health serialization/IPC bounds; summed admission capacity (not a
global process admission cap). Check every constant, test and example, not only length.

Benchmark disposable 1/8/16/20/35/50-App profiles only after an explicit experimental
validator revision. Measure p50/p95/p99 latency, event-loop lag, RSS/native heap,
startup/retirement wall time, fd count, CPU/pressure, JSON amplification, synchronous
SQLite, Argon2 contention, indexing/media loads, overload and recovery. Include idle
and bursty mixes and hostile bounded work, a busy App alongside canary siblings, OOM
and crash recovery, and randomized ownership/alias failures at maximum size. Define
machine/workload/SLO and repeatable thresholds before accepting density. Keep 16 as
shipping bound if evidence is absent. I4 does not raise limits or certify economics.
