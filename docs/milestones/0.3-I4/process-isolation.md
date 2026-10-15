# Process isolation and worker protocol

Design version `wydgine.worker/1`. No supervisor or IPC implementation is added in I4.

## Alternatives and recommendation

| Approach | Benefits | Limits / decision |
| --- | --- | --- |
| Multiple Apps, one trusted Node process | Reuses I0–I3, low idle overhead, separate logical registries | Shared heap/event loop/UID/native facilities/crash; primary provisional free-tier architecture, bounded at existing ceiling |
| Node worker threads | Separate JS isolates, useful trusted compute offload | Same process identity and process-wide native failure; thread resourceLimits do not provide a tenant OS sandbox. Not the primary hosting boundary. |
| Independent Node processes | Separate heaps, event loops, kill/restart and memory accounting | Same UID still permits filesystem/signal access; useful standalone and pool boundary, needs OS restrictions for paid hosting |
| Restricted UIDs + cgroup v2 processes | Customer access separation, pool CPU/memory controls, systemd lifecycle | Shared kernel and host I/O/network; preferred paid tier, also use one restricted identity per shared free pool |
| Dedicated deployments/servers | Independent per-site pools, optional containers or machines | Higher overhead; qualify container policy separately. Higher-tier path, not required for ordinary developer |

```text
public HTTPS → trusted edge (TLS + exact routing revision)
                     ├→ private free worker: App A / App B / parking
                     ├→ private paid customer X worker: App C / App D / parking
                     └→ private dedicated App E worker
nonroot WydHosting supervisor → inherited authenticated control channels → workers
          └→ separately authorized narrow privileged provisioning broker → systemd/OS
```

The supervisor is trusted provider infrastructure, not an App. Workers are trusted
engine code executing untrusted bounded SEWN. Both remain nonroot. Worker data access
is restricted by UID/service mappings and kernel policy; the control channel is never
passed into a service facade, package context, CLIENT payload or portable workflow.

## Bootstrap and authentication

Use a private inherited Unix socketpair/control fd, provisioned by the trusted broker
when systemd starts a restricted UID worker. No TCP management listener and no
worker-discovered supervisor address. Prototype fd passing/ownership under systemd
in I5 before committing to unit layout; if unavailable, a private Unix control socket
must authenticate peer credentials plus one-use bootstrap secret. Fail startup rather
than fall back to unauthenticated loopback. Ordinary child IPC fork is acceptable only
for disposable same-UID tests; it does not prove paid UID isolation.

The broker binds expected unit, uid/gid, poolId, random workerId, generation and
bootstrap channel to a durable supervisor operation. A 256-bit one-use challenge is
sent over the inherited channel, never argv/env/log/URL/disk-readable by customers.
Worker replies with challenge and expected identities; supervisor checks actual OS
peer/started unit. This authenticates a connected worker, not the truth of a compromised
engine. Bootstrap identity/configuration comes only from provider-owned data. Abort
on handshake timeout (10 s), identity mismatch or replay; discard secret after use.

Bootstrap payload pins engine/protocol version, pool/worker/generation, ownership
epochs, inventory revision/digest, canonical staged base, approved App/resource map,
required/optional policy, listener policy and bounded OS/App limits. No executable
callbacks, runtime tokens, raw contexts, shell strings or arbitrary npm paths. Worker
loads separately installed trusted engine/library implementations under pinned policy.

## Wire contract

Length-prefixed UTF-8 closed JSON, maximum 256 KiB/frame, nesting 16, maximum 32
in-flight requests and 1 MiB queued bytes per direction. Reject duplicate JSON keys,
unknown fields, invalid UTF-8, unsafe numbers, prototype keys and unknown protocol
before dispatch; implement decoder tests rather than rely on JSON.parse alone.
Use unsigned safe integer sequence/revision values, generation as random opaque ID
plus durable monotonic pool epoch. On epoch exhaustion refuse; never wrap counters.

Envelope: `{schema,type,requestId,poolId,workerId,generation,sequence,body}`.
`requestId` is bounded unique 1–128 ASCII identifier for commands/replies. Sequence
must increase per channel; reconnect starts a new generation, never resumes authority.
Reply types are `result` or `error` with matching requestId and fixed safe codes.
Mutating commands include `operationId` and `expectedRevision`; persist outcome for
idempotent retries. Timeout is “outcome unknown”, never evidence of nonexecution.

| Direction / type | Closed body and semantics |
| --- | --- |
| Supervisor → bootstrap | Above pinned payload; exactly once before validation/activation |
| Worker → hello/validated | Negotiated protocol+engine version, inventory digest; no readiness yet |
| Supervisor → start | Approved inventory revision; initializes fixed inventory with I3 required/optional policy |
| Worker → listening | Actual private endpoint, transport policy digest and inventory revision; supervisor verifies endpoint ownership, not worker-provided arbitrary address |
| Worker → ready / snapshot | Sanitized I3 App health/capacity plus sequence and observation age; no paths, users, cookies, secrets or service handles |
| Supervisor → inspect | Bounded snapshot request; health heartbeat every 2 s, stale after 10 s; OS liveness separate from readiness |
| Supervisor → retire | operationId, App IDs or whole pool, absolute shutdown deadline; admission closes before acknowledgement; terminal App cannot reactivate |
| Worker → drained | Final App states and fixed failure codes; no claim committed I/O rolled back |
| Supervisor → shutdown | Whole process retirement, close listeners and services; expected exit follows |
| Worker → error | Fixed category and correlation ID; raw diagnostics only in restricted operator log with redaction |

