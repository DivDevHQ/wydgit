# Experimental SELinux provider, worker, edge and broker confinement

**Experimental account/retirement candidate:** see the 2026-10-17 privileged
resume evidence in [verification](verification.md); production qualification remains open.

This is an I5.6 qualification candidate, not a production security certification.
The installed provider, two real Wydgine workers and separate Caddy edge have executed
on AlmaLinux 10.2 in enforcing, distinct confined domains/categories. The privileged
Python broker now executes in `wydhosting_broker_t`, with actual direct-access
denials. Its unit-writing/manager authority still prevents
a claim of full broker-compromise containment. Reboot installation and the remaining
hostile interruption matrix remain gates. Do not infer RHEL, Rocky Linux or Oracle
Linux qualification.

## Authority and domains

The reviewed module is `selinux/wydhosting_worker.cil` inside the WydHosting package.
It installs no permissive domain, boolean, unconfined-domain attribute, worker
capability, worker TCP/UDP permission, ptrace, worker relabel permission or worker system-file write.
It grants systemd access only to the new hosting object types needed to build its
existing mount sandbox and service runtime directories. NoNewPrivileges remains on;
the explicit `nnp_transition` rules permit init to enter the confined provider,
worker, edge and broker domains. There is no automatic transition to an unconfined
worker.

| Subject | Actual candidate context | Scope |
| --- | --- | --- |
| Provider, UID/GID 61050 | `system_u:system_r:wydhosting_provider_t:s0` | Own journal/state and edge socket; root-reviewed configuration read; authenticated broker/worker connections and lifetime metadata read |
| Tenant A, UID/GID 61051 | `system_u:system_r:wydhosting_worker_t:s0:c51` | Approved code read, own categorized data/runtime access, root-broker Unix control |
| Tenant B, UID/GID 61052 | `system_u:system_r:wydhosting_worker_t:s0:c52` | Same permissions, independently categorized resources |
| Root broker | `system_u:system_r:wydhosting_broker_t:s0` | Typed managed resources, fixed systemctl executable, verified context and existing closed operations; three capabilities retained |
| Separate edge, UID/GID 61053 | `system_u:system_r:wydhosting_edge_t:s0` | Own executable/config/state, provider Unix endpoint and HTTP-port-type TCP ingress; no worker/broker socket or tenant-data access |

Identity and SELinux labels do not grant SEAM capabilities. No raw process or file API
has been added to ordinary Wydgits. Workers retain RestrictSUIDSGID, empty capabilities,
NNP, mount/network/namespace restrictions and the existing cgroup limits. Its explicit
bounded private tmpfs supplies `/tmp` isolation; PrivateTmp=yes previously shadowed
that mount on the actual guest. `/var/tmp` remains inaccessible. The previously
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
complete cross-tenant/load qualification. The continuation also verifies same-UID
c51 → c52 **sock_file write**, **process signal**, **proc-directory search** and
**runtime-file execute** denials, with successful same-category execution/SIGCONT.
These are actual AVC-backed category checks. Relabel denial is TE across all
categories. Proc inspection is denied before ptrace; abstract sockets, process
information side channels and all native-library closures remain unqualified.

The trusted provider is intentionally not MCS constrained: it must route to all
approved tenants. It cannot relabel their files or write sealed code/root state.
Its exposure remains part of the trusted computing base. The trusted broker is
intentionally allowed cross-category staging/labeling over
managed resources. Root administration remains outside these tenant boundaries;
broker indirect service-manager authority still requires a narrower architecture.

## Confined edge and privileged broker

The same module defines `wydhosting_edge_exec_t` for
`/opt/wydhosting/edge/caddy`, `wydhosting_edge_config_t` for the exact Caddyfile,
certificate and key, and `wydhosting_edge_state_t` for its dedicated state tree.
The fixture selects `SELinuxContext=system_u:system_r:wydhosting_edge_t:s0` explicitly
and verifies the actual process context before TLS requests. There is no automatic
transition or production installer/edge-service manager implied by the fixture.

The edge can read its typed configuration/key, execute its own binary, maintain its
typed state and connect to the provider's typed Unix endpoint. It cannot read tenant
code/data, connect to worker/broker endpoints, relabel files, execute arbitrary bin_t
programs, write system files or initiate outbound TCP/DNS/UDP. Its only capability is
NET_BIND_SERVICE. An actual DAC-readable valid config relabeled `wydhosting_data_t:c52`
validates outside confinement, then fails in edge_t with a read AVC (`permissive=0`).
Both configured tenant routes and proxy restart pass in the real confined service.

Residual edge trust is explicit: `http_port_t` may contain several distribution-defined
ports, and `node_t` bind permission is not a loopback-only MAC rule. The tested Caddy
configuration binds loopback, but a compromised edge can use its allowed TCP listener
rights more broadly. It terminates TLS, holds test keys and can send authenticated
requests to any provider-approved route. Header hygiene, credential checks, provider
authorization and firewalld remain independent boundaries. Its runtime reads procfs
and distro files; there is no claim of eliminating all host information side channels.

## Dedicated broker domain and its limits

