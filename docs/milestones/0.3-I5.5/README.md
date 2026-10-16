# I5.5 — Trusted worker protocol and disposable process supervision

Wydgine executes Apps. WydHosting supervises Wydgine processes.
Platform, Wydgine and WydHosting advance to **0.3.0-alpha.14** for the new executable
worker and supervisor interfaces. WydClient alpha.8, WydSUB 0.1 and canonical library
versions remain unchanged. Search/Stream peers explicitly accept alpha.13 or alpha.14;
WydHosting requires exactly alpha.14. All packages remain private and unpublished.

This is **development-qualified process supervision**. Every worker is a real Node
process with its own heap/event loop, immutable canonical inventory, original I3
operational host and original I0–I2 execution/authority/routing/governance machinery.
Shared-pool Apps retain logical SEAM/service isolation and share a crash boundary.
Dedicated pools have independent process lifetimes. Intended Linux identities remain
registry records; the development user's UID actually runs every worker.

The trusted `wydhosting` export adds `createSupervisor`. Wydgine adds
`wydgine/trusted/protocol`, `wydgine/trusted/worker-entry` and the `wydgine-worker`
executable. Existing exports and compatibility imports retain one authority graph.
The worker executable refuses operation without inherited Node IPC; it has no
publisher-selected CLI/configuration, HTTP management endpoint or portable capability.
The existing provider fingerprint/path helper moves to Wydgine's trusted provider
surface so approval and worker verification use exactly the same implementation.
No second inventory validator, App registry or execution engine is introduced.

## Disposable example

From the development checkout with its existing dependencies installed:

```sh
node examples/process-supervision/run.js
```

This provisions canonical Apps and real installed WBasic Taskboards, approves the
I5.3 registry using its existing plan/apply flow, starts a shared two-customer pool
and a separate paid-customer pool, checks real HTTP with explicit approved Host
headers, prints sanitized observations including distinct PIDs, then stops every
owned worker and removes the disposable fixture. No provider OS changes occur.
The same fixtures run against genuinely installed local tarballs in
`node scripts/verify-packed-packages.js`; that verification installs canonical native
services and commodity dependencies and may require network/cache access.

For a separately installed provider, supply an existing approved I5.3 registry:

```js
import fs from 'node:fs/promises';
import {createRegistry, createSupervisor} from 'wydhosting';
const registry = createRegistry({directory: '/tmp/provider/state',
  fixtureRoot: '/tmp/provider/disposable'});
// Provision/approve the registry explicitly before this point.
await fs.mkdir(registry.supervisorStateDirectory, {mode: 0o700});
const supervisor = await createSupervisor({registry,
  directory: registry.supervisorStateDirectory, fixtureRoot: '/tmp/provider/disposable'});
try {
  await supervisor.startPool('approved-shared', {execution: {
    'approved-app': {verifiedPackages: {'divdev/wbasic-taskboard': 'divdev'}}
  }});
  await supervisor.startPool('approved-dedicated');
  console.log(await supervisor.readHealth('approved-shared'));
} finally {
  await supervisor.shutdown();
}
```

The directory must already be canonical, private (0700) and operator-owned.
Bootstrap execution settings come from trusted native operator code, never App
metadata. This initial serializable profile accepts only exact `verifiedPackages`
maps. Callbacks, contexts, Gate contexts and arbitrary native integrations remain
local I3 embedding features; they are not serialized or reconstructed from Apps.
Optional Apps must still have fully valid inventories and approved snapshots.

## Routing and security qualification

No supervisor ingress proxy is provided. Only fixture endpoints bound to
`127.0.0.1` are accepted, including explicit port zero for OS allocation. Workers
apply the existing exact I1 raw Host/routing/origin policy themselves. An unknown
host gets rejected; a failed optional App gets 503; no sibling/customer fallback
exists. Existing `trusted-proxy` rules are unchanged; loopback peer approval is
**not** authentication of a local process. Do not put this profile behind a public
production proxy or treat loopback ports as inaccessible to local users.

I5.6 must qualify actual restricted accounts, broker/systemd ownership, cgroups,
private ingress and authenticated cross-UID control, race-safe immutable staging,
filesystem/network access denial, force cleanup of blocked/orphan workers, quotas,
firewall rollback, TLS/proxy header behavior and the Linux attack matrix. A responsive
worker retires on parent IPC EOF. A blocked worker whose supervisor dies cannot be
forcibly cleaned up by this implementation; independent kernel/service ownership is
mandatory for production. Same-UID malicious actors, PID reuse across restart,
multi-host fencing, OS resource fairness and power-loss durability are not certified.

Read [protocol](worker-protocol.md), [lifecycle/recovery](supervisor-lifecycle.md)
and [verification](verification.md). I5.7 migration and I5.8 production/release
qualification remain separate work. Prior intermittent HTTP500 observations remain
open unless diagnosed with specific evidence.
