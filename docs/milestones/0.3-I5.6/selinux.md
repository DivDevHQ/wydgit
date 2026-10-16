# Experimental SELinux provider and worker confinement

This is an I5.6 qualification candidate, not a production security certification.
The installed provider and two real Wydgine workers have executed on AlmaLinux 10.2
in enforcing, distinct confined domains/categories. The privileged Python broker and
the disposable Caddy edge still use the distribution's `unconfined_service_t` domain.
Their dedicated MAC policies, reboot installation and a broader hostile-access matrix
remain gates. Do not infer RHEL, Rocky Linux or Oracle Linux qualification.

## Authority and domains

The reviewed module is `selinux/wydhosting_worker.cil` inside the WydHosting package.
It installs no permissive domain, boolean, unconfined-domain attribute, worker
capability, network socket permission, ptrace, relabel permission or system-file write.
It grants systemd access only to the new hosting object types needed to build its
existing mount sandbox and service runtime directories. NoNewPrivileges remains on;
the two explicit `nnp_transition` rules permit init to enter the confined provider
and worker domains. There is no automatic transition to an unconfined worker.

| Subject | Actual candidate context | Scope |
| --- | --- | --- |
| Provider, UID/GID 61050 | `system_u:system_r:wydhosting_provider_t:s0` | Own journal/state and edge socket; root-reviewed configuration read; authenticated broker/worker connections and lifetime metadata read |
| Tenant A, UID/GID 61051 | `system_u:system_r:wydhosting_worker_t:s0:c51` | Approved code read, own categorized data/runtime access, root-broker Unix control |
| Tenant B, UID/GID 61052 | `system_u:system_r:wydhosting_worker_t:s0:c52` | Same permissions, independently categorized resources |
| Root broker | `system_u:system_r:unconfined_service_t:s0` | Existing closed root operations, unchanged capabilities and worker lifetime authentication |
| Separate edge, UID/GID 61053 | Distribution unconfined service context | Disposable loopback TLS proxy; no broker socket access |

Identity and SELinux labels do not grant SEAM capabilities. No raw process or file API
has been added to ordinary Wydgits. Workers retain RestrictSUIDSGID, empty capabilities,
NNP, mount/network/namespace restrictions and the existing cgroup limits. The previously
authorized broker-only RestrictSUIDSGID decision is preserved.

## Category allocation and sealing

An administrator may supply `selinuxCategories` to `createLinuxPlan`, keyed by canonical
account ID. A nonempty map must cover every active account and assign distinct integer
categories **1–1023** to distinct accounts. Pools for the same account share its category,
just as they share its UID. Shared free pools remain one security identity/category;
they do not gain hostile per-App MAC separation.

The root approval pins each pool's `selinuxCategory`. The broker validates category
uniqueness/consistency again and creates protected, nonrecyclable category/account
ownership markers. A later approval cannot adopt another account's category or change
an account's category while its marker remains. No category recycling is implemented.
Partial reservation fails conservatively; it is not automatically reassigned.

During staging the broker labels only held descriptors to newly generated resources.
Pool/generation parents and execution inputs receive `wydhosting_code_t:s0:cN`;
only each approved App's fixed `data`, `files`, and `media` subtrees receive
`wydhosting_data_t:s0:cN`. A nested execution directory called `data` stays code.
Labels are verified and fsynced. Runtime directories receive `wydhosting_run_t:s0:cN`
before systemd starts the launcher. The service selects the fixed worker domain plus
that category, and the broker verifies its actual context before authentication.
The Python-to-Node exec retains the confined context and FD 3.

On an enforcing system the broker refuses a launch without a category, and the
provider refuses missing category approval or an unexpected provider domain. Missing
policy/labels fail closed; neither silently falls back to an unconfined worker.
Ubuntu/Debian without SELinux retain their separate experimental lane:
[systemd ignores SELinuxContext when SELinux is disabled](https://github.com/systemd/systemd/blob/v257/man/systemd.exec.xml).
The historical nonintegrated VM runner is no longer a valid way to launch unconfined
EL workers; use the category-aware `--integrated` campaign.

## Why shared type plus DAC alone was insufficient

A shared confined type could restrict tenant access to host resources while relying
on separate UIDs for tenant separation. That would not independently stop access to
another tenant's mistakenly readable file. The candidate therefore also marks the
worker domain `mcs_constrained_type` and assigns independent account categories.
The VM canary deliberately gives the **same UID**, ordinary read/write mode and the
same data type to own/foreign files. Own-category access succeeds; foreign-category
read/write and relabel attempts return EACCES. Actual AVCs identify c51 → c52 and
`permissive=0`. This proves independent MAC for that tested file boundary, not a
complete cross-tenant socket/process/load qualification.

The trusted provider is intentionally not MCS constrained: it must route to all
approved tenants. It cannot relabel their files or write sealed code/root state.
Its exposure remains part of the trusted computing base. Root and the unconfined
broker can bypass tenant MAC; a dedicated broker policy is still required by the
full production qualification mission.

## Reproducible installation and limits

On the authorized disposable guest, after installing the reviewed immutable closure:

```sh
sudo semodule -i /opt/wydhosting/release/node_modules/wydhosting/selinux/wydhosting_worker.cil
sudo restorecon -RF /opt/wydhosting/release /var/lib/wydhosting/provider
sudo restorecon -F /var/lib/wydhosting /var/lib/wydhosting/pools /run/wydhosting /run/wydhosting/workers
sudo restorecon -F /etc/wydhosting/provider.json /etc/wydhosting/provider-approval.json
# After starting the broker socket, restore its exact published inode label:
sudo restorecon -F /run/wydhosting/broker.sock
```

Do **not** recursively restore generic labels over categorized pool generations or
active worker runtime directories. Their dynamic labels belong to the broker's
root-reviewed category mapping, not a blanket static file-context rule. Provider
runtime/configuration paths have persistent exact file-context rules. Boot-time
parent recreation, category reservation recovery and service activation still need
an independently recovered VM console/backup and reboot qualification.

The module allows read-only distro loader/Python/locale/public crypto-policy resources.
The distro Python entrypoint shares `bin_t`, so a native compromise may execute other
`bin_t` binaries while remaining in the confined worker domain. It cannot acquire a
different domain/capabilities through this policy. Node's JIT requires `execmem`;
writable App code does not receive executable file permissions. Private `/tmp` file
creation and broad native-library/service closures are not qualified by the sample
App. Disk quotas remain absent on the tested `XFS noquota` filesystem.

The canary briefly uses `semodule -DB` to expose suppressed denials, then restores
normal logging with `semodule -B` in a finally block. This changes audit visibility,
never enforcement or access decisions. Expected terminal-ioctl, optional cgroup
inspection and inherited logging-socket denials are not blindly converted into allows.
OpenSSL configuration traversal and reading its include directory are legitimate
runtime requirements; those narrowly typed read permissions are included.

The qualification fixture refuses a preexisting module, installs it reproducibly,
records its SHA-256, stops exact owned services before deleting disposable trees, and
removes only the module it installed. See [verification](verification.md) for retained
failures, current results and remaining blockers. The system-wide policy/enforcement
mode is never disabled or made permissive.