The broker service explicitly selects `system_u:system_r:wydhosting_broker_t:s0`.
On SELinux-required lanes, broker startup independently verifies that exact current
context before release/approval/socket access. An actual root invocation in an
unconfined domain refuses `BROKER.SELINUX_DOMAIN`; a mocked test also refuses a wrong
category. No automatic/unconfined fallback, permissive domain or capability expansion
exists. Provider/worker connections now target the dedicated broker type.

| Object type | Intended resources | Broker access |
| --- | --- | --- |
| `wydhosting_broker_approval_t` | Exact `/etc/wydhosting/approval.json` | Read only |
| `wydhosting_broker_state_t` | Root broker leases, locks and reservation markers | Durable atomic updates; no host-type relabel |
| `wydhosting_upload_t` | Reviewed upload tree | Descriptor-held reads only |
| `wydhosting_account_t` | Managed account directories | Create/own directories; no general home-file access |
| `wydhosting_code_t`, `wydhosting_data_t`, `wydhosting_run_t` | Approved generated tenant resources | Stage, seal, label and authenticate categorized ingress |
| `wydhosting_broker_unit_t` | Broker-created unit files, including atomic temporary files | Create/publish/read; manager start/stop/status for this type |
| `passwd_file_t` | Live passwd/group identity | Read only; no shadow access or account database updates |
| `wydhosting_broker_approval_t` | Administrator-sealed `/etc/wydhosting/accounts` | Read only; no proof creation/replacement |

Python's distro `bin_t` entrypoint needs `execute` during init's explicit transition,
but lacks `execute_no_trans`. Actual `/usr/bin/true` fails the latter; `/bin/sh` fails
`shell_exec_t` execution. Only the `systemctl` executable type can execute in-domain. Account-tool execution
is denied; offline administrator provisioning is outside this domain. Their arguments remain generated by the unchanged closed
broker implementation; no publisher command, script, path or shell surface is added.
Read-only loader/Python/OpenSSL/platform/SELinux-label resources and init/worker process
metadata support the existing checks. Optional ioctl/NSS denials remain denied rather than being allowed merely to silence audit.

Actual root same-UID canaries prove `signal` and Unix `connectto` denials against a
provider-domain process/socket. Host-file write, foreign provider-tree read, generic
exec, shell exec, TCP socket creation, host-type relabel and foreign-service start
also fail with current-probe AVCs, `permissive=0`. AF_INET is deliberately admitted by
the probe's syscall filter, and writable host mounts/DAC permissions avoid crediting
systemd sandboxing or distinct UIDs for those MAC results. The normal broker keeps its
stricter systemd restrictions. `/etc/systemd` and `/etc/wydhosting` are additionally
read-only inside it. The broker-only RestrictSUIDSGID exception and NNP remains; the capability bound is reduced to CHOWN/DAC_OVERRIDE/FOWNER.

**This does not contain every consequence of a broker compromise.** Direct account
creation/database authority, shadow reads, account-tool execution and SETUID/SETGID/
AUDIT_WRITE have been removed. `/etc` is read-only in the normal service. The offline
administrator provisioner seals exact identities in a separately read-only approval
type; ordinary broker state cannot attest provisioning.

CHOWN, DAC_OVERRIDE and FOWNER remain. Managed-unit byte writes, starts and manager
reload may still permit indirect privileged execution through systemd, including
account commands. Direct denials do not prove otherwise. Type-based directory access
is not filename/content validation; unit naming, generated path/argument checks,
empty drop-in checks and durable ownership validation remain trusted broker code.
Transient services, arbitrary unit properties/environment/aliases/dependencies and
security contexts are not exposed by the closed protocol; this is code validation,
not a proof against a compromised broker using its manager access directly.

Do not add blanket permissions to work around this gate. Immutable administrator
unit templates and a separately confined launcher must independently validate root
approval, exact generation/lease ownership and a closed operation vocabulary. Then
remove session-broker unit-write/reload authority. That manager split is **not
implemented**; current confinement is experimental, not production compromise
containment. See [broker contract](broker-security.md) for account provisioning and
bounded exact job retirement.

## Reproducible installation and limits

On the authorized disposable guest, after installing the reviewed immutable closure:

```sh
sudo semodule -i /opt/wydhosting/release/node_modules/wydhosting/selinux/wydhosting_worker.cil
sudo restorecon -RF /opt/wydhosting/release /var/lib/wydhosting/provider
sudo restorecon -RF /var/lib/wydhosting/broker /var/lib/wydhosting/uploads /var/lib/wydhosting/accounts
sudo restorecon -F /etc/wydhosting/approval.json
# Administrator-only, before activating the broker:
sudo /usr/bin/python3 -I /opt/wydhosting/release/node_modules/wydhosting/broker/provision_accounts.py
sudo restorecon -RF /etc/wydhosting/accounts
sudo restorecon -F /var/lib/wydhosting /var/lib/wydhosting/pools /run/wydhosting /run/wydhosting/workers
sudo restorecon -F /etc/wydhosting/provider.json /etc/wydhosting/provider-approval.json
# After starting the broker socket, restore its exact published inode label:
sudo restorecon -F /run/wydhosting/broker.sock
# If installing the separately reviewed edge executable/unit/configuration:
sudo restorecon -RF /opt/wydhosting/edge /var/lib/wydhosting/edge
sudo restorecon -F /etc/wydhosting/Caddyfile /etc/wydhosting/edge.crt /etc/wydhosting/edge.key
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
