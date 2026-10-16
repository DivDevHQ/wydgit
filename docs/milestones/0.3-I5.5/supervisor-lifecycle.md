# Supervisor lifecycle and recovery

`createSupervisor({registry,directory,fixtureRoot,...policy})` is trusted provider
composition. The existing I5.3 registry remains the only approved placement authority.
Its `supervisorStateDirectory` is the fixed child `supervisor` of its private state
directory; callers cannot select another process-state location to bypass ownership
or restart budgets. Create that directory explicitly with mode 0700 before use.
The supervisor takes an exclusive `supervisor.lock`; another owner is refused.

The bounded `supervisor.json` process ledger records at most **128 pools**, with
`poolId,epoch,attempts,desired,worker`. A live worker record contains only PID and
random generation. Changes use synced private temporary files, atomic rename and
directory sync, serialized through one writer. The ledger records transient process
ownership and lifecycle intent, not a second App/customer/domain registry. Corrupt or
unknown ledger schemas, linked state, unsafe permissions and recorded ambiguous
owners refuse startup. This is cooperating-process fixture ownership, not qualified
power-loss or malicious-OS protection.

## Desired and observed state

Registry records describe approved placement and intended Linux accounts. A registered
active pool is never evidence of a running process, staged deployment or enforced UID.
`startPool` reconciles the registry/journal, reads current approved state, uses the
existing `compilePool`/I5.1 validator, checks approved deployment fingerprints and
creates a new epoch/generation. All assigned Apps must be active, approved, bounded
by entitlement/capacity (sixteen including parking), with exact routing and ownership.
A supervisor cannot invent a placement from a hostname, path, customer ID or publisher
request. Provider registration/authorization remains I5.3's independent operation.

Process desired state is `running` or `stopped`; observed state begins `not-observed`
and progresses through `starting`, `ready`, `draining`, `stopping`, `stopped`,
`unavailable`, `backoff`, or `failed`. Readiness additionally requires a live matching
child, unexpired health, required-App readiness and successful current-placement
revalidation after worker startup. A final startup snapshot alone cannot publish a
route. Process exit/EOF immediately clears all health and endpoints. A live process
can be unready. Saturation is independent from readiness and does not trigger restart.

The parent pins a digest of the pool and its approved Apps/domains/customers/plan
revisions/account, not unrelated provider assignments. A change to that pinned
placement retires the affected worker; it does not hot-edit I0 inventory or terminate
an unrelated healthy pool. Registry unavailability/corruption removes confidence in approved placement and
makes affected observations unavailable. Startup also refuses journal recovery-required
state. Active heartbeat reads use the atomically approved registry; a concurrent
plan/apply writer lock alone does not revoke an unchanged approved placement.
Startup/restart always repeats validation; old snapshots cannot authorize registry
writes (the supervisor has no registry mutation API).

For a planned membership change: `await stopPool(poolId)`; verify the returned stopped
state/actual process death; separately stage and approve the I5.3 change with its normal
operator authorization; then `startPool` with current trusted execution policy. Migration
operations still return their existing unsupported/planned status; this milestone adds
no live migration or staging implementation. An unexpected revision change detected
by heartbeat terminates the old immutable generation and requires explicit restart.

## API and concurrency

| Trusted method | Outcome |
| --- | --- |
| `startPool(id,{execution?,optional?,port?})` | Await verified ready generation; startup failures are terminal, never a ready endpoint |
| `stopPool(id)` | Persist stopped intent, remove readiness, request I3 shutdown, enforce deadline, await actual death |
| `inspectPool(id)` | Frozen current observation, expired snapshots suppressed; never starts a process |
| `readHealth(id)` | Finite correlated fresh worker health request; EOF/timeout rejects |
| `health()` | Frozen per-pool aggregate; tenant operations remain supervisor-only |
| `recoverPool(id)` | Only with no live owner: explicitly reset crash budget and set stopped intent |
| `shutdown()` | Idempotent promise: cancel backoffs, settle starts/stops, stop all children, verify death, persist and release lock |

