# Worker protocol — wydgine.worker/1

Trusted Node parent-created `fork` IPC is the only bootstrap/control transport.
No address discovery, control TCP listener, browser route or portable process handle
exists. The parent resolves the declared installed `wydgine/trusted/worker-entry`
export. Children use the current Node executable, empty execArgv, ignored standard
streams and a small environment (PATH/LANG); no inherited NODE_OPTIONS/source hooks.
Each worker loads the one installed canonical engine and separately approved services.

This proves channel provenance in the trusted same-UID fixture. It is **not
cryptographic authentication** or a boundary against a malicious same-UID OS actor.
Unlike the future I4 broker lane, no challenge/peer-credential exchange pretends to
prove a restricted UID. I5.6 must bind authenticated inherited control and expected
unit/UID/epoch to broker-authorized operations, including a one-use 256-bit
challenge delivered only on the inherited channel and verified against the actual
started peer/unit; a private socket alternative needs
qualified actual peer credentials and one-use secret, without insecure fallback.

## Framing and closed envelopes

Node's built-in JSON IPC supplies message framing; no redundant binary codec exists.
After native decoding, the maximum serialized message is **262144 UTF-8 bytes**,
maximum nesting **16**, and maximum visited JSON values **32768**. Unsafe integers,
non-JSON objects/accessors/sparse arrays, reserved prototype keys and unknown
fields/types/versions fail closed. Validation charges the serialized byte budget while
walking keys and values, before constructing a complete encoded string; oversized
decoded input cannot cause an additional unbounded serialization allocation.
Node performs native JSON decoding before application validation; this is not a
preallocation memory bound against hostile native peers. Duplicate raw JSON keys and
invalid raw UTF-8 cannot be independently audited after Node decodes them. Typed native
`send` produces normal JSON; a hostile native peer is outside this fixture's boundary.
These explicitly refine I4's proposed raw UTF-8/length-prefix decoder requirement.

Every message has exactly:

```text
{schema, type, requestId, poolId, workerId, generation, sequence, body}
```

Schema is exactly `wydgine.worker/1`. Provider/control IDs are 1–128 ASCII
letters/digits/underscore/hyphen, excluding reserved prototype names. Canonical App IDs
retain their existing rules, bounded at 128 characters. Generations and worker IDs
are independently random UUIDs. Sequence is a strictly increasing positive safe
integer per direction, beginning at one, with no wrapping. Commands use requestId
`r<sequence>`; no reconnect or resumption of a prior generation is permitted.
Worker/pool/generation must match the channel bootstrap binding on every message.

The parent permits at most **32 outstanding requests**. Each direction queues at
most **32 sends / 1048576 bytes**, including its active send. Only one native send
is active; the next waits for its callback, including when `send` returns false.
A send callback is transport acceptance, not operation completion. Send timeout or
queue overflow closes the channel and rejects queued sends. There is no retry or
unbounded inbound work queue. Native delivery is validated synchronously; the worker
admits one lifecycle command at a time and rejects competing commands. Once listening,
health/readiness reads remain available during drain. Invalid flooding closes the
channel rather than accumulating operation work. Native IPC kernel/internal buffering
is not a certified OS memory quota; that belongs to I5.6.

## Messages and completion

| Supervisor → worker | Closed body | Worker replies with same correlation ID |
| --- | --- | --- |
| `bootstrap` | Exact bootstrap below | `accepted`, `starting`, then `ready`/`not-ready`, or `rejected`/`failure` |
| `readiness` | `{}` | `ready`/`not-ready` |
| `health` | `{}` | `health` |
| `drain` | `{}` | `draining`, then `stopped` and process exit |
| `shutdown` | `{}` | `draining`, then `stopped` and process exit |

`accepted`, `starting`, `draining`, `stopped` bodies are `{}`. `rejected` and
`failure` bodies contain only `code`: WORKER.STARTUP, WORKER.PROTOCOL,
WORKER.CLEANUP or WORKER.NOT_READY. Malformed/unbound input closes IPC and exits
without echoing attacker input. No raw exception or stack enters a reply.
`accepted` and `starting` never mean listener readiness. Required initialization,
approved snapshot validation and actual listener readiness precede `ready`.
The supervisor separately revalidates current approved placement before publishing it.

