# Services, cgroups and disposable VM procedure

**Generated candidate units; no actual systemd/cgroup provisioning executed.** Service
syntax/contract review and unprivileged child supervision do not establish these Linux
properties. Never run this walkthrough on the operator's development host.

## Ownership split

| Layer | Responsibility |
| --- | --- |
| Canonical provider registry | Desired placement, package/source/domain approvals and App limits |
| Existing WydHosting supervisor | Durable epochs, readiness/deadlines, health, finite restart budget/backoff and explicit crash-loop recovery |
| Root broker | Approved account/staging/service authorization, authenticated launch, lease ownership and exact unit operations |
| systemd | UID/GID, kernel limits, full cgroup lifetime and forced termination, independently of the worker event loop |
| Wydgine | Actual App initialization, SEAM, execution, canonical service behavior, routing and private listener |

Worker `Restart=no`: systemd must not add a second independent restart loop. Provider
service also defaults to `Restart=no`, leaving ambiguous reconstruction to an operator.
The supervisor's existing maximum five lifetime restart attempts remains. No recovered
numeric PID authorizes a signal. Its original stale-lock/ambiguous-worker checks still
refuse startup; manually reviewing/removing a stale lock does not itself adopt a worker.

Each launch gets a unique unit name containing a pool hash and UUID, plus invocation,
main PID and recorded cgroup. Broker session death is independently linked by `BindsTo`
and ordering. Provider control EOF causes broker to stop the unit; broker crash causes
systemd to stop bound workers. `KillMode=control-group`, ten-second TimeoutStopSec and
SendSIGKILL target blocked descendants. Cgroup `populated 0` includes descendants;
checking only the main PID or top-level cgroup.procs would be insufficient.

Those mechanisms require actual VM SIGSTOP/provider-death/broker-death qualification.
The implementation does not report cgroup death if the broker connection merely closes.
Root lease `starting` without a verified invocation remains an ambiguous manual-recovery
case; the broker does not guess/adopt a service name after interruption.

## Declared limits

| Control | Mechanism | Qualification status |
| --- | --- | --- |
| Pool resident/native memory | MemoryMax, MemorySwapMax=0; OOMPolicy=stop | Not kernel-tested |
| CPU | CPUQuota percent and accounting | Not kernel-tested |
| Processes/threads | TasksMax for unit cgroup | Not kernel-tested |
| Open descriptors | LimitNOFILE per process | Not manager-tested; not an aggregate cgroup FD quota |
| Temporary bytes | Private tmpfs `/tmp`, fixed size; `/var/tmp` inaccessible | Not manager-tested; not persistent storage quota |
| Process lifetime | control-group kill, bounded stop, BindsTo broker session | Not manager-tested |
| Writable persistent data | DAC + ProtectSystem + fixed ReadWritePaths | Not cross-UID tested; no disk quota |
| Outbound networking | AF_UNIX only plus IPAddressDeny=any | Not manager-tested; remote S3/TCP profile unavailable |

No CPU/memory guarantee is inferred from I2 logical request quotas. No persistent
storage quota, I/O throttle, inode quota or AppArmor/SELinux profile is implemented.
A pool can still fill its permitted persistent filesystem without an independently
configured quota; this is a qualification/implementation limitation, not a passing
resource-isolation claim. Do not disable system MAC to make the candidate work.

## Disposable VM walkthrough — operator only, not executed

This procedure requires a **new isolated Ubuntu Server 24.04 amd64 VM**, snapshot,
independent hypervisor console and explicit administrator authorization for that VM.
Debian 13 needs a separate run. No public IP, DNS or commercial certificate is needed.
Use an isolated virtual network. Record the VM/image SHA and versions before changing it.
Do not transfer personal keys, publisher private material or development-host config.

1. Through the VM console establish recovery, confirm the actual SSH port(s)/source
   paths, take a VM snapshot and retain a root console independent of SSH. Record
   `uname -a`, `/etc/os-release`, `node --version`, `npm --version`, `python3 --version`,
   `systemctl --version`, `findmnt`, `cat /sys/fs/cgroup/cgroup.controllers`. Required:
   unified cgroup v2 with memory/cpu/pids, systemd as real PID 1, Node >=24.21.0 and
   standard `/usr/bin/systemctl`, `/usr/sbin/{useradd,groupadd,nologin}`.
