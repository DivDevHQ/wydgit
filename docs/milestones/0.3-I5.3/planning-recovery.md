# Planning, authorization and recovery

The reusable sequence is inspect → validate → plan → authorize → apply → reconcile.
Inspection, validation and planning perform **no persistent writes**, take no writer
lock, initialize no service and run no privileged action. Planning returns data only.
Fixture files/Apps are not created or repaired by these operations.

## Typed requests and plans

`wydhosting.request/1` has exactly `schema,operationId,expectedRevision,expiresAt,actions`.
There are 1–64 actions, processed in order and validated as one final proposed state.
`expiresAt` is epoch milliseconds, after planning time and at most one hour ahead.
No caller-supplied actor/admin/permission flag is part of this schema.

| Action | Exact remaining fields |
| --- | --- |
| `registerPlan` | `record` (closed Plan) |
| `registerCustomer` | `record` (closed Customer) |
| `assignAccount` | `record` (closed intended Linux assignment) |
| `registerPool` | `record` (closed Pool) |
| `registerApp` | `record` (closed App including initial placement) |
| `registerDomain` | `record` (closed Domain) |
| `changePlan` | `customerId,planId,planRevision` |
| `changeDomain` | `customerId,hostname,appId,expectedRevision,evidence` |
| `assignPlacement` | `customerId,appId,placement` |
| `setAssignmentState` | `customerId,appId,state` (`suspended/retired`) |

Registrations never overwrite identities. `assignAccount` explicitly binds the new
customer account where applicable; it cannot replace an existing different account.
The batch may create a customer, account, pool, App and domains together. References
must all resolve in the final state. A second paid App uses `registerApp` against
the customer's existing pool and entitlements. Changes preserve canonical ownership.

Free-to-paid: batch account assignment, new pinned plan, new dedicated pool and
`assignPlacement` with increased epoch. Dedicated per-App changes use the same
placement action. These plans show the complete proposed placement but are
`applicable:false`: `STOPPED_MIGRATION_REQUIRED` blocks fixture apply. No live copy,
account creation or traffic switch occurs. Suspension/retirement changes registry
intent only, with `RUNTIME_FENCING_REQUIRED`; it does not claim running work was stopped.

`wydhosting.plan/1` has exactly:

```text
schema, operationId, expectedRevision, baseDigest, request, proposed,
requiredOperations, approvals, warnings, applicable, expiresAt, digest
```

`proposed` contains the complete next registry, including ownership and placement.
Required operation codes expose intended accounts/processes/staging/routes/fencing.
Warnings always include `FIXTURE_ONLY` and `OS_PROVISIONING_UNSUPPORTED`; missing
execution inputs add `STAGING_REQUIRED`. `approvals` contains
`EXACT_PLAN_OPERATOR_APPROVAL`. Plans contain no commands, scripts, credentials or
arbitrary hooks. Digests are SHA-256 over the engine's deterministic sorted JSON
representation, excluding the plan digest itself. Equal state/request/options produce
identical plans. No randomness or time-of-planning field changes the digest.

A digest binds content; it does **not** authorize application. `createRegistry` accepts
an explicitly trusted `authorize(frozenPlan)` callback; it must return a bounded actor
ID for the exact operation or refuse. Without a callback, apply is unauthorized.
Object flags and booleans cannot authorize anything. Trusted code is responsible for
caller authentication and action policy; this is not a portable or remote API.
The local CLI maps explicit `--approve <exact-digest>` consent by the trusted OS
operator to this callback. No public management endpoint exists.

Apply verifies the complete regenerated plan, not just its supplied hash. Rehashed
changes to the proposed state, warnings or required work fail. Expected revision and
base digest must match; filesystem/configuration/snapshot and global ownership checks
are rerun before prepare. Unsupported placement transitions never enter the journal.

## Single-host persistence protocol

State directory is pre-created, owned by the current OS UID, mode 0700 (or stricter).
`state.json` is a no-follow, single-link regular file, owned by that UID and 0600 or
stricter. Every load checks size, closed schema, revision/plan chain and registry
relationships and filesystem/inventory validity. Unknown/malformed/missing state or
journal is refused. There is no default registry fallback or older-generation search.

