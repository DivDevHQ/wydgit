# I3 — Hosting operations and stopped local App relocation

Wydgine/platform alpha.12, WydClient alpha.8, WydSUB 0.1. This is a runnable
non-production hosting foundation, not a production-readiness or security audit claim.
See [operator commands](../../hosting-operations.md) and [verification](verification.md).

## Architecture and trust

`wydgine/operations.js` composes the existing private I0 controller. I1 still selects
exact hostname ownership before tenant adaptation; I2 still admits and meters work.
No controller, snapshot, relocation function or signal handler is registered with
SEWN, CLIENT, a canonical service or a public management endpoint. The operational
wrapper returns its controller only to trusted Node code. Portable Apps need no
server-specific edits. App IDs remain independent of domain names.

The closed `wydgit.operations/0.1` policy has exactly `schema`, `inventory` (the
existing `wydgit.multi-host/0.1` inventory), and `optional` (unique configured IDs).
Complete inventory validation remains mandatory, including optional Apps: optional
means initialization may fail, not that malformed or ambiguous ownership may pass
validation. Parking Apps cannot be optional. All Apps default to required.

## Health contract

`controller.health()` returns a cloned, deeply frozen plain-data snapshot;
`operational.snapshot()` adds required-App policy and host lifecycle. Both are
host-only, synchronous and bounded by the existing sixteen-App inventory and fixed
I2 dimensions. There is no HTTP probe in I3. A trusted process supervisor can call
`snapshot()`; deployment infrastructure must not publish its detailed tenant data.

- `live: true` means the process can execute this function, including after shutdown.
- Host state is configured, starting, ready, unavailable, draining, stopped or failed.
  Listener closure/error makes an operational host unavailable. Startup/cleanup
  failure is terminal. `ready` also requires every required App to be ready.
- App states retain I0 configured, initializing, active, stopping, stopped, failed.
- App `ready` requires active, unretired admission with remaining payload allowance.
  `saturated` separately identifies current combined/HTTP/direct concurrency saturation.
  A busy active App can be ready; a stopped/failed App cannot.
- `draining` identifies stopping; failure is a fixed category (STARTUP, CLEANUP,
  DRAIN_TIMEOUT, STALE or UNAVAILABLE), without original messages or stacks.
- Each App includes pending work, activation duration, execution limits and its I2
  usage. Host startup duration and age use monotonic process-local time.

Warnings are fixed, deterministic current-snapshot codes: APP.FAILED, APP.NOT_READY,
ADMISSION.NEAR_LIMIT (80% current combined capacity), ADMISSION.REJECTED (at least
three lifetime overloads), PAYLOAD.NEAR_LIMIT (80% consumed), SERVICE.FAILURES
(at least three failures in any canonical library), EXECUTION.LIMIT (at least one
Page limit failure), DRAIN.DEADLINE. These are lifetime observations, not rates or
an alert queue. No identities, credentials, paths, contexts, raw errors, package
signing material, arbitrary labels or providers enter snapshots.

## Startup, drain and restart

`await createOperationalHost(policy, {root, execution, libraryAdapters})` validates
the complete immutable inventory before returning. `await host.start(port, address)`
activates each App through I0 (including required libraries and Server Start), allows
only explicitly optional initialization failures, then opens the shared listener.
A required failure closes all initialized resources and never opens routing. Failed
optional tenants return 503, never a parking fallback. Readiness still reflects any
later required-App loss. Native listener failures are terminal for this start attempt.

`host.shutdown()` synchronously marks not-ready/draining and calls idempotent I0
disposal: block new traffic/direct admissions, close shared transport, drain accepted
work, run Server Stop once, close library bindings and retire authority. Each I0
phase has the configured shutdown bound (startup may first consume its startup
bound); this is not one global wall-clock deadline. Timeout disconnects responses,
retires the lifetime and reports cleanup failure; late work cannot regain authority.
Previously committed provider writes are not rolled back. Trusted stuck native hooks
can outlive their deadline; I3 cannot force-kill arbitrary native work.

`host.signals()` attaches SIGINT/SIGTERM cleanup and returns a detach function. It
sets process exit status on failure and does not call `process.exit()` before cleanup.
A supervisor must allow the documented phase bounds before escalating termination.

Restart means shutdown, create a **new** controller, revalidate the same persisted
roots/configuration/catalog, activate and reopen routing. A stopped/failed lifetime
cannot reactivate. Old controller tokens, contexts, library handles and transient
Sessions remain invalid. Persisted Gate sessions may reopen only in their configured
App; they are distinct from runtime App authority. There is no cross-App SSO.

## Persistence and recovery matrix

