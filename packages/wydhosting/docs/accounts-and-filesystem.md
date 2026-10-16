# Restricted identities and filesystem ownership

**Candidate implementation; actual broker account/staging and cross-UID checks passed
on AlmaLinux 10.2.** See [verification](verification.md) for the 53-case campaign and
remaining hostile-mount, MAC and recovery gaps. No development-host account, group,
sudo, SSH or home directory changed.

## Identities

The canonical registry still distinguishes customer, account, pool, App, domain,
placement and Gate membership. The broker derives a bounded hashed `wyd-<id>` login
name from approved accountId; it does not infer ownership from that spelling. Numeric
UID/GID are explicitly approved, equal and at least 60000, distinct from provider IDs.
Existing names, UIDs or groups without exact broker ownership markers are refused.

New accounts use a locked password, `/usr/sbin/nologin`, no account-creation scripts
from publishers, no new home-copy/skel operation and no supplementary groups.
Verification checks passwd/group/shadow, primary group and exact empty supplemental
group list. It does not edit sudoers, sshd, authorized_keys or any existing Node
installation. Worker unit additionally uses NoNewPrivileges, empty capabilities,
ProtectHome and immutable system files. Sudo/pam/sshd distribution policy still requires
VM review; creating a no-login account is not a general audit of the machine.

Shared free pools use an explicitly designated pool account. Unrelated free Apps
share its UID, heap, event loop, native libraries and writable-resource access after a
native compromise. They retain SEAM-level logical isolation, **not per-App Unix
isolation**. Paid customers receive distinct account IDs/UIDs. Multiple Apps for one
customer may share that customer's account. Higher-tier App pools receive independent
service/cgroup lifetimes; the current registry still associates their UID with the
customer account, so same-customer pools do not gain mutually hostile UID isolation.

## Fixed managed layout

```text
/opt/wydhosting/release/                         root-owned reviewed runtime
/etc/wydhosting/approval.json                    root-only administrative approval
/etc/wydhosting/provider-approval.json           root-owned provider-readable projection
/var/lib/wydhosting/provider/                    provider UID, 0700 registry/journal
/var/lib/wydhosting/broker/                      root, 0700 ownership/lease records
/var/lib/wydhosting/accounts/<account>/          pool UID, 0700 no-login home
/var/lib/wydhosting/uploads/<account>/<deploy>/  approved source, not executed
/var/lib/wydhosting/pools/<pool>/generations/N/  root-owned sealed execution inputs
/run/wydhosting/                               root-owned protected infrastructure
/run/wydhosting/provider/                      provider-owned edge endpoint directory
/run/wydhosting/workers/<worker-generation>/    restricted unit runtime directory
```

Pool and generations parents are root-owned with only the assigned group allowed
traversal. Execution directories are root-owned/group-readable 0550; execution files
0440. App `data`, `files`, `media` children are independently worker-owned 0700.
No recursive chown through publisher paths occurs. Writable service roots outside
those children are unavailable in the unit. The whole App root is deliberately not
called immutable: only execution inputs are sealed. Its service data remains mutable.

## Path boundaries

Python opens absolute ancestry one component at a time with DIRECTORY/NOFOLLOW/CLOEXEC,
validates protected owner/mode, then operates relative to held descriptors. Upload
ancestry may belong only to root or the approved pool UID, with no group/world writes.
Approved source prefix alone is never the security check. Source traversal stays on
its opened root device; special files, links, unexpected entries and changed bytes fail.
Mount crossing and source-root qualification require real VM attacks as well.

Writable source directories may be replaced by a customer, but a held root/file
cannot be redirected by changing its old pathname. Staged files are copied, never
hardlinked. Provider/worker cannot change root-owned runtime/approval/unit files.
Only a verified socket inode held with Linux O_PATH may receive provider-group ingress
permissions; a source-selected path never reaches chown/chmod. See [staging](deployment-staging.md).

## Retirement and recovery

No automated user deletion, UID recycling, data erase, recursive quarantine cleanup or
generated-unit removal is implemented. Stopping a pool retains data and root ownership
markers. Failed staging remains private quarantine. Operator must prove service/cgroup
absence and review account-specific ownership before any manual removal. Never delete
another customer's data or reuse a UID while its old protected files remain. Automatic
retirement is a remaining I5.6 implementation item; data migration remains I5.7.

Source descent additionally uses Linux amd64 `openat2` with RESOLVE_BENEATH,
RESOLVE_NO_SYMLINKS and RESOLVE_NO_XDEV. It refuses unavailable primitives rather
than falling back to path checks. This rejects same-device bind mounts as well as
ordinary device changes. The upload root itself must have protected root-owned
ancestry. Local tests exercise real openat2 symlink and existing proc-mount refusal;
privileged concurrent mount substitution remains unexecuted.
