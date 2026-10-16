# I5.6 — Linux isolation and provisioning candidate

Platform, Wydgine and WydHosting **0.3.0-alpha.15**. Worker protocol
**wydgine.worker/2**. Status: **experimental implementation; NOT Linux security
qualified; NOT implementation complete**. Live firewall transactions, automatic
resource retirement and production VM integration remain incomplete. Real kernel
fixtures and an unused-zone firewalld rollback probe passed on AlmaLinux 10.2;
the production broker fails startup because RestrictSUIDSGID blocks openat2.
There is no production
activation certification or supported production Linux distribution.

Wydgine runs Apps. WydHosting manages infrastructure. Linux enforces OS boundaries.
SEAM enforces application authority. Wydgine does not import WydHosting. One approved
registry, one engine implementation, one SEAM graph per worker and the sixteen-App
ceiling remain. No broker/control API is registered with SEAM, HTTP, WBasic or CLIENT.

## Delivered executable boundaries

- Read-only `wydhosting setup` preflight and `setup --input <file>` candidate approval.
- Shared explicit Ubuntu/Debian/AlmaLinux 10/RHEL 10 candidate matrix; EL lanes require
  SELinux enforcing. AlmaLinux 10.2 has real kernel fixture evidence, separately
  labelled from the still-blocked production broker/worker lane.
  No elevation, install hook, account, service or network mutation on inspection.
- Separately installed Python socket-activated privileged broker. Closed, versioned
  operations, kernel Unix peer credentials, explicit root-reviewed pool/byte approval,
  durable generation intent, typed systemd operations and sanitized administrative events.
- Restricted account creation/verification, rejection of existing unmanaged identities,
  descriptor-relative source copying, byte verification and new sealed deployment generations.
- Systemd unit renderer with numeric restricted UID/GID, cgroup limits, fixed installed
  executable, controlled environment/writes and independent lifetime binding to its
  broker session. Existing supervisor controls restart budgets and readiness.
- Cross-UID control candidate: systemd MainPID + invocation + cgroup + actual Unix
  peer UID/GID/PID + one-use challenge; inherited FD 3 after an authenticated launcher.
- Actual Linux N-API `SO_PEERCRED` helper, trusted credential-checked Unix HTTP profile,
  provider routing adapter and Caddy configuration candidate. No Linux worker TCP socket.
- Firewall preview with explicit administrator ports/addresses and independent recovery;
  UFW/firewalld preview is supported; public application refuses
  `HOSTING.FIREWALL_UNQUALIFIED`. A separate administrator-only unused-zone
  firewalld probe exercises independent rollback without public network changes.
- Targeted dependency fixes: file-type 21.3.4 and development-only happy-dom 20.8.9.

These are implemented code paths, not a claim that their combined privileged behavior
has executed successfully. Read the [verification report](verification.md) for counts,
intermediate failures and the exact missing evidence.

The gate table below describes the original delivery. The fresh-baseline campaign
adds 26 actual kernel checks and real firewalld manager recovery, while finding a
production broker startup blocker. It does not close gates B–F.

## Gates

| Gate | Passing evidence | Acceptance still failing/unqualified |
| --- | --- | --- |
| A: design/environment | Exact clean baseline/remote; contracts/source review; actual environment inventory; unprivileged baseline | No authorized disposable VM or real systemd test namespace |
| B: broker/accounts/staging | Real unprivileged descriptor copies/link attacks/socket credentials; closed request tests; immutable byte descriptors | Actual account creation, root-to-worker ownership, cross-UID denial, privileged races and installed broker authorization |
| C: services/cgroups | Fixed template contracts; old real crash-loop, frozen-worker and restart regressions | Actual units, cgroup limits/OOM/process exhaustion/sibling survival and orphan cleanup |
| D: control/ingress | Real same-UID Unix credential helper/HTTP/header/routing/retirement tests; fake broker refused; wire bounds | Actual service launch handshake, restricted UID peers and Caddy-to-provider-to-worker TLS chain |
| E: install/firewall/recovery | Read-only setup, closed firewall preview and fail-closed apply | Live transactional firewall adapter/rollback timer; reboot/recovery; automatic account/unit/snapshot retirement |
| F: integration | Repository/client/browser/independent package regressions as recorded | Full privileged adversarial matrix, independent external IPv4/IPv6 and power-loss evidence |

No missing gate is converted into a passing mock. Rootless containers were not used
as evidence for systemd, cross-UID, firewall or host-kernel enforcement.

## Navigation

[Linux support](linux-support-matrix.md) · [Broker](broker-security.md) ·
[Accounts/filesystem](accounts-and-filesystem.md) · [Staging](deployment-staging.md) ·
[Services/resources and VM walkthrough](service-and-cgroups.md) ·
[Private ingress](private-ingress.md) · [Firewall/recovery](firewall-and-recovery.md) ·
[Verification](verification.md).

## Refinements to I4/I5.5

The I4 documents remain historical design proposals. The current executable lane uses
Python's standard library for Linux descriptor-relative operations, Unix credentials,
fixed account tools and systemd; it is neither privileged publisher JavaScript nor
an arbitrary native command proxy. A small explicitly built C N-API helper supplies
peer credentials missing from Node's public Unix socket API.

Control uses bounded canonical newline JSON and the existing worker envelopes, rather
than a second binary protocol. Version 2 rejects ambiguous duplicate/noncanonical raw
encodings and adds a closed private-Unix listener. Version 1 peers are refused; exact
WydHosting/Wydgine pins coordinate upgrades. Existing same-UID fork supervision remains
available, with no stronger OS claim.

The root-owned approval is an administrator-installed execution projection of the
canonical registry and content approval, **not another mutable provider registry or
publisher-signature system**. The supervisor compares the entire canonical registry
digest to that projection. Any registry change in this experimental lane requires a
new reviewed root approval; this conservatively differs from I5.5's per-pool drift
optimization. Nonroot registry inspection validates intent/journals without pretending
it can read another UID's private files. Worker and broker verify execution inputs.

OS policy is separate from I2 request quotas. The initial service lane deliberately
allows AF_UNIX only: approved remote S3/TCP dependencies cannot run in it. Do not expand
network access silently. Storage quotas and MAC profiles are not implemented. New
snapshot roots cannot be activated over a previous lease without I5.7 data ownership
work; staging preserves old generations and replacement workers reuse the same base.

The I4 UFW transaction proposal remains unimplemented and disabled. The Caddy asset is
a candidate, not a qualified reverse-proxy deployment. I5.7 still owns stopped data
migration/cutover; I5.8 owns combined release qualification. Neither is delivered here.

Managed workers explicitly resolve approved native libraries from the immutable
runtime installation root, while service initialization retains the App data root.
Upload/working-directory node_modules cannot override that root, and missing approved
implementations do not fall back to an upload. This is a trusted embedding option,
not portable configuration or a new publisher dependency mechanism.
