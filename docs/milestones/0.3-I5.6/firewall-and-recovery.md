# Firewall, SSH and recovery status

**Experimental account/retirement candidate:** see the 2026-10-17 privileged
resume evidence in [verification](verification.md); production qualification remains open.

The integrated campaign preserves the existing firewalld and SSH/default-zone policy.
Its Caddy TLS tests bind only VM loopback and provide **no external packet evidence**.
No production apply adapter was enabled. Installed-service crash/OOM/restart and
stale-lock evidence are recorded in the [latest verification](verification.md#integrated-enterprise-campaign--2026-10-16);
reboot remains deferred until backup and independent console recovery are verified.

**Public hosting firewall application remains unimplemented and unqualified.**
A bounded administrator-only unused-zone firewalld transaction/rollback probe now
exists and passed on AlmaLinux, including caller-death recovery. It never activates
a zone or public policy. `planFirewall` is pure validation and preview for UFW and
firewalld. `applyFirewall` always refuses
`HOSTING.FIREWALL_UNQUALIFIED`; broker exposes no firewall operation. No firewall,
SSH, route, network interface, DNS, TLS certificate or sudo setting changed on the
development host. This is a deliberately unmet acceptance item, not a passing mock.

## Implemented preview

The current closed preview input requires UFW or firewalld as its manager, a nonempty bounded list of explicit
administrator IP addresses and actual ports, allowed public 80/443 and independently
verified VM-console recovery. It does not assume SSH port 22, infer all administration
paths from the current connection, flush unrelated rules or certify current rules.

AlmaLinux/RHEL candidates declare **firewalld** in their shared platform matrix.
Firewalld preview is now accepted, but all public live apply operations still refuse. Preserve the
guest's active firewalld, zones, SELinux policy and administrative access while a
separate managed transaction/rollback implementation is developed and qualified.
Output identifies Unix-only worker listeners and the mandatory missing verification
steps. A boolean input saying a console is verified is **not actual console evidence**.
It is a plan prerequisite, not authentication or permission to mutate the machine.

No rule text/command from an App is accepted. Nftables/control-panel managers
are unsupported by this preview. Detecting conflicting effective host/cloud/panel rules,
real UFW syntax validation and transactional apply still require implementation and VM
qualification. The preview does not claim those checks have occurred.

## Executed limited firewalld transaction

The packaged `broker/firewalld_probe.py --unused-zone block` is an administrator-only
qualification utility for a disposable VM. It refuses rootless use, default/bound zones
and a preexisting exact test rule. It writes an exclusive root-only intent, verifies
an independent systemd rollback timer **before** mutation, and adds only a fixed
127.0.0.2 TCP/65431 reject rule with a second native 60-second expiry. The independent
timer removes that exact rule after 15 seconds. No permanent write, reload, source/
interface assignment, zone activation or commit operation exists. Run it only through
an explicitly authorized VM session; it is not a broker or portable capability.

AlmaLinux 10.2 passed a normal rollback and **3/3** caller-death checks. Runtime and
permanent full zone listings matched their prior values; the applying process was
SIGKILLed while the separate timer completed. An unbound zone does not populate active
nft chains. These results establish manager transactions and independent recovery,
**not packet isolation, public rule application, SSH recovery or production readiness**.
Six mocked precondition tests are explicitly separate from these real VM observations.
See [verification](verification.md) for exact commands, failures, mutations and limits.

## Required future VM transaction

The continued read-only network inspection found NAT `default` / `virbr0`, Mint bridge
192.168.122.1 and guest 192.168.122.225; no IPv6 subnet is configured. The guest
public zone is both active/default on enp1s0, with SSH/cockpit/dhcpv6-client services,
no HTTPS port and no rich rules. **No active-zone rule was added.** The exact proposed
additional IPv4 test rule, requiring separate explicit authorization, is:

```text
rule family="ipv4" source address="192.168.122.1/32" destination address="192.168.122.225/32" port port="443" protocol="tcp" accept
```

Proposal only: bind the disposable edge solely to that guest private IPv4 address;
apply this exact runtime rule in public with native 60-second expiry after verifying
an independent 15-second root rollback timer; test TLS and bypass from the existing
ordinary host bridge address; remove only the exact rule and compare complete prior
runtime/permanent listings plus a fresh SSH connection. No permanent write, zone
reset/reload, SSH rule, host privileged networking or public-internet exposure is
proposed. Risk is temporary additional reachability from that one bridge address.
Independent recovery prerequisites and the exact apply plan still need review before
execution. Existing limited unused-zone rollback is not proof this active packet path
works. IPv6 external qualification needs a separately authorized suitable network;
link-local guest IPv6 and ::1 tests do not establish it.

Reboot prerequisites are also unmet: live disk/XML/UEFI NVRAM references and the
SPICE/serial endpoints are known, but backup location/readability/integrity and an
actual independent console login/recovery route remain unverified. SSH/sudo and
enabled services do not close that gap. No guest reboot or backup mutation occurred.

1. Establish an independent hypervisor console and snapshot, verify every approved
   administrator address/port and both address families. Detect other policy managers,
   panels and cloud rules by read-only inspection; refuse ambiguous ownership.
2. Produce exact reviewed managed-rule changes and backups, preserving unrelated rules,
   established sessions and all approved administration paths. Independent operator
   authorization must bind the exact plan and current effective-policy revision.
3. Before apply, schedule and verify an independent root rollback service/timer that
   survives CLI/provider/broker death. Persist transaction intent. If that cannot be
   established, refuse apply. Never rely on a JavaScript timer or the current SSH shell.
4. Apply only the owned rule fragment with actual parser validation; retain a verified
   backup and rollback route. Perform a fresh authorized administrator connection,
   expected proxy access and direct worker/management denial from an independent
   IPv4/IPv6 vantage. No local-only test substitutes for external observations.
5. Confirm only after independent checks and operator acknowledgement; then disarm
   rollback and durably record outcome. Failed validation, disconnect, process death,
   unconfirmed state and startup/reboot interruption must preserve or restore recovery.
6. Reboot/power-cycle the disposable VM, inspect effective counters/rules and preserved
   nonmanaged rules, and test recovery again. Keep cloud-firewall status separately
   unknown unless independently verified.

No rootless container or mocked command runner proves these properties. Until this
adapter and evidence exist, managed public-hosting setup cannot become ready.

## Current service and filesystem recovery

Provider desired state and original restart budget remain in the existing supervisor
ledger. Broker records ownership and intent in protected root state. Per-pool locks
prevent concurrent publish/launch/reconcile; a dead provider does not authorize another
process merely by releasing a PID. Explicit service reconciliation checks root-owned
unit bytes, invocation/cgroup or proven inactive/empty state. A mismatched/ambiguous
record refuses. Stale supervisor locks and pre-invocation interrupted broker records
require console inspection, not PID guessing.

Stopped account/data/snapshot resources are retained. Exact stopped generation job/socket retirement is automatic after verified ownership
and cgroup death; units/accounts/data remain retained. There is no automatic account
retirement, UID recycling, destructive cleanup, rollback to an older writer or data
migration. Code rollback uses normal revert commits; deployment/data rollback requires
known ownership and compatible state. Restore the disposable VM snapshot if ambiguity
cannot be safely resolved. I5.7 must supply stopped data transfer and cutover recovery;
I5.8 must rerun the integrated Linux/release matrix.

## Current approval-gated proposals — broker domain campaign

No external firewall, quota or reboot action below was performed.

For the proposed external **private bridge** TLS test, the guest interface is
`enp1s0`, active zone `public`, source only Mint bridge `192.168.122.1/32`, destination
only guest `192.168.122.225/32`, TCP/443. After independent recovery and a verified
15-second rollback timer, the proposed additional **runtime-only, 60-second** rule is:

```sh
sudo firewall-cmd --zone=public --add-rich-rule='rule family="ipv4" source address="192.168.122.1/32" destination address="192.168.122.225/32" port port="443" protocol="tcp" accept' --timeout=60s
# Exact immediate rollback, also used by the independent timer:
sudo firewall-cmd --zone=public --remove-rich-rule='rule family="ipv4" source address="192.168.122.1/32" destination address="192.168.122.225/32" port port="443" protocol="tcp" accept'
```

This permits that bridge source to a test Caddy listener bound only to the guest's
private IPv4 address. It does not establish public-internet or external IPv6 evidence.
SSH/22, existing services/rules, interface assignment and permanent policy must remain
unchanged; compare complete before/after runtime/permanent zone listings and a fresh
SSH connection. Approval must cover this exact rule, listener scope and timed rollback;
it is not authorization for a zone reload, permanent rule or host firewall change.

The smallest proposed quota experiment is a **separate disposable guest-only image**
with a fixed 512 MiB file ceiling, a new empty owned mountpoint, a dedicated loop device
and an explicitly quota-enabled filesystem. Use two new test projects with small
(e.g. 8 MiB) limits, hard process/time/write ceilings and sibling/read/recovery checks.
Record exact image/loop/mount identities before use; unmount and detach only those
owned resources, then remove only the new image/mountpoint. No existing mount option,
fstab, partition, disk, hosting data or Mint filesystem is changed. Creating/formatting/
mounting/enabling quotas is **not authorized** yet; this proposal requires separate
approval after rechecking guest free space and support. Existing XFS noquota results
remain unchanged.

The Mint-host backup path is now confirmed readable:
`/mnt/data/VM-Backups/almond-lab/baseline-0.1/`. XML UUID matches the running guest;
disk, XML and UEFI NVRAM exist and fresh hashes are retained in the campaign evidence.
Read-only `qemu-img check` reports zero errors. An earlier trusted digest or stopped
checkpoint manifest is absent, so capture consistency/authentication is not proved.
Read-only hypervisor screenshot capture confirms display access but no input/login
was performed. Independent console login/recovery is still unverified; display
access and known SPICE/serial endpoints are insufficient. Reboot remains deferred pending that precise
missing evidence; neither Mint nor the guest was rebooted.
