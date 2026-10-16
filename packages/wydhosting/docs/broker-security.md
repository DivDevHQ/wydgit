# Privileged broker security contract

**Implemented candidate, 56 real AlmaLinux broker/worker checks passed; NOT qualified.**
A causal on/off/on experiment confirmed systemd 257 RestrictSUIDSGID returns ENOSYS
for mandatory openat2 calls. Under explicit authorization, only the trusted broker
omits that directive. Workers retain it; all other restrictions remain unchanged.
The broker loses this extra SUID/SGID-marking filter; NNP is not an equivalent ban
on creating those mode bits for other processes. No unsafe path fallback was added.
Sanitized startup events now record a fixed phase/code without paths or exception text.
See [verification](verification.md). Python 3 standard library;
no package installer, JavaScript evaluation, submitted executable, shell command,
arbitrary path operation or portable capability. Files ship under WydHosting `broker/`;
reviewed service/socket assets ship under `templates/`.

The [integrated follow-up](verification.md#integrated-enterprise-campaign--2026-10-16)
adds root-approved account SELinux categories, descriptor-applied deployment/runtime
labels, nonrecyclable category markers and actual domain verification before launch.
On an enforcing guest a missing category refuses execution. Provider/workers now have
an experimental confined policy; the root broker now has the experimental
`wydhosting_broker_t` domain. Actual direct-access denials pass; shared account and
managed-unit/manager authority remain **not production compromise qualified**.
See [SELinux](selinux.md).

## Installation trust

Administrator installs a reviewed immutable runtime closure at
`/opt/wydhosting/release`, broker approval at `/etc/wydhosting/approval.json` and
systemd socket/template units. The installed broker and every dependency must already
have protected root-owned ancestry before root executes it. Self-checks cannot make
executing untrusted installer code safe. Build/install dependencies unprivileged,
verify artifacts independently, then install only reviewed files. No npm as root.

Broker starts via `/usr/bin/python3 -I` with a fixed absolute script. Python ignores
publisher cwd/PYTHONPATH. It loads only its protected sibling security module and OS
standard libraries. Before operations it walks the installed release through held
descriptors, rejecting symlinks, hardlinks, mount crossings, special files and any
non-root owner or group/world-writable entry. The release check limits entries/depth.
Unused npm `.bin` links must be removed from the prepared runtime closure, or the
check refuses. This release shape passed the installed AlmaLinux VM campaign;
other runtime/library closures still need separate qualification.

The long-running provider is nonroot, with no capabilities. Broker sessions are root
because fixed account tools and system service operations require it. The service
limits retained capabilities, address families, memory/tasks/descriptors, host writes,
core dumps and inherited environment. Account tools need atomic writes/locks in `/etc`;
the template honestly permits that directory rather than claiming file-only writes
would safely support `useradd`. NoNewPrivileges prevents acquired privilege. Dedicated
experimental broker MAC is delivered, with verified startup context and
read-only approval/systemd configuration mounts. A capability-split account/service
helper and containment of indirect manager execution remain undelivered.

## Closed protocol

One request per accepted provider connection:

```json
{"schema":"wydhosting.broker/1","operation":"stage","poolId":"pool","policyRevision":"<64 hex>","body":{}}
```

256 KiB raw frame limit; strict UTF-8/JSON, duplicate/reserved-key and unsafe numeric
refusal, bounded depth/value count and ten-second initial deadline. Root approval is
separately bounded at 4 MiB. Unsupported fields or operations fail closed.

| Operation | Parameters and authorization | Implemented effect |
| --- | --- | --- |
| `ensure-account` | Empty body, approved pool/account | Verify or create exactly that restricted account; never adopt an existing unmanaged identity |
| `stage` | Empty body, approved descriptor/source/placement | Copy a fresh sealed generation; no existing generation replacement |
| `launch` | Exact pinned bootstrap, new epoch/lifetime | Start fixed reviewed unit; authenticate its actual main peer; relay worker control only |
| `status` | Empty body, approved pool with recorded lease | Controlled systemd accounting/status after unit-byte/invocation/cgroup ownership checks |
| `reconcile` | Empty body, approved recorded lease, no active session lock | Stop exact owned service through manager, verify empty cgroup and retain stopped lease |

No generic `stop PID`, `writeFile`, `chown`, `systemctl args`, `eval`, `npm install`,
firewall apply, arbitrary service update or destructive retirement operation exists.
Unsupported live firewall application is refused in the provider API.

## Authentication and authorization

Systemd creates broker Unix socket mode **0600**, owned by the configured provider
UID/GID. Every accepted session additionally obtains **SO_PEERCRED** from its native
socket and compares actual UID and primary GID with the root approval. No submitted
provider ID/UID/nonce/revision substitutes for that check. The Node client verifies
the broker peer is actually UID 0 before transmitting a request.

Root approval pins provider identity, canonical registry digest/revision, named pool,
account, exact source location, all file hashes/sizes, destination generation, inventory,
package approval map, optional policy and separate OS limits. Installing that exact
file is explicit administrator authorization for the five listed operations on those
resources. A valid provider registry by itself grants no Linux operation. There is
currently one OS provider principal, not customer/operator role delegation or a remote
admin API. Provider ID, pool ID and policy digest are integrity/resource selectors.

Per-pool nonblocking `flock` serializes account/stage/launch/reconcile. A launch holds
the lock for its entire control session; another launch/retire cannot race it. Account
creation shared by multiple same-customer pools may fail conservatively on concurrent
creation and require operator review. There is no automatic account adoption/recycling.

## Worker authentication and lifecycle

The restricted Python launcher connects to a root-owned broker-created Unix socket,
checks its root peer and sends only pool/generation. Broker checks kernel UID/GID/PID,
actual systemd MainPID, invocation ID and exact `/proc/<pid>/cgroup` membership, then
performs a fresh **256-bit** one-use challenge exchange. Knowing a challenge alone
cannot satisfy the UID/PID/unit checks. Nonces never appear in argv, environment,
logs, HTTP, readable job files or registry. Launcher execs the fixed installed Node
worker retaining the connected stream on FD 3 and the same main PID. A new lifetime
gets a new socket/challenge/generation; there is no reconnect/replay authority.

Public launch job files contain only endpoint, pool, generation and schema; mode 0444
is intentional. Customer sockets may be reachable for the handshake, but only the
expected main process can authenticate. Broker listen/handshake deadlines and systemd
limits bound this exposure; hostile local connection-load qualification remains pending.

Root lease records intent **before** systemd start and records invocation/cgroup and
unit SHA afterward. Interrupted ambiguous starts are refused for manual inspection.
An existing service is never adopted because its name/PID matches. Stop checks the
protected unit bytes plus live invocation/cgroup, or proves inactive service and empty
recorded cgroup. Only `systemctl stop <derived exact unit>` is used; never `kill(pid)`.
Snapshot-root changes over a prior lease refuse `BROKER.MIGRATION_REQUIRED`.

## Audit and errors

The [continued campaign](verification.md#reliability-and-confinement-continuation--2026-10-16)
reproduced ECONNRESET during concurrent peer shutdown. Reset/broken pipe now follow
the EOF retirement path; malformed frames and other OS errors remain failures. No
peer disconnect alone authorizes a successful cleanup acknowledgement. A disappearing
main PID after an active manager snapshot requires one fresh verified terminal
snapshot and empty cgroup; changed live ownership or ambiguous states still refuse.
Unexpected OS errors log only a closed `failureOs` vocabulary alongside phase/kind,
never exception text or arbitrary errno descriptions. The exact old uninstrumented
failure cannot be retrospectively attributed to either demonstrated defect.

Bounded JSON events to journald include actual `uid:<n>` principal, approved operation,
resource, policy revision, generation, started/completed/refused outcome and a fixed
sanitized code. Denials before validated request selection record `refused`; no raw
submitted identity, exception, path, payload, tokens, keys or customer data is echoed.
The root lease/account markers supplement the journal for interrupted work. Journald
retention/forwarding is an administrator responsibility; a fresh installation must
configure bounded journal storage. Failed channel ownership returns unavailable, not
success. A broker disconnect without explicit cgroup-empty confirmation leaves the
supervisor ownership unknown and prevents automatic reuse.

Unit/schema/request tests simulate some administrative failures. Actual root caller
authorization, cross-UID launch, service identity, status/reconciliation and provider-
disconnect cleanup now pass on AlmaLinux 10.2. Replay/load, interrupted startup,
MAC and complete provider/proxy installation remain unqualified. The broker is not
approved for production deployment.

Lifetime verification additionally pins the kernel process start-time, and provider
checks actual `/proc/<peer>/cgroup` and start-time on each newly connected worker
endpoint before sending HTTP. A matching numeric PID/UID alone is insufficient.
Unavailable process metadata fails closed; the exact procfs policy needs VM testing.
Provider diagnostics distinguish credential/header refusal, permission/socket errors,
readiness/generation loss, deadlines and worker HTTP failures without raw requests,
cookies, paths or exception strings.

Before systemd starts a worker, the broker verifies its effective FragmentPath is
the exact protected generated unit, DropInPaths is empty, identity/restart/kill/
NoNewPrivileges policy matches, and no process is already active. An /etc unit or
unreviewed global drop-in cannot override the generated service silently. These
manager-field checks have contract tests and actual AlmaLinux service/lease evidence;
hostile global drop-in and interrupted-start VM attacks remain unqualified.