2. As an **unprivileged build user** install exact local tarballs into a disposable
   consumer, including only approved canonical library implementations. No arbitrary
   publisher npm dependencies/lifecycle scripts. Build the shipped helper explicitly:

   ```sh
   cc -shared -fPIC -Wall -Wextra -Werror -I /path/to/matching/node/include/node \
     node_modules/wydgine/native/peercred.c -o peercred.node
   ```

   Record compiler/header versions and SHA-256 of sources, `.node`, Node executable
   and every tarball. N-API supplies the ABI; Node 24 socket `_handle.fd` is an explicitly
   qualification-sensitive implementation detail. No postinstall compiler or privilege
   escalation is provided. Remove unused node_modules/.bin symlinks **in this prepared
   disposable closure**, and ensure there are no other symlinks/hardlinks. Never edit
   the host's Node installation.
3. Administrator reviews and copies that exact closure to `/opt/wydhosting/release`,
   with `bin/node` a regular vetted Node executable and `lib/peercred.node` the verified
   helper. All ancestry/files must be root-owned and not group/world-writable. Review
   `broker.py`, `security.py`, `worker.py` and generated service text before root use.
   This is explicit VM provisioning, not an npm install hook.
4. Administrator creates a new restricted nonroot provider service identity with no
   password/shell/supplementary privileges, plus a separate restricted Caddy edge UID.
   Choose and record actual IDs; the example APIs require provider IDs >=1000 and
   worker IDs >=60000. Do not reuse an existing personal or managed system account.
   Edge may have the provider GID for traversal of the edge socket, but cannot use
   broker mode 0600; workers additionally check the actual provider UID.
5. Administrator prepares root-owned `/etc/wydhosting` and `/var/lib/wydhosting`
   ancestry; root-only `broker` state (0700); provider-owned `provider` and
   `provider/supervisor` directories (0700); root-owned `accounts`, `uploads`, `pools`
   parents (0755/0711 as appropriate); `/run/wydhosting` (0755) and
   `/run/wydhosting/workers` (0711). Persist only these runtime parent rules with the
   VM's reviewed tmpfiles configuration; do not chown `/run` broadly. Provider unit
   creates its own `/run/wydhosting/provider` directory. Reboot recreation of broker
   runtime parents remains an operator task until installer qualification.
6. Prepare two service-free canonical Apps under the approved upload layout:
   `/var/lib/wydhosting/uploads/<accountId>/<deploymentId>`. A trusted unprivileged
   builder creates portable content/config before administrator copy; no npm is run
   there. Set config service roots to the final confined `data/files/media` paths if
   enabling canonical services. Root-owned uploads are acceptable; grant only the provider group read/traversal for
   unprivileged approval inspection, never global read of private files or group writes; later customer-owned
   uploads must belong only to the approved UID and have protected ancestry. Construct
   the canonical registry with paid customers/account records, distinct high UID/GIDs,
   fixed account homes and pool bases `/var/lib/wydhosting/pools/<pool>/generations/1`.
   App fingerprints come from `fingerprintApprovedApp` over the prepared source.
7. Use **the existing registry journal**, through `createLinuxRegistry`, to authorize
   registry intent, then inspect the canonical registry. This lane validates intent
   without reading a future cross-UID execution tree. Create a candidate input file:

   ```js
   const input = {registry, options: {
     providerUid, providerGid,
     limits: {memoryBytes:268435456, cpuPercent:50, tasks:64,
              fileDescriptors:512, temporaryBytes:16777216},
     execution: {}, optional: {}
   }};
   ```

   `wydhosting setup --input /absolute/input.json` only prints the candidate plan.
   Administrator independently reviews the exact registry/pool/account/source/byte/
   package/OS policy. Install its `plan` object as root-only
   `/etc/wydhosting/approval.json`, and an identical root-owned provider-readable
   `/etc/wydhosting/provider-approval.json` (0640, provider GID). No request can install
   or rewrite these approvals. This manual reviewed step is mandatory in the candidate.
