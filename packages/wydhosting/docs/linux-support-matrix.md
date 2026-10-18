# Linux support matrix

**Approved roadmap decision — 2026-10-18:** managed, multi-tenant WydHosting
qualification and the Debian 13 VM experiment are deferred to **0.4**. I5.6 remains
**incomplete, experimental and not security qualified**. All six outstanding work
packages, acceptance criteria and evidence requirements below remain in force.
Debian remains a supported target; no VM creation, installation or guest changes
are authorized. Wydgine 0.3 continues toward five-site migrations using independent
Node processes, OS users, secrets and storage behind a conventional reverse proxy;
these deployments do not qualify managed WydHosting. Intermittent `SEWN.LIMIT`
HTTP 500 failures remain a separate unresolved **0.3 reliability issue**.
Authoritative records: `docs/decisions/0003-defer-managed-hosting-qualification-to-0.4.md`,
`docs/milestones/0.3-release-status.md` and `docs/milestones/0.3-reliability.md`.
Pending-decision/next-approval language in the historical sections below is superseded
on scheduling only; technical contracts, trial plans and recorded evidence are retained.

**No WydHosting Linux lane is security qualified.** Wydgine's existing independent
standalone profile is unaffected. Package engine minimum remains Node **24.21.0**.

Latest AlmaLinux 10.2 evidence adds real canonical provider integration, confined
provider and independently categorized workers, same-UID MAC denials, confined Caddy
loopback TLS, actual worker crash/OOM recovery, audited retirement overlaps and bounded
private tmpfs ENOSPC after fixing the actual mount collision. Direct broker MAC is
now demonstrated with same-UID hostile checks; residual manager/account authority,
external network, production firewall, reboot/persistent storage, automatic retirement and
historical HTTP500 gates remain open; no other OS is qualified.
See [verification](verification.md#reliability-diagnosis-and-broker-domain-campaign--2026-10-16) and
[SELinux policy](selinux.md). Earlier environment observations remain historical.

| Environment | Status | Actual evidence |
| --- | --- | --- |
| Ubuntu Server 24.04 LTS amd64 | Experimental candidate | systemd/cgroup-v2 assets and contract tests only; privileged VM not executed |
| Debian 13 amd64 | Experimental candidate | Same assets; Python code avoids removed `spwd`; privileged VM not executed |
| AlmaLinux 10.x amd64 | Experimental candidate | AlmaLinux 10.2 `almond-lab`: 56 real broker/worker checks, 26 kernel checks and unused-zone firewall rollback passed; NOT security qualified |
| Red Hat Enterprise Linux 10.x amd64 | Experimental candidate | Shared platform policy and negative contract tests; no actual RHEL guest tested |
| Older EL releases, Rocky Linux, Oracle Linux, CentOS Stream, Fedora | Planned/unimplemented | No admission through `ID_LIKE`; require separately reviewed release lanes |
| Linux Mint 22.2 x86_64 development machine | Unsupported managed hosting target | Actual unprivileged regression, filesystem and peer-credential tests only |
| Rootless containers/namespaces | Unqualified | Not used to assert account/systemd/firewall isolation |
| Other distributions, architectures, containers | Unsupported | No qualification evidence |
| Almond Linux | Future | No packaging or qualification delivered |

Observed development environment: Linux Mint 22.2 (Zara), kernel
**7.0.0-38-generic**, x86_64, Node **v24.21.0**, npm **11.19.0**, Python **3.12**,
UID/GID **1000:1000**, groups **1000,65534**. The execution surface reported PID 1
`codex`; current cgroup was a user/VSCode scope. The presence of `/usr/bin/systemctl`
is not proof of an authorized system service test environment. Docker CLI exists but
socket access was denied. At the original alpha.15 delivery no QEMU/libvirt/KVM VM facility was found. No attempt was
made to bypass Docker permissions, start a host container daemon, alter cgroups or use
sudo. No VM is implicitly authorized merely because the operator's host runs Linux.

## AlmaLinux follow-up — 2026-10-16

The operator subsequently supplied the disposable KVM guest `almond-lab`. Read-only
SSH inspection verified AlmaLinux **10.2**, kernel **6.12.0-211.65.1.el10_2.x86_64**,
systemd **257-23.el10_2.2.alma.1**, Python **3.12.15**, four CPUs, approximately
8 GB RAM, cgroup v2 with cpu/memory/pids, SELinux **enforcing**, firewalld
**2.4.3-4.el10_2**, and XFS with **noquota**. Node/npm/compiler were absent.
Tests ran as UID/GID **1000:1000** (`nutenkamin`, additional wheel group); the
operator enabled temporary VM-local sudo and `sudo -n id -u` returned 0.

The actual updated broker prerequisite guard passed unprivileged in this guest.
All **28 Python tests** passed there: real current-UID openat2/filesystem/Unix socket
tests plus explicitly mocked administrative/platform negative cases. They do **not**
establish cross-UID account isolation, cgroup enforcement or privileged service
operation. Test transfer used a temporary directory removed afterward. No account,
service, firewall, networking or SELinux provisioning was performed by these checks.
Independent console/snapshot recovery has not yet been verified; the development
user cannot access the host system-libvirt socket. This is not a reason to change
host permissions or bypass recovery requirements.

## Shared platform gate

The packaged `broker/platforms.json` is the single candidate release matrix used by
both the Python broker and Node preflight. It admits explicit `almalinux` and `rhel`
IDs for major release 10 (including numeric minor releases), never `ID_LIKE` matches.
EL-family candidates additionally require `/sys/fs/selinux/enforce` to report `1`;
permissive, disabled or inaccessible SELinux fails closed. No SELinux mode/policy
change is made automatically and no custom confinement policy is claimed. RHEL
results cannot be inferred from AlmaLinux results. Older EL releases remain planned.
Firewalld is recorded as the EL candidate manager. Preview and an administrator-only
unused-zone transaction probe exist; public policy application remains unimplemented.

The fresh-baseline privileged campaign is recorded in [verification](verification.md).
The broker's mandatory openat2 conflict with systemd RestrictSUIDSGID was confirmed
causally and resolved by an authorized broker-only change; workers retain the filter.
Worker/fixture processes ran in `unconfined_service_t`; no
per-tenant SELinux policy is qualified. These findings supersede only the earlier
"unprivileged evidence only" status, not any production or RHEL qualification gate.

`linuxPreflight()` reads OS release, PID1 name, architecture, SELinux enforcement
and available cgroup controllers. It requires x86_64, real systemd and cpu/memory/pids,
matching the broker prerequisites; missing controllers now correctly refuse candidacy.
`candidate:true` means only that those read-only candidate checks match; it is not a
qualification result. Output always records `privilegedQualification:not-executed` and
`productionReady:false`. Preflight does not test certificate validity, firewall safety,
MAC, native module closure, disk quotas, external reachability or recovery access.

Record exact image SHA, kernel, Node/npm/Python/compiler/systemd/Caddy/UFW versions,
cgroup controllers, native Argon2/SQLite paths, filesystem/mount options, recovery
console and test logs for each future VM lane. Ubuntu results cannot qualify Debian;
Ubuntu-compatible scripts cannot qualify Mint, Fedora, AlmaLinux/RHEL or containers.

The privileged broker separately refuses non-amd64, noncandidate distro releases,
non-systemd PID1 or missing CPU/memory/pids cgroup-v2 controllers before OS operations.
Passing those prerequisites still supplies no qualification evidence or production
certification. A valid approval digest cannot override that refusal.