| State | Restart / relocation responsibility |
| --- | --- |
| Canonical App, Pages, prototypes, public assets, SEWN/WBasic artifacts | Persistent source/catalog; copied by local snapshot |
| App config / requirements | Persistent; runtime pins drift; relocation rebinds approved local roots |
| Installed catalog, receipts, pinned package resources | Persistent, validated; copied; destination validates receipts/hashes and trusted package policy |
| WydStore JSON data/history | Persistent under data; copied only after clean stop |
| WydStore SQLite | Existing restart contract retained; relocation tool rejects SQLite; operator export/backup handoff required |
| WydGate credentials, memberships, persisted sessions | Store-owned; local snapshot intentionally retains them; treat snapshot as confidential |
| WydFiles local content | Persistent files directory; copied after clean stop |
| WydFiles S3-compatible resources | External ownership/credentials; local tool rejects; explicit provider handoff required |
| WydStream metadata and local media | Store plus media directory; copied; pending tickets keep existing service validation/expiry rules |
| WydSearch indexes | Store-owned; copied; canonical source indexing follows existing startup behavior |
| Installation transactions/recovery locks | Never automatically repaired; startup/snapshot fails closed pending trusted inspection |
| Temporary provider transaction files | Provider contract; unexpected hidden/linked snapshot entries reject; no speculative repair |
| I2 meters, peak counters, lifetime quotas | In-memory lifetime only; reset with new controller; not billing records |
| Runtime Sessions, contexts, tokens, listeners, adapters | Never portable; reconstructed, old authority rejected |
| Host routing, domains, optional policy, secrets, dependencies | Destination operator configuration; not granted by relocation manifest |

History/journaling/install recovery is not backup. Operators must back up complete
provider state, configuration and keys using each provider's consistency contract.
SIGKILL/power loss can interrupt writes, filesystem replacement, SQL transactions,
installation and transfers. Clean restart acceptance does not certify power-loss
recovery. No destructive crash/corruption experiment is performed on user data.

## Stopped local relocation

`await controller.snapshotApp(id, absoluteSnapshotDirectory)` requires a cleanly
stopped App, no pending work and matching pinned startup state. Failure or draining
is insufficient. It validates the repository/catalog and copies content, prototypes,
public, data, files, media and normalized App configuration to a new private directory.
Executable node_modules, author package staging, host routing and runtime objects do
not travel. Supported resources are local JSON/local Files/local Stream under exactly
`data`, `files`, `media`. Other roots/providers reject instead of silently omitting
required resources. Gate state is intentionally included; snapshots require private
storage/transport and the same confidentiality as credentials and application data.

`relocation.json` uses `wydgit.relocation/0.1`, source App ID, exact compatible
platform/profile, package inventory and file length/SHA-256 records. It contains no
App token, grant, domain approval or private source root. Directory traversal,
symlinks, hardlinks, unexpected/hidden entries and special files reject. Tree bounds:
8191 entries, depth 32, 16 MiB per file, 128 MiB total, descriptor <=2 MiB.
These conservative limits deliberately reject larger installations.

`restoreLocalApp(snapshot, {root, directory, app, verifiedPackages})` requires an
explicit canonical approved destination root, a new simple child directory and
expected App ID. It verifies integrity, copies resources, rebinds local roots,
reconciles the installed base fingerprint for that trusted transformation, and
revalidates canonical content/catalog/receipts. Failure removes only the new child
created by that attempt. Interrupted process termination can leave an incomplete
child; inspect/remove it manually before retry. Existing directories are never
replaced. Destination dependencies must be provisioned separately. Activation uses
ordinary complete inventory ownership/routing validation and a fresh controller.

The descriptor is unsigned integrity metadata, not source authentication. A person
who replaces both content and hashes can author a different snapshot; destination
operators must approve the source and package policy through trusted channels.
It does not authorize arbitrary publisher relocation or grant host authority.

Source controller remains terminal for the relocated App; siblings keep running.
Fresh destination roots isolate writes from source roots. Within one inventory,
I0 rejects overlapping roots/remote namespaces and duplicate identities. Local copy
cannot fence another independent process/machine. Operators must guarantee exclusive
ownership, stop any other source process, and not reactivate a new source controller
against the old copy. There is no distributed lock/consensus or automatic remote
namespace transfer. Hostname approval and secrets must be supplied independently.

## Capacity, deployment and handoff

Health aggregates configured/active/ready/saturated counts, current admitted work,
sum of App peaks, accepted payload, quota rejections, service failures and execution
limit failures using I2 counters. Sum of App peaks is **not** simultaneous host peak.
Configured logical limits do not measure spare CPU/RAM/network/storage capacity.
Accepted body payload is not delivered wire bytes. Lifetime counters reset on restart.

Apps share a Node event loop and memory. Native crypto workers contend; SQLite is
synchronous; JSON operations/history can amplify I/O. Files/media streaming,
indexing, request concurrency and provider storage capacity require workload-specific
measurement. Limits do not guarantee CPU fairness or hard heap isolation. No universal
Apps-per-server number is supported. Worker/process isolation remains an I4 candidate.

The [persistent runnable profile](../../../examples/hosting-operations/README.md)
uses installed WBasic Taskboards, independent five-library App state, parking, one
shared listener and different I2 policies. The [Caddy reference](../../hosting-operations.md)
terminates HTTPS with supplied certificates, strips unsupported forwarding metadata
and privately reaches the exact trusted peer. It is documentation-only here; no
Caddy executable/live CA deployment was tested. Existing Chrome uses a disposable
local TLS proxy, not Caddy certification.

I4 should examine process isolation, supervisor deadline integration and provider-specific
crash/backup restore exercises. J can build authorized administration over these
trusted APIs; it must add its own authorization, audit and ownership procedures.
Domain self-service, DNS/ACME, commercial tiers, billing, distributed metering,
live migration and public admin APIs remain excluded.