8. Install shipped broker socket/template units with explicitly substituted numeric
   provider IDs, the provider unit and shared broker slice. Verify with
   `systemd-analyze verify` **inside the VM**. Install `/etc/wydhosting/provider.json`:

   ```json
   {"schema":"wydhosting.linux-provider/1","registryDirectory":"/var/lib/wydhosting/provider","approval":"/etc/wydhosting/provider-approval.json","edgeUid":12345}
   ```

   Replace edgeUid with the actual separate UID. The provider refuses root execution
   and mutable/symlinked configuration ancestry. Start only the broker socket first.
9. As the configured provider service user, use the installed trusted API:

   ```js
   const backend = createLinuxBackend({approval,
     credentialHelper:'/opt/wydhosting/release/lib/peercred.node'});
   await backend.operation('ensure-account', poolId);
   await backend.operation('stage', poolId);
   ```

   Verify actual passwd/group/shadow/home ownership with root-scoped diagnostics that
   do not print password hashes. Start the provider service only after reviewing its
   complete registry/approval and retain console recovery. Capture unit MainPID,
   InvocationID, cgroup, actual process UID/GID/Groups, environment FD inventory and
   filesystem permissions. Do not call this step qualified before all attacks below.
10. Use locally generated ephemeral TLS certificates for approved `.test` hostnames.
    Review the shipped Caddy candidate, substitute exact host/certificate paths and
    run its validator before starting it as the separate edge UID. Certificate/key
    scope must be private and declarative. Verify HTTPS/origin/cookie/header behavior
    and native credential checks through the whole Caddy/provider/worker route.
    No real DNS or public certificate issuance is involved.

## Required actual attacks and evidence

In the VM use the exact recorded unit/cgroup identities, not numeric PID guesses:

- Under customer A's restricted identity attempt reads/writes of customer B's code,
  data, runtime sockets and `/proc` descriptors; verify real EACCES and actual worker
  UID/GID/groups. Under each customer attempt broker operations; verify refusal before
  account/OS side effects. Verify shared free Apps still share their designated UID.
- Race uploaded files/ancestors through symlinks, hardlinks, rename, mount substitution,
  ownership changes and concurrent stage/reconcile. Verify the approved manifest bytes
  or fail-closed quarantine, never redirected bytes. SIGKILL staging and inject disk
  full; confirm previous generation/data remains intact.
- Connect as wrong UID, wrong pool, wrong generation, stale invocation and replayed
  challenge to the worker-control socket. Kill broker/provider at every launch phase.
  Freeze an actual worker, kill its provider/broker session and verify systemd forcibly
  empties the entire cgroup while a healthy sibling remains available. Never infer
  termination just from lost health.
- In a separately reviewed **hostile VM-only worker fixture**, allocate memory beyond
  MemoryMax and attempt process/thread creation beyond TasksMax; observe memory.events,
  pids.events, CPU throttling/accounting and actual exit reason. Keep a real healthy
  canonical App in another pool serving throughout. Do not add a portable process or
  arbitrary allocation API merely to test the kernel. Tests for this hostile service
  fixture are not delivered/executed in this checkout.
- Probe worker sockets as an unauthorized local UID; forge Host/Forwarded/X-Forwarded
  and Origin, route to another pool, retire endpoint and retry. Verify listener PID/UID
  through SO_PEERCRED, exact ready generation and no TCP listener.
- Reboot/power-cycle only the disposable VM; verify no ambiguous service adoption,
  preserved registry/lease/data and fail-closed stale ownership. Runtime parent and
  interrupted lease reconciliation need independent review; no automatic repair is
  claimed. Execute the firewall procedure only after a live adapter exists.

Capture sanitized process/routing/deadline/error-category observations, not keys,
passwords, sessions or customer content. Retain failures alongside successful reruns.
Only the exact passing image/lane can acquire a tested status.

## Rollback

Use the independent VM console. Stop provider first, inspect root broker status and
stop/reconcile only exact recorded owned services. Verify cgroup emptiness before
resource reuse. Disable only the new WydHosting socket/service units; preserve all
unrelated services, networking, SSH and firewall state. Keep approval, registry, lease
and quarantined/staged data for diagnosis. Do not delete accounts or reuse UIDs while
old files remain. For an ambiguous pre-invocation lease, inspect the exact generated
unit and cgroup through the console; no automated adoption is supported. Restore the
VM snapshot or destroy the VM after collecting evidence. Code rollback is an ordinary
revert; filesystem/data rollback is not assumed safe across schema/writer changes.
