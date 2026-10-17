# Interrupted campaign recovery — 2026-10-17

Recovered on `develop/0.3` at `dc254c8e0309d0fa890b8e752fdedeee9e2f7305`,
equal to freshly fetched origin. No local commits or staged files existed. All
interrupted changes and untracked sources were preserved. No active test/qualification
process was found modifying the checkout. Historical committed evidence remains;
previous `/tmp/wydgit-i56-outcome*` logs/builds were absent on both sandboxed and ordinary
host inspection. Their results cannot be reconstructed or promoted to passing evidence.

## Independently delivered scope

The HTTP completion correction is documented in [operation completion](operation-completion.md).
It settles admitted service calls before responding even when teardown throws, revokes
new work through the shared Page ledger, checks JSON/SQLite precommit boundaries and
adds JSON directory fsync. Deadline HTTP 500 remains 500. The additive outcome header
and indeterminate document explicitly avoid a rollback promise. A failure after
possible effects supersedes buffered output with the indeterminate response. This is
a documented correction, not a generic Page idempotency protocol. Version remains
`0.3.0-alpha.15`; no manifests, dependencies or lockfiles changed.

Reviewed repository checks pass **939/939** and content validation passes; the installed
canonical consumer passes **156/156**, including seven completion cases. Fresh focused
results: **13/13**. These cover successful durable writes, precommit
expiry, JSON rename already submitted at expiry, SQLite revocation inside its
transaction, post-rename durability failure, stable-ID retry conflict, reopening
both stores for reconciliation, real server-observed connection loss and held-request
drain with a healthy sibling. The initial resumed run passed 11/13: two recovered
connection-loss fixtures incorrectly expected EVENT.DENIED. Store sanitization plus
SEWN's subsequent revoked-ledger check produces SEWN.LIMIT. The corrected fixtures
observe an actual server-side close before releasing storage and assert no record
was committed; the diagnostic alone does not distinguish cancellation from timeout.
Both attempts are retained in fresh evidence. No execution limit/assertion was relaxed.

The historical uninstrumented Contact incidents remain unattributed. Forced worker
termination mid-commit, durable Page receipts, generic HTTP submission deduplication
and cross-process crash reconciliation are not established by reopening library
handles. Arbitrary trusted libraries must supply their own completion contracts.
A stuck admitted call can hold draining until existing supervisor termination acts.

## Preserved uncommitted privileged candidates

These are recovered implementation drafts, not part of the HTTP-only delivery and
not verified on a live guest. Do not install them based on ordinary-user tests.

- `packages/wydhosting/broker/broker.py`: administrator identity proof verification
  and exact stopped-generation job/socket cleanup.
- `packages/wydhosting/broker/provision_accounts.py`: new offline administrator
  provisioning candidate; no new socket service or generic root command interface.
- `packages/wydhosting/selinux/wydhosting_worker.cil` and
  `templates/wydhosting-broker@.service`: candidate removal of account-tool execution,
  account-database writes/shadow reads and SETUID/SETGID/AUDIT_WRITE authority.
- `test-support/linux/{qualify.py,qualify-integrated.py,verify.py}` and
  `test/linux-isolation.test.js`: preserved account/retirement tests and MAC probes.
- `accounts-and-filesystem.md`, `broker-security.md`, `firewall-and-recovery.md` and
  `selinux.md` in this directory and `packages/wydhosting/docs`, plus the remaining
  CHANGELOG notes: draft documentation accompanying those uncommitted candidates.

The fresh ordinary-user Python primitive suite passes **38/38**. Its administrative
mocks do not prove the candidate SELinux permissions, offline provisioner, root
filesystem ownership, effective capabilities or installed cross-UID lifecycle.
Review before qualification: the provisioner currently seals its marker before its
final shadow-lock verification; exact retirement should independently require a
terminal manager state and empty cgroup immediately before deleting job artifacts.
The current unit-write/start/reload authority still allows potential indirect root
execution and account management. Fixed administrator templates and a separately
constrained manager boundary remain a production gate; no compromise containment
claim is justified by merely removing direct account permissions.

## Guest and operational checkpoint

Fresh SSH to `almond-lab` / `192.168.122.225` failed **No route to host**. Consequently
no fresh guest identity, enforcement, SSH/firewalld health, cleanup or interrupted
campaign-resource inventory can be certified. The interrupted session had attempted
a bounded campaign under `/var/tmp/wyd-i56-outcome`; its execution/result and remaining
resources must be inspected on recovery. No new guest mutation occurred in this resume.
No reboot/start, active-zone firewall rule, quota experiment or privileged Mint change
was attempted. Existing permissions do not authorize these deferred operations.

**Best next action:** restore operator-provided reachability to the already-authorized
guest without rebooting it, inspect `/var/tmp/wyd-i56-outcome` and exact hosting/unit/
account state read-only, recover retained journals, then review the privileged drafts
before deciding whether to run a bounded installed qualification. Do not blindly
rerun the harness or remove resources by names/patterns.

Fresh host logs live in `/tmp/wydgit-i56-resume`; a compact durable evidence record
and final required/packed results are linked from [verification](verification.md).
Resolve the delivered SHA with `git log -1 --format=%H --` this file; verify remote
and remaining work with `git status --short` and `git ls-remote origin refs/heads/develop/0.3`.
I5.6 remains experimental and not production-security-qualified. I5.7 was not begun.


## Subsequent privileged resume

Fresh SSH recovery and reviewed privileged drafts were qualified in a bounded
99/99 installed campaign later on 2026-10-17. See the final
[privileged resume evidence](verification.md#privileged-drafts-resumed--2026-10-17).
The earlier connectivity failure and unverified-draft descriptions above are retained
as historical checkpoints. I5.6 remains experimental; indirect manager authority and
backup/console/interruption gates remain open.