No arbitrary `execute`, `spawn`, `eval`, `context`, `grant` or live register-new-App
message. Registration updates provider state and starts a new immutable generation.
App tokens remain local WeakMap keys; IPC App identifiers select already approved
entries and cannot create SEAM authority. Initial snapshots fit the frame bound;
otherwise reject configuration, never truncate readiness silently.

## Routing, generations and failure

Provider routes reference `(appId, poolId, generation, ownershipEpoch, routeRevision)`.
New worker must validate, acquire exclusive service ownership, start required Apps
and register a private listener before edge activation. Worker routing still performs
I1 raw header/origin/peer checks. Exact route assignments remain immutable per worker;
provider must not send a hostname to a worker whose policy lacks that hostname.

On crash/heartbeat loss: mark route unavailable, stop new admissions at edge, verify
unit/process death and release/fence resources before replacement. Backoff default
1/2/4/8/16/30 s with jitter, maximum five unexpected failures in ten minutes, then
quarantine and alert; stable ten-minute runtime resets history. Persist restart budget
so supervisor restart cannot bypass it. Operators can retry only after audited review.
Listener errors and required-App failure retire the affected pool under initial policy;
optional App failures stay 503. Worker/proxy never substitutes a different tenant.

Supervisor owns overall retirement deadline (default 120 s, capped by validated
operator policy), sends logical shutdown, then asks systemd/broker to SIGTERM and
finally SIGKILL the verified unit cgroup after a further 5 s grace. Existing I0 uses
per-phase bounds, not this global wall clock. Compute a compatible graceful budget
from App count/startup/drain/stop/close bounds or explicitly accept forced termination;
do not claim 120 s always permits every phase. Killing must target unit/cgroup identity,
not reused numeric PID. SIGKILL cannot roll back writes; mark unclean recovery required.

On channel loss worker immediately closes admission/listener and attempts bounded
shutdown; independently scheduled systemd/broker cleanup must kill orphan generations
even if event loop is blocked. Supervisor reconciliation verifies no old unit owns
resources before restarting. Generation checks fence stale messages/routes; they do
**not** fence already-running filesystem or S3 writes. Single-host I5 requires old
process/cgroup death and exclusive provider locks before new writes. Unknown death
or lock state means unavailable, not dual startup. Multi-host resource fencing requires
provider-enforced leases/epochs or consensus and is deferred.

## Resource enforcement layers

| Layer | Actual / planned guarantee |
| --- | --- |
| SEWN steps/depth/events/deadlines | Existing bounded workflow execution; trusted native blocking remains outside hard CPU preemption |
| I2 combined/HTTP/direct slots and accepted body payload | Existing App-lifetime logical admission/accounting; reset on restart, not hard bandwidth, CPU or heap allocation |
| Process scheduling / cgroup `cpu.max`, `cpu.weight` | Planned pool CPU throttling/relative sharing; no per-App fairness within one process |
| cgroup `memory.high`, `memory.max`, `memory.swap.max`, pressure/OOM events | Planned pool-level pressure and ceiling, fail/restart policy; includes native memory beyond V8 heap; measure actual kernel behavior |
| Filesystem quota/project quota | Planned physical pool/customer allocation where supported; temp/WAL/backups count per filesystem semantics; unavailable quota cannot be advertised |
| cgroup I/O controls | Planned device-dependent block I/O policy; validate device/backend support, not equivalent to S3 rate limiting |
| Network policy | Planned private ingress and explicitly constrained egress; shared free process has pool-wide OS network policy, per-App restrictions remain canonical-service policy |
| Cross-pool fairness | Provider capacity reserves + OS CPU/memory/I/O controls; benchmark contention, avoid oversubscribing hard reservations |

Kernel semantics reference: [cgroups v2](https://docs.kernel.org/admin-guide/cgroup-v2.html).
Do not combine these layers into a promise of hard per-App CPU/memory isolation.

## I5 acceptance cases

Run real installed Apps in distinct processes: wrong/replayed challenge; foreign UID;
forged/stale generation; oversized/malformed/reordered frames; unknown operation;
duplicate command after lost reply; inherited-fd leakage; unready listener publication;
hostname mismatch and spoofed proxy; busy sibling; timeout/blocked native hook; OOM;
SIGKILL; channel EOF; supervisor crash/restart; crash-loop budget persistence; PID
reuse; forced unit cleanup; old process holding service lock; late old-generation
snapshot; optional/required startup failure; immutable membership replacement. Confirm
fresh contexts and old binding retirement with existing tests. Linux tests must verify
UID, cgroup membership, private socket permissions and actual access denial. A fake
IPC exchange alone is not OS isolation evidence.
