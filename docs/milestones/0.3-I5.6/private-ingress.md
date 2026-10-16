# Private ingress and control transport

**Latest:** the real canonical provider, two categorized workers and Caddy 2.11.7
now serve actual TLS responses over VM loopback IPv4/IPv6. The shipped Caddyfile
explicitly rejects unknown authorities with 421. Header spoofing, separate edge UID,
private routing, retirement/restart and worker TCP-listener absence have real VM
evidence. This supersedes the earlier full-chain-unexecuted status below, without
qualifying external networking, production certificates or the proxy's MAC domain.
See [verification](verification.md#integrated-enterprise-campaign--2026-10-16).

**Real same-UID and AlmaLinux cross-UID/systemd worker Unix HTTP checks passed;
the full provider/Caddy/TLS proxy chain remains unqualified.** See
[verification](verification.md). Development fork workers retain their explicitly nonproduction TCP
profile. Managed Linux workers require private-Unix bootstrap and cannot substitute
a loopback listener. A local port alone is not authentication.

## Ingress path

```text
HTTPS client -> separate trusted Caddy UID -> provider edge Unix socket
             -> provider-selected ready pool -> worker Unix socket -> I1 routing
```

The provider edge handler obtains actual SO_PEERCRED and requires its configured
separate edge UID. It accepts only one exact Host and canonical forwarded HTTPS
host/proto, rejects Forwarded/forwarded-for/forwarded-port, looks up the approved active
domain/App/placement in the sole registry and requires a fresh ready generation. It
never accepts a request-selected pool/endpoint, chooses a sibling fallback or trusts a
caller-supplied UID. It strips hop-by-hop fields and forwards only the canonical host/
HTTPS provenance to that worker. Worker I1 routing/origin/CSRF/cookies remain authoritative.

Before sending HTTP, provider connects to the derived generation's Unix endpoint and
checks the listener's **actual UID and PID** against the broker-authenticated unit main
process. It rechecks current ready generation after connection. A replaced endpoint
with a foreign listener fails, regardless of filename. This depends on the root lease
and authenticated launch; arbitrary PID files are not adopted across restarts.

Worker's native shared HTTP adapter authenticates each connection against the configured
provider UID, stores the verified result in a private WeakMap and requires it in I1
route resolution. Headers cannot set that WeakMap. It closes unauthorized sockets
before App handling. Only `private-unix` routing can use that trust; IP trusted-proxy
behavior is unchanged. Unknown/foreign host yields no route, wrong scheme/forwarding
headers reject, and mutations retain exact HTTPS Origin plus ordinary session-bound
CSRF. No WydClient or portable object receives native socket handles/credentials.

## Filesystem and native helper

Worker RuntimeDirectory initially belongs only to its restricted UID. On first valid
ready response, broker opens the runtime directory without following links and holds
the HTTP socket inode with O_PATH. It verifies actual server PID/UID, changes permissions
through its held `/proc/self/fd/<n>` inode reference, and grants only provider-group
traversal/socket access. A customer-controlled path substitution cannot redirect root
chown/chmod to a regular file. The provider still verifies the actual listener after
connect, and the worker still verifies provider credentials. No world-readable code or
world-writable provider/broker directory is required.

`native/peercred.c` exports only SO_PEERCRED for an already open descriptor. It cannot
open paths, execute commands or alter privilege. Build explicitly as an unprivileged
operator, record source/binary integrity, then install at the fixed root-owned release
path. No postinstall native build exists. `unix-peer.js` uses Node 24 socket `_handle.fd`;
this nonpublic Node detail fails closed if unavailable and must be requalified on Node
changes. Actual current-UID tests compiled it with cc and exercised real kernel peers.

## Worker control /2

Broker starts a reviewed service and authenticates kernel UID/GID/PID, MainPID,
InvocationID, exact cgroup and one-use 256-bit challenge before relaying any worker
bootstrap. Restricted launcher verifies its broker peer is root and execs Node with
inherited FD 3, preserving PID. No nonce in environment/job file and no unauthenticated
localhost control port. No reconnect to an old lifetime.

Frames are compact canonical newline-delimited UTF-8 JSON. The Node stream decoder
bounds bytes **before** JSON decoding, validates the existing value/depth budget, and
requires exact reserialization; duplicates and noncanonical ambiguity reject. Bounds:
**256 KiB/frame, 32 outstanding requests, 1 MiB outbound queues, depth 16**, existing
control/startup/shutdown deadlines, monotonic sequences, closed envelopes and generation
fencing. Root relay also caps queued bytes and validates worker raw frames. Provider
and worker still enforce the canonical operation/message schemas. No generic execute,
filesystem, service or package method crosses this transport.

Version 2 adds the closed listener `{mode:'private-unix',path,uid}` and permits health
port zero for that socket. Same-UID fork mode still uses Node's native IPC framing;
its earlier native-decoding limitations are not upgraded into an OS guarantee. Exact
engine/provider alpha.15 pin avoids mixed protocol versions. Historical /1 documents
remain accurate for alpha.14. A lost broker connection is ownership unknown unless
there is an explicit matching-generation cgroup-stopped acknowledgement.

## TLS/proxy candidate and remaining gaps

The continuation runs the actual Caddy edge in `wydhosting_edge_t:s0`, with typed
executable/TLS/config/state and provider-only Unix connection rights. Actual domain
inspection, restart, A/B routing and an AVC-backed denial of DAC-readable tenant
data pass. See [SELinux](selinux.md) for the wider `http_port_t`/`node_t` listener
permissions and remaining edge TCB. These tests remain loopback IPv4/IPv6; the
existing active/default guest firewall cannot be changed for external ingress without
separate approval. No localhost result is independent external packet evidence.

The shipped Caddyfile uses explicit host/certificate/key placeholders, HTTP/1.1 backend,
stripped untrusted forwarding headers and overwritten exact HTTPS host/proto.
The complete candidate also disables the admin API, persisted config and automatic
redirect listeners and selects HTTP/1.1; the fixture adds loopback binds to both the
named site and reject site. Certificate
selection/expiry/key permissions and Caddy executable/config validation are manual VM
qualification steps. No DNS/ACME automation, live certificate management or qualified
Caddy adapter is claimed. The provider service must grant only the approved edge group
access to its edge directory/socket. Separate-UID credential/routing and unauthorized
local-socket denials now have integrated loopback VM evidence. Service listener
substitution, external reachability and all-route browser behavior through the exact
proxy chain remain untested. The existing browser suite verifies the
preserved I1 transport semantics, not a Caddy production deployment.

Lifetime verification additionally pins the kernel process start-time, and provider
checks actual `/proc/<peer>/cgroup` and start-time on each newly connected worker
endpoint before sending HTTP. A matching numeric PID/UID alone is insufficient.
Unavailable process metadata fails closed; the exact procfs policy needs VM testing.
Provider diagnostics distinguish credential/header refusal, permission/socket errors,
readiness/generation loss, deadlines and worker HTTP failures without raw requests,
cookies, paths or exception strings.

The root relay validates the complete closed worker envelope, bound identity and
monotonic sequence before forwarding any whole worker frame. Partial/invalid frames
are never forwarded. Only the broker can emit the separate
`wydhosting.broker-result/1` cleanup acknowledgement after owned-cgroup emptiness;
a compromised worker cannot forge retirement on the shared stream. A real local
socket-pair test verifies that refusal, while actual systemd cleanup is unexecuted.
Broker service events retain sanitized OOM/exit results and the supervisor records
`WORKER.OOM` when a broker-confirmed service outcome reports OOM.
