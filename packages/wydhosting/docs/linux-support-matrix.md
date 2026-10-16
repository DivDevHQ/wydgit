# Linux support matrix

**No WydHosting Linux lane is security qualified.** Wydgine's existing independent
standalone profile is unaffected. Package engine minimum remains Node **24.21.0**.

| Environment | Status | Actual evidence |
| --- | --- | --- |
| Ubuntu Server 24.04 LTS amd64 | Experimental candidate | systemd/cgroup-v2 assets and contract tests only; privileged VM not executed |
| Debian 13 amd64 | Experimental candidate | Same assets; Python code avoids removed `spwd`; privileged VM not executed |
| Linux Mint 22.2 x86_64 development machine | Unsupported managed hosting target | Actual unprivileged regression, filesystem and peer-credential tests only |
| Rootless containers/namespaces | Unqualified | Not used to assert account/systemd/firewall isolation |
| Other distributions, architectures, containers | Unsupported | No qualification evidence |
| Almond Linux | Future | No packaging or qualification delivered |

Observed development environment: Linux Mint 22.2 (Zara), kernel
**7.0.0-38-generic**, x86_64, Node **v24.21.0**, npm **11.19.0**, Python **3.12**,
UID/GID **1000:1000**, groups **1000,65534**. The execution surface reported PID 1
`codex`; current cgroup was a user/VSCode scope. The presence of `/usr/bin/systemctl`
is not proof of an authorized system service test environment. Docker CLI exists but
socket access was denied. No QEMU/libvirt/KVM VM facility was found. No attempt was
made to bypass Docker permissions, start a host container daemon, alter cgroups or use
sudo. No VM is implicitly authorized merely because the operator's host runs Linux.

`linuxPreflight()` reads OS release, PID1 name and available cgroup controllers.
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
