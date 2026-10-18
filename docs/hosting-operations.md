# Hosting operations (I3 local profile)

**Current 0.3 migration direction:** accepted
[Decision 0003](decisions/0003-defer-managed-hosting-qualification-to-0.4.md)
uses independent Node processes, OS users, secrets and storage behind a conventional
reverse proxy for the five-site goals. The shared-process local example below is
retained for development and is not that deployment plan or managed-hosting
qualification. Managed multi-tenant qualification and the Debian 13 VM trial are
deferred to 0.4; I5.6 remains incomplete/unqualified. The separate
[0.3 HTTP reliability issue](milestones/0.3-reliability.md) remains open.
No migration, deployment or OS operation is authorized here.

This non-production profile requires Node >=22.12, installed workspace dependencies
and a trusted operator shell. `npm ci` installs the workspace. On Linux, provision
native library prerequisites as described by the canonical provider packages. Keep
configuration and resource roots outside publisher-controlled content updates.

## Start, inspect, stop, restart

```sh
node examples/hosting-operations/run.js init /tmp/wyd-hosting-local
node examples/hosting-operations/run.js start /tmp/wyd-hosting-local
curl --resolve alpha.localhost:8080:127.0.0.1 http://alpha.localhost:8080/
curl --resolve beta.localhost:8080:127.0.0.1 http://beta.localhost:8080/
curl --resolve soon.localhost:8080:127.0.0.1 http://soon.localhost:8080/
```

Init requires a new directory. Start prints one sanitized operational snapshot,
including readiness, per-App health, warning codes and logical capacity. This is
not a polling daemon or HTTP diagnostic route. Trusted integrations call the same
`snapshot()` repeatedly as needed. Do not redirect detailed tenant metrics into
public logs. The shared listener has no operational URL; unknown hosts still reject.

Press Ctrl+C or send SIGTERM to the Node process; await process termination before
starting again with the **same start command**, not init. State is preserved. The
signal handler awaits bounded cleanup without premature process exit. Failure sets
a nonzero exit status. A supervisor must allow startup plus the separate configured
drain/Stop/library-close phase deadlines. After timeout, inspect providers before
retry; committed writes may already exist. No in-process App reactivation is supported.

An active saturated App remains healthy but rejects new work. Failed/stopped Apps
are never ready. Required App loss makes the host not ready; optional failure stays
visible and its exact route returns 503. Parking never hides tenant failures. Codes
and threshold definitions are in the [I3 contract](milestones/0.3-I3/README.md).

## Configuration and startup failure

`operations.json` contains trusted platform policy: schema `wydgit.operations/0.1`,
`inventory`, and `optional: []`. Inventory includes roots, exact approved domains,
I2 policies and startup/shutdown bounds. App directories contain their ordinary
`wydgit.config.json` service settings and `content/requirements.json`. Secrets must
come from trusted deployment provisioning, never portable Wydgit code or source
control. The example has no live secrets or signing keys. Destination trusted
package policy is supplied by Node configuration, not relocation metadata.

Complete invalid inventories fail before activation, even for optional Apps. Only
valid configured Apps may be listed optional; parking remains required. Required
initialization/listener failure disposes initialized Apps and rejects startup.
Check the private App config, package catalog/receipts, dependencies and resource
permissions; public error categories deliberately omit raw paths and stacks.
Recovery locks/markers and stale catalog fingerprints require trusted investigation,
not automatic deletion or fingerprint replacement. Never edit an active App's
config/catalog. Stop first and use supported installation tooling.

For programmatic embedding:

```js
import {createOperationalHost} from '../wydgine/operations.js';
const host = await createOperationalHost(policy, {root, execution});
const detach = host.signals();
await host.start(8080, '127.0.0.1');
console.log(host.snapshot());
await host.shutdown();
detach();
```

The import path is relative to a script in this repository's `examples` directory;
`policy`, canonical absolute `root` and trusted execution configuration are supplied
by that embedding. Native controller access remains host-only.

## Relocate a stopped local App

Run the disposable demonstration:

```sh
node examples/hosting-operations/relocate.js
```

For an existing local installation, trusted Node tooling uses:

```js
await source.controller.stop(source.controller.select('app-alpha'));
await source.controller.snapshotApp('app-alpha', '/approved/transfer/alpha');
const entry = await restoreLocalApp('/approved/transfer/alpha', {
  root: '/approved/host-b', directory: 'alpha', app: 'app-alpha', verifiedPackages
});
```