Health/readiness bodies have exactly `{ready,state,apps,capacity,port,
configurationRevision}`. Each App has `{id,state,ready,saturated,draining,pending,
failure}`; capacity has `{configured,ready,saturated,current}`. Counts are logical
I2 admission counts, not CPU/RAM estimates. Failure codes are I3's fixed App categories.
Snapshots contain no paths, Session/user data, tokens, credentials, package keys or
service handles. Tenant-specific App IDs and operational counts go only to the trusted
supervisor; there is no public metrics endpoint.

The parent verifies response types against the pending command, required startup
ordering, duplicate transitions, duplicate/unknown terminal correlations, configuration
revision, complete assigned App set and listener port. A retired channel cannot update
replacement snapshots. An unmatched/late response closes that channel. Health is cleared
on death/EOF/error/timeout/drain, and cached readiness expires after heartbeat interval
plus control timeout, using monotonic process-local time. A retained snapshot cannot make a dead worker ready.

## Exact bootstrap

Exactly these fields are accepted:

```text
providerId, poolId, workerId, generation, epoch, registryRevision,
configurationRevision, root, inventory, snapshots, execution, optional,
listener, startupMs, shutdownMs
```

`epoch` is a persisted increasing safe integer. `registryRevision` pins the approved
provider registry revision. `configurationRevision` is SHA-256 over the exact JSON
`{root,inventory,snapshots,execution,optional,listener}`; integrity is not authentication.
`snapshots` maps every assigned App ID to the existing I5.3 approved deployment digest.
The worker reruns the sole inventory validator and that same fingerprint implementation
before activation. Both content/package policy and fixed ownership must validate.
Roots are trusted operator-owned canonical fixture paths; no App chooses a root.
`execution` is a closed per-App `{verifiedPackages}` publisher-approval map, at most
128 approvals per App. No function/context/native object or arbitrary import is allowed.
`optional` is a unique assigned App list, at most sixteen, with I3 parking restrictions.
`listener` has exactly `{host:'127.0.0.1',port:0..65535}`. A fixed occupied port fails;
there is no fallback. Port zero assigns a fresh process-owned endpoint.
Existing inventory/resource and package/catalog validators remain authoritative.

## Deadlines and failure outcomes

Bootstrap must arrive within **10 seconds**. Supervisor startup/shutdown defaults
are **30000/10000 ms**, each configurable **100..120000 ms**. Worker initialization
has its own watchdog; the parent uses a monotonic overall startup budget including
preflight and final readiness; parent startup correlation includes validation/start/listen.
Control default is **2000 ms**, range **100..10000**; heartbeat default **2000 ms**,
same range. The parent owns a global shutdown deadline in addition to I0's per-phase
bounds. If necessary it sends SIGTERM, waits the shutdown budget, sends SIGKILL, then
waits at most **5000 ms** for actual exit. Ambiguous death blocks resource reuse.
Low shutdown budgets explicitly permit forced termination; no committed I/O rollback
is claimed. A blocked event loop cannot honor its local timers; the live parent can
kill it. Parent death while blocked requires I5.6's independent service manager.

Timeout means unknown operation outcome; requests are not retried within a generation.
There is no generic cancellation, evaluation, method invocation, source serialization,
filesystem or shell message. Termination is the parent's owned ChildProcess signal
operation. Drain is terminal whole-pool retirement, not a resumable pause. Failed or
stopped I0 authority cannot reactivate. Exit statuses: 0 clean retirement, 64 missing
IPC entry, 70 initialization/trusted-runtime failure, 71 cleanup/deadline failure, 72 channel
closure/loss (including malformed wire input); SIGKILL is recorded by actual child-exit detection, not a fabricated reply.

I4's durable command-operation journal/idempotent retry protocol is deliberately
reduced here: no command is retried and membership never mutates in place. Persisted
supervisor epochs/restart budgets plus the existing I5.3 placement journal are used;
no parallel provider authority registry is added. A new lifetime requires confirmed
process death and a fresh generation, never replay of an ambiguous control command.
