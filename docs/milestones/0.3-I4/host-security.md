# Host security and Linux qualification

I4 certifies no Linux distribution for WydHosting: the package/installer does not yet
exist. Wydgine remains cross-platform where Node/native dependencies run. Current
root engine declares Node >=22.12; the complete Files profile requires >=24.21.
Native Argon2 and SQLite binaries/toolchains are part of target qualification.

## Distribution policy

| Status | Meaning / initial assignment |
| --- | --- |
| Officially tested | Exact distro release, architecture, Node, systemd/cgroup, proxy/firewall and filesystem matrix passed; **none for WydHosting in I4** |
| Experimental | I5 candidates: Ubuntu Server 24.04 LTS amd64 and Debian 13 amd64; exact image digests/kernel/package revisions recorded at qualification; no production certification |
| Community-maintained | Windows/macOS/other Linux ports only when named maintainers provide adapter and evidence; none implied here |
| Unsupported | Missing mandatory privilege/isolation/recovery contract; reject provider setup rather than emulate safety |

Choose one initial production qualification lane (Ubuntu candidate), then Debian;
AlmaLinux/RHEL-family follows only with SELinux/firewalld/RPM and native-module tests.
Almond Linux Server is a future reference installation, not a tested exception.
The named releases are test targets, not claims about latest distro versions.

## Narrow privilege model

Setup preflight checks Linux, exact supported profile, systemd, unified cgroups v2,
Node/native modules, storage/space/quota support, network/proxy and authorized elevation.
No authorized root/sudo path means refuse managed setup and recommend independent
standalone Wydgine under the existing provider/process manager. Do not leave a partially
public hosting service. npm dependency installation itself must not run arbitrary
publisher lifecycle scripts as root; acquire/build vetted pinned artifacts as an
unprivileged staging identity, then broker installs verified immutable release files.

Persistent supervisor uses a dedicated restricted service UID. Pool workers run as
restricted pool/customer UIDs, never root. Systemd owns lifecycle/cgroup assignment;
nonroot supervisor requests allowlisted operations via a root-owned broker socket.
Broker authenticates actual Unix peer credentials and separately authorized operator
operation, validates a short-lived plan digest/revision and journals result. Caller
cannot supply shell commands, unit fragments, arbitrary paths, UIDs, environment or
executables. It derives those from approved registry records and fixed templates.

Broker operations: ensure managed identity/home, create/seal approved deployment,
create/update/start/stop a managed unit with fixed engine executable, apply approved
cgroup policy, apply reviewed proxy/firewall plan, and remove only a verified managed
resource. Every operation checks ownership and namespace, idempotency key and current
state. No generic sudo shell, write-file, chown-tree or arbitrary systemctl interface.
Root helper code/updates and socket ownership are root-controlled; audit inputs and
outcomes without secrets. Refuse actions on existing unmanaged users/units/resources.

Systemd templates must qualify NoNewPrivileges, restricted filesystem access,
private temporary dirs, capability drop, restrictive umask, process/task/file limits,
control channel access, and service-specific network/address-family restrictions.
Enable compatible AppArmor/SELinux policy only with tested profiles; never disable
host MAC to make setup pass. Root-broker bugs remain a security boundary requiring review.

## Firewall transaction

1. Detect active UFW/firewalld/nftables and panel-managed policy using read-only
   inspection; identify ownership/conflicts, actual SSH port/source and out-of-band
   recovery. Never run two competing policy managers or flush existing rules.
2. Produce a plan showing current effective policy, changes, preserved SSH ingress,
   public 80/443 edge, private worker endpoints, management restriction and unverified
   cloud rules. Existing authorized SSH access must remain, not just port 22.
3. Require explicit operator approval of plan digest. Before applying, save a verified
   backup and schedule rollback via an independent privileged systemd timer/service
   that survives CLI disconnect/crash. Refuse automated mutation if this cannot be
   established; provide a manual operator plan with setup blocked pending verification.
4. Apply only managed rules under the detected adapter, retain existing sessions,
   test a fresh authorized SSH connection and proxy reachability, and test denial of
   worker/management ports from an independent external vantage where available.
   Loopback success cannot prove internet policy. Check IPv4 and IPv6, not only one.
5. Inspect effective rules/counters/listeners, record cloud/control-panel limitations.
   Inability to verify yields `verification-required`, never green production-ready.
   Cancel rollback only after independent checks and explicit operator confirmation.
6. On interruption, rollback timer restores prior managed policy; journal reconciliation
   detects applied/rolled-back/ambiguous state. Preserve recovery instructions and audit.
   Reboot/power loss requires boot-time reconciliation or policy rollback before serving.

Initial implementation should support one adapter (UFW on the Ubuntu lane), explicitly
refusing automated changes on unsupported managers; Debian nftables is a separate gate.
Adapter interface: `detect`, `inspect`, `plan`, `armRollback`, `apply`, `verify`,
`confirm`, `rollback`, `reconcile`. All take typed plans, no shell text from an App.
Cloud firewalls and panel rules remain externally managed; do not pretend to configure
them without a separately authorized integration. Firewall defense supplements
binding, OS identities, endpoint authentication, patching and least privilege.

## Proxy and worker reachability

Public ingress terminates TLS at a separately managed trusted edge. Workers use
Unix HTTP sockets where qualified; current I1 exact IP peer checks require additional
Unix transport authentication support first. Transitional loopback TCP is permitted
only with tested kernel restrictions preventing untrusted local UIDs from impersonating
the proxy. IP allowlisting alone cannot distinguish local customers. If neither secure
transport exists, managed multi-customer public setup must fail closed.

Preserve I1's HTTP/1.1 backend, stripped Forwarded/X-Forwarded-For/Port and overwritten
single HTTPS host/proto headers, exact origin/CSRF and host-only cookies. Current Caddy
reference is documentation-only; I5 must validate chosen proxy executable and real
private-peer policy. Initial certificates are operator supplied; DNS/ACME automation
is deferred. Reject missing/expired/unapproved certificate configuration. Admin UI is
private/off by default; remote management needs separate TLS/authentication policy.

## Portability contracts and tests

OS adapters expose capability discovery and typed account, service, endpoint,
resource, firewall and recovery operations. Unsupported required isolation fails before
activation. A community port must implement equivalent access denial, authenticated
control, force termination and durable recovery or explicitly reject that provider mode.
Do not import adapters into Wydgine's portable standalone closure.

Qualification uses disposable VMs with rollback console: root/elevation refusal,
nonroot workers/supervisor, uid/cgroup inspection, cross-customer reads/signals denied,
CPU throttling/memory pressure/OOM, disk-full/quota/I/O behavior, SSH preservation,
rollback after disconnect/SIGKILL/reboot, IPv4/IPv6 worker denial, cloud unknown status,
panel conflict refusal, proxy header spoofing, unit/template injection and helper
replay. Record image hashes and versions; passing local Node tests is insufficient.