`wydhosting.state/1` is **one file** with exactly `schema,generation,registry,journal`.
Each replacement has a fresh immutable UUID generation. Registry revision increases
once per committed operation; prepared writes do not advance it. Embedded journal
entries have exactly `operationId,actor,plan,state,resultRevision`. Operation IDs remain
reserved forever in this format; the bounded journal has at most 1024 entries and the
whole file at most 4 MiB. Large full-state plans can exhaust bytes much earlier.
Admission fails rather than truncating/pruning history or silently recycling IDs.
A future versioned archival/compaction protocol is required for long-lived operation.

1. Create `writer.lock` using exclusive creation, mode 0600. Sync its bounded PID
   diagnostic and directory. A PID is only an operator aid, never proof of ownership.
2. Reload/validate state under the lock; compare expected revision/base digest. Check
   operation identity and exact plan, reauthorize, validate current fixture inputs.
   Authorization is called before acquiring the lock; revision validation remains
   inside it. A new operation cannot pass a prepared predecessor.
3. Atomically write a **prepared envelope**: old registry plus the exact authorized
   plan/actor/result revision in the embedded journal.
4. Atomically write a **committed envelope**: proposed registry plus committed journal.
   No Linux/system/filesystem staging action runs between these steps.
5. Reload and verify the committed envelope before returning success. Release and sync
   removal of the writer lock. A post-commit error is an unknown acknowledgement,
   not permission to retry a different operation or assume rollback.

Each envelope replacement writes an exclusive same-directory temporary file, syncs
its data, closes it, renames it over state.json and syncs the containing directory.
Registry and journal are therefore never independently committed files. A temporary
file alone is not authoritative. The protocol is single-host/single-cooperating-writer,
not distributed locking. Noncooperating malicious processes with state-directory write
access are outside this fixture trust model. No path-based Node sequence is claimed
race-proof against hostile OS writers. Durability assumes working POSIX rename/fsync
semantics on a local filesystem; no VM power-cut, network filesystem, disk-controller
cache or storage-failure qualification is claimed.

## Idempotency and reconciliation

| Observation | Result |
| --- | --- |
| Exact completed plan/operation replay | Same recorded revision/result, `replayed:true`, no new mutation, authorization still required |
| Same operation ID, different content | `HOSTING.OPERATION_CONFLICT` |
| Different request against old revision | `HOSTING.STALE`; never silently replan |
| Unrecorded expired plan | `HOSTING.EXPIRED` |
| Prepared operation after interruption | Old registry remains authoritative; `recovery-required`; other work blocked |
| Authorized exact prepared retry | Revalidate same candidate/old revision and finish commit; no OS work |
| Committed write with lost reply | Reconcile reports registry verification; exact replay resolves acknowledgement |
| Missing/corrupted/unknown state or journal | Refusal, no recovery guess or automatic repair |
| Stale/unknown writer lock | Mutations refuse; reconciliation says recovery required |
| Invalid current App snapshot/inventory or verification failure | Refusal; never a successful readiness claim |

Expiry limits **starting** a new operation. A durable prepared operation can be
finished after expiration only through freshly authorized exact retry, with the same
old registry revision and revalidated inputs. It is continuation of recorded intent,
not acceptance of an expired unrecorded plan. Replaying an already committed operation
also remains allowed after expiry because it cannot mutate state again.

Read-only `reconcile([plan])` distinguishes `no-change`, `planned-not-authorized`,
`applied-registry-verified`, `stale-or-conflicting`, `recovery-required` and
`awaiting-unsupported-provisioning`. All results have `productionReady:false` and
`osStatus:'unsupported'`; recorded required work is reported as `awaitingOperations`.
`applied-registry-verified` means only that registry intent was committed and validated.
It never means an account, worker, firewall, certificate or live route exists.

After a real process crash, the exclusive lock deliberately remains. Verify no writer
is running using independent process/host evidence, inspect the state/journal and
retain a backup before an operator manually removes only that stale lock. Then
reconcile and submit the exact prepared plan through authorized apply. The library
never guesses that a PID is dead and never automatically removes locks. Orphan
`pending-*.tmp` files can be inspected/removed by the trusted operator after writer
exclusion; they are not promoted as recovery state. Corruption or changed prepared
inputs require offline investigation and a separately approved consistent backup
restore; editing a digest or falling back to an old JSON file is not reconciliation.
There is no generic abandon/migrate/OS-recover operation in this fixture adapter.