Shutdown intent immediately removes cached readiness, fences pending starts before
bootstrap/final publication, and waits for owned child death. One lifecycle operation
per pool is admitted; conflicting operations fail HOSTING.BUSY
rather than entering an unbounded queue. Different pools can proceed independently.
Only the supervisor's owned ChildProcess objects receive signals; no arbitrary caller
PID target exists. Control concurrency/send queues are bounded by the protocol. Registry reads, inventory
preflight and state writes also have finite deadlines. Pool startup uses one overall
startup budget across approval, ownership persistence, bootstrap and final readiness. Read-only
preflight completion after a timeout cannot start a child. A timed-out state write
may still complete at the OS boundary; its outcome is unknown. If durability remains unresolved, shutdown retains
the ownership lock rather than declaring a safe restart.
The trusted embedding owns its own SIGINT/SIGTERM handlers and must await `shutdown`
in a `finally` path. The finite disposable example demonstrates normal/error cleanup; a long-running
embedding must wire the same awaited cleanup into its own signal handlers. Supervisor API
creation does not secretly register global process handlers.

## Restarts and generations

Unexpected exit/IPC EOF/control timeout invalidates the old observation immediately.
Before replacement, actual exit must resolve from that exact ChildProcess. Timeout
is not proof of death; SIGKILL escalation and a finite final death wait follow.
Unknown ownership becomes HOSTING.OWNERSHIP_UNKNOWN and no conflicting writer starts.
App IDs/contexts/providers never cross IPC. Every replacement builds a fresh original
I3/I0 runtime and old SEAM authority remains retired. Exit closures capture the old
entry; they cannot retire a replacement. A new listener is explicitly bound anew,
with no silent socket ownership transfer.

Default restart policy allows **five replacements**, with **1/2/4/8/16-second**
backoffs (general cap 30 seconds). Policy accepts maxRestarts 0..5 and base backoff
100..30000 ms for finite disposable fixtures. Budget is persisted before replacement
and survives clean supervisor reconstruction. On exhaustion, observed state is
`failed`, code HOSTING.CRASH_LOOP. Startup configuration, required-App or bind failures
do not loop. Heartbeat loss causes retirement/replacement, but changed/invalid approved
placement requires operator review. One worker's failure leaves unrelated processes
running; all Apps inside that worker share its failure boundary.

This deliberately refines I4's five-failures/ten-minute rolling budget with jitter:
the initial implementation uses a **more conservative lifetime replacement budget**,
no automatic stable-time reset and deterministic finite backoff. Operators explicitly
call `recoverPool` only after diagnosis and confirmed death, then call `startPool`.
Restarting a supervisor cannot reset this budget. No production fleet retry/stampede
qualification or commercial durable accounting is implied.

## Drain, shutdown and abnormal death

Drain/shutdown and direct worker SIGTERM close admission through original I3/I0,
retain accepted request draining, stop lifecycle/services and exit. Parent health
can observe draining without interrupting accepted work; a global drain watchdog
bounds it. Clean parent-requested stop is expected and never automatically restarts.
A worker's unsolicited SIGTERM is an exit while desired-running and follows the
bounded restart policy after drain. SIGKILL produces actual process-death detection
and an unclean lifetime; committed writes are not undone or automatically repaired.
Existing package/provider recovery checks remain mandatory on restart.

Parent shutdown stops every owned child even if a ledger write fails; failed ownership
or durability retains the lock for recovery instead of claiming success. Backoff timers
are cancelled. A responsive worker whose parent dies sees private IPC EOF, closes
admission and attempts bounded shutdown. A blocked worker may never service EOF or
its own timers after parent death. **No independent orphan killer exists here.** I5.6
must use independently owned units/cgroups and broker/service-manager deadlines.

## Manual recovery and limits

After supervisor crash, do not delete its lock and immediately restart. Privately
inspect `supervisor.lock` and ledger worker generations/PIDs, verify exact processes
have terminated (including stopped/blocked children), ensure no ambiguous resource
owner remains, and inspect provider/package recovery state. Numeric PID existence
alone cannot establish identity after reuse. Refuse ambiguity; an operator must use
OS evidence to resolve it. Only after confirmed death may the stale lock be removed
and each recorded worker ownership be reconciled to null in the private fixture
ledger. Retain an operator backup of the original evidence. Recreate the supervisor,
reconcile the existing registry, then explicitly start approved pools. There is no
automatic adoption, old-channel reconnect, PID-based kill-on-restart or budget reset.
Production reconciliation requires I5.6's kernel-owned identities and audit mechanism.

App unavailable means one failed/overloaded/quota-exhausted App (often HTTP503);
pool unavailable means its generation cannot serve any assigned Apps; supervisor
unavailable means process control/observations are absent even if an orphan is alive;
registry unavailable means approved placement cannot be verified. None permits
routing to a sibling customer's App. Loopback fixture reachability is not production
ingress authorization. Separate processes alone do not enforce filesystem, UID,
cgroup, egress, persistent-resource or multi-host ownership fencing.