Import `restoreLocalApp` from `wydgine/relocation.js`. Parent directories must already
exist and be canonical; snapshot and destination child must not exist. Provision
compatible destination platform dependencies separately, then create a new host
inventory containing `entry`, independently approved domains and trusted package
policy. Validate/activate with the ordinary controller or operational wrapper. Do
not move live tokens, contexts, listeners, node_modules or source host routing.

The narrow supported profile copies canonical content, receipts/pinned resources,
JSON Store/history, Gate credentials/membership/persisted sessions, local Files,
Stream media/metadata and Search state. It intentionally retains Gate state; treat
the entire snapshot as confidential. Larger/custom layouts, SQLite and remote
providers reject: make a provider-specific consistent export/restore and ownership
handoff before using another workflow. No unsupported resource is silently claimed
as migrated. Source package authoring directories are excluded; installed resources
are pinned in the catalog. Keep your original authoring sources separately.

Snapshots use unkeyed SHA-256 integrity records, not signatures or grants. Approve
the source out of band. Do not accept a publisher's descriptor as authority. Transfer
only through private trusted channels. The tool rejects links, traversal and existing
targets, cleans newly created directories on caught failure, and never extracts an
archive. If killed mid-copy, inspect the leftover child manually and remove only
the verified disposable incomplete target before retry.

Stop every other process that might own source resources. The local source lifetime
is terminal, but another process could reopen the old copy; no distributed fencing
exists. Never run both copies against shared writable namespaces. Keep the source
stopped until destination validation succeeds; do not delete the only good backup.
No live migration or zero-downtime claim is made.

## Reverse proxy reference

[Reference Caddyfile](../examples/hosting-operations/Caddyfile) uses operator-supplied
certificates and disables certificate automation. Replace example domains and file
paths; no public CA was contacted. Caddy is unavailable in this verification
environment, so syntax/deployment remain **documentation-only**. Before any real
installation, run `caddy validate --config Caddyfile --adapter caddyfile` with the
actual executable and inspect upstream headers. See the official
[Caddy reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
for header manipulation and transport settings.

Change inventory transport to `{"mode":"trusted-proxy","peers":["127.0.0.1"],"port":443}`,
replace local hostnames with individually approved public hostnames and approval
`operator-domain` or `platform-domain`. The CLI stays loopback-only. Exact actual
peer spelling matters; IPv4-mapped IPv6 is a different configured peer. Firewall the
backend and isolate local processes; an untrusted process on the same host must not
impersonate the proxy. Caddy must be the directly trusted edge, not a blind hop behind
another forwarding chain. HTTP/2 terminates at the edge; backend uses HTTP/1.1.

The reference removes Forwarded, X-Forwarded-For and X-Forwarded-Port and overwrites
host/proto with the edge's HTTPS authority. These removals are required by I1;
Caddy's default forwarding set alone does not satisfy Wydgine's contract. The proxy
must preserve Origin/cookies for ordinary App CSRF/authentication, but diagnostics
must never log them. There is no proxy cache in the reference. Any future cache must
key by effective scheme/host/port/path, honor private/no-store/Vary, and avoid caching
personalized or credential-bearing traffic. Backend-only cache keys mix tenants.
Transport timeouts are illustrative and must fit your accepted operation durations.

## Capacity, backups and failure recovery

Read I2 logical admission/payload counters as bounded lifetime observations, not
hardware telemetry or billing. Peaks are per-App; summing them does not establish a
simultaneous process peak. Compare workload-specific CPU, memory, native crypto,
JSON/SQLite I/O, media streaming and indexing measurements outside Wydgit. Limits
do not guarantee event-loop fairness. Storage quotas do not provision disk capacity.

Back up canonical source/configuration, installed catalogs, provider data/history,
Files/media and independently stored secrets using provider-consistent snapshots.
Test restoration on disposable roots. Keep originals until verification finishes.
History and install recovery are not backups; clean restart does not prove recovery
from SIGKILL, power loss, disk failure or interrupted remote I/O. See the full
[persistence matrix](milestones/0.3-I3/README.md#persistence-and-recovery-matrix).

## Architecture and next implementation phase

[I4](milestones/0.3-I4/README.md) separates trusted Wydgine worker facilities from
optional WydHosting provider orchestration. Its [I5 plan](milestones/0.3-I4/I5-plan.md)
preserves the operational behavior described here; no provider supervisor, Linux
isolation or installer is implemented by that design milestone.
