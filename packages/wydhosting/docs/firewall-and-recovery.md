# Firewall, SSH and recovery status

**Live firewall adapter/transaction/rollback is NOT implemented or executed.**
`planFirewall` is pure validation and preview. `applyFirewall` always refuses
`HOSTING.FIREWALL_UNQUALIFIED`; broker exposes no firewall operation. No firewall,
SSH, route, network interface, DNS, TLS certificate or sudo setting changed on the
development host. This is a deliberately unmet acceptance item, not a passing mock.

## Implemented preview

Closed input requires UFW as the candidate manager, a nonempty bounded list of explicit
administrator IP addresses and actual ports, allowed public 80/443 and independently
verified VM-console recovery. It does not assume SSH port 22, infer all administration
paths from the current connection, flush unrelated rules or certify current rules.
Output identifies Unix-only worker listeners and the mandatory missing verification
steps. A boolean input saying a console is verified is **not actual console evidence**.
It is a plan prerequisite, not authentication or permission to mutate the machine.

No rule text/command from an App is accepted. Firewalld/nftables/control-panel managers
are unsupported by this preview. Detecting conflicting effective host/cloud/panel rules,
real UFW syntax validation and transactional apply still require implementation and VM
qualification. The preview does not claim those checks have occurred.

## Required future VM transaction

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

Stopped account/data/snapshot resources are retained. There is no automatic account
retirement, UID recycling, destructive cleanup, rollback to an older writer or data
migration. Code rollback uses normal revert commits; deployment/data rollback requires
known ownership and compatible state. Restore the disposable VM snapshot if ambiguity
cannot be safely resolved. I5.7 must supply stopped data transfer and cutover recovery;
I5.8 must rerun the integrated Linux/release matrix.
