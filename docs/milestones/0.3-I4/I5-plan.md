# I5 implementation specification

**Current release scope — 2026-10-18:** accepted
[Decision 0003](../../decisions/0003-defer-managed-hosting-qualification-to-0.4.md)
defers managed, multi-tenant WydHosting qualification to **0.4**. I5.6 is incomplete,
experimental and not security qualified; its six outstanding security work packages
and all acceptance/evidence requirements remain. The Debian 13 VM trial is also
scheduled for 0.4, without guest authorization; Debian remains a supported target.
Wydgine's five-site migrations continue toward **0.3** using independent Node
processes, OS users, secrets and storage behind a conventional reverse proxy.
These deployments do not satisfy managed hosting gates. See the
[current release record](../0.3-release-status.md) and separate unresolved
[0.3 HTTP reliability issue](../0.3-reliability.md). The original technical plan
below is retained; managed qualification is no longer a prerequisite for the
standalone 0.3 migration path, and no acceptance criteria are removed.

Design baseline alpha.12, I4 contracts version 1. Implement in gated subphases; do not
attempt package extraction, privileged setup and every provider migration at once.
Wydgine runs Apps; WydHosting operates infrastructure. Preserve I0–I3 throughout.

## 1. Final layout and compatibility boundary

Proposed target (not the current tree):

```text
package.json                         private wydgit development workspace
app.js / server.js                   legacy sample-compatible shims
packages/wydgine/
  package.json / bin/wydgine.js
  src/app.js                         existing root App composition
  src/engine/                        existing wydgine implementation tree
  src/launcher/{config,selection,setup,start}.js
  src/trusted/{worker,protocol,inventory}.js
  runtime/wydclient/                  required server upload runtime assets
packages/wydhosting/
  package.json / bin/wydhosting.js
  src/{setup,registry,supervisor,routing,migration,recovery,audit}/
  src/platform/linux/{accounts,systemd,cgroups,firewall,proxy,staging}.js
  broker/                            minimal root-owned typed operation service
  templates/                         reviewed units/proxy/managed firewall fragments
packages/wydclient,wydstore,wydgate,wydfiles,wydstream,wydsearch/  retain identities
wydgine/                             compatibility imports during transition
```

Physical movement is phase 4 only, after a coherent packed engine exists. Before
that, trusted entry adapters wrap current implementation paths. Do not build a second
runtime or make a published tarball import `../../wydgine` outside its own closure.
A temporary private package can exercise adapters, but is not independently installable
until all implementation/assets are shipped. Compatibility shims must resolve to the
same ExecutionContext module instance to preserve WeakSet brands and object identity.
Never copy runtime modules into two independently loaded implementations in one process.

## 2. Manifests, exports and distribution

Proposed public names **wydgine** and **wydhosting** require registry ownership/name
availability review before publication. Until authorized to publish keep new packages
private. ESM, MPL-2.0, Node engine constraints tested against full selected profile;
use >=24.21 initially for complete canonical-services provider profile. Do not claim
all profiles need only the current root's >=22.12 while Files requires more.

Wydgine manifest target:

```json
{
  "name": "wydgine",
  "type": "module",
  "bin": {"wydgine":"./bin/wydgine.js"},
  "exports": {
    ".":"./src/app.js",
    "./trusted/worker":"./src/trusted/worker.js",
    "./trusted/protocol":"./src/trusted/protocol.js",
    "./package.json":"./package.json"
  },
  "files":["bin","src","runtime","README.md","LICENSE"]
}
```

Public root exposes small `createApp/createHostApp` embedding surface; trusted worker
export wraps controller/operational/snapshot functions without portable registration.
Keep renderer API compatibility via legacy path, not accidentally changing index's
meaning for existing consumers. Exports are organization, not security against malicious
Node code. Internal services remain unavailable to portable code through SEAM.

WydHosting manifest has `bin.wydhosting`, exports `.` for trusted setup/provider
facade, `./contracts` for provider operation schemas, `./package.json`, and files
bin/src/broker/templates/docs/license. It depends on an exact compatible Wydgine
prerelease (explicit prerelease range behavior), never reverse. Protocol codecs live
in Wydgine trusted export. No neutral package until a demonstrated third consumer.

Transfer root Hono/marked/sanitize-html/semver/re2js/busboy dependencies to engine
manifest according to actual imports, not guessed bundle closure; root may retain
build/dev dependencies. Canonical libraries stay optional explicit approved installs,
with trusted resolvable versions at App root or approved installation ancestry.
Do not auto-install them on a runtime request. Resolve/verify metadata and exports
outside workspace hoisting. Review Files/Stream private flags and publication readiness
separately; pack/install local tarballs proves mechanics, not npm release approval.
Root lockfile/workspaces must include final package closure consistently.

Existing WydClient classic bundles and historical distributions are immutable. Update
build source paths if files move, then require identical current output and all
historical checksums. Do not accidentally ship compiler/native/server code in browser.

## 3. Module disposition checklist

| Current path | I5 action |
| --- | --- |
| `app.js` | Wrap first; later move composition to engine src/app, keep root re-export using same module graph |
| `server.js` | Preserve sample startup and HOST/PORT; new bin separate, migration opt-in |
| `wydgine/index.js`, repository, definitions, object model, WBasic, SEWN, SEAM, execution, events, presentation | Retain engine ownership; move together only after import/build closure map and parity |
| `host.js`, libraries/*, packages/* engine installer | Retain initialization, recovery, principals and trusted implementation resolution; export small trusted wrappers as needed |
| `multi-app.js` | Retain controller; extract validation helpers to trusted inventory module, preserve original exports; no limit increase |
| `http/routing.js`, pipeline, transport, cookies, metered output/transfers | Retain engine; add explicitly authenticated Unix transport profile only after tests, leave IP profile compatible |
| `governance.js` | Retain engine App meter; no billing/hardware rewrite |
| `operations.js` | Retain compatibility, wrap worker-local policy/signals; provider process policy in new supervisor |
| `relocation.js` | Retain profile/compatibility; import extracted validator instead of controller; provider journal orchestrates calls |
| Existing examples | Keep runnable baseline imports via shims; new package demos use packed installs |
| `packages/wydclient/build.js`, scripts/build-client-package, native asset paths | Audit/repoint only as extraction requires; require byte-identical browser distributions |
| Provider operations | New WydHosting modules; do not mislabel absent supervisor/account/cgroup functionality as extracted code |

## 4. Numbered implementation phases

### I5.1 — Engine boundary and baseline locks

Read I4 and current source again. Confirm branch/clean state and preserve later commits.
Record all imports of root package metadata, App composition, runtime client assets and
canonical libraries. Add meaningful standalone and real multi-App parity fixtures using
existing Taskboard/five-library provisioners. Extract inventory validator/helper code
without behavior change; remove `relocation → controller → relocation` cycle. Preserve
`validateAppInventory` export and all path/owner/recovery tests. Add trusted adapter
entry exports; no native supervisor yet.

Gate: full repository/client/browser suites, old examples and relocation pass; brands
are singular; no WydHosting import from engine; no runtime behavior/version change
beyond deliberately documented packaging work. If split is risky, retain internal
files and adapter rather than forcing movement.

### I5.2 — Standalone selection and setup

Implement `launcher/config,selection,start,setup` and bin using the exact precedence,
config schema, bounded discovery and cwd rules in [setup contract](setup-administration.md).
Parse before initializing, reject malformed default/config/explicit path without fallback.
Keep `createHostApp` validation and library cleanup. Wait readiness before listen; bounded
signal cleanup and listener errors produce sanitized nonzero exit. Trusted standalone
operator selects root explicitly; canonical identity comes from content, never basename.

Setup previews backed-up local script/config changes, writes atomically, preserves
unrelated scripts/dependencies, and never configures an `install` lifecycle script.
Implement TTY selector and explicit noninteractive default selection; headless web
wizard deferred, `APP_SELECTION_REQUIRED` exits safely. New apps layout opt-in. Test
three named App path examples with spaces/Unicode directories where supported, subdir
npm invocation, cancelled selection, duplicate IDs, invalid/default/recovery paths,
unknown options, absent Apps, port collision and SIGINT/SIGTERM. Do not depend on npx
network fallback. Gate: development CLI and generated consumer npm start work in a disposable
fixture with the current trusted engine closure; root legacy npm start unchanged.
Independent packed installation is the phase I5.4 gate, not claimed at this adapter stage.

### I5.3 — Provider registry and dry setup plans

Implement closed versioned records from [customer model](customer-pool-model.md), strict
reference/uniqueness/path/resource validation, immutable plan revision, exclusive single
writer and durable operation journal. Customer/account/pool/App/domain/Gate identity
must remain separate. Compile a canonical pool-base inventory accepted by existing
engine; never introduce arbitrary real roots into I0 inventory. Free one-App entitlement
is provider policy; paid account/process association independent of SEAM.

Implement CLI inspect/plan/validate/reconcile and typed authorized apply entry; start
with local fixture OS adapter that records plans but explicitly cannot certify production
setup. Pure validation must not mutate OS. Test stale revisions, duplicate IDs/paths/
namespaces across pools, tier transitions/counts, malformed state, crash journal replay
and unauthorized plans. Gate: zero OS side effects without approved apply; no production
ready result for simulated/unsupported adapter.

### I5.4 — Complete packed packages and safe extraction

Move coherent engine closure into final package layout; replace old paths with
compatibility re-exports/import shims. Preserve original sample root via explicit
legacy root, not package-source-relative default. Ship shared runtime upload assets;
fix platform metadata imports to packaged metadata. Preserve trusted implementation
resolution, either explicit approved consumer installation root or existing ancestor
resolution with tests; do not assume workspace node_modules exists in tarball consumer.

Use `npm pack --dry-run` plus **actual local tarball install** into isolated disposable
consumer (no sibling repo paths), with standalone service-free App and five-library
profile installed from local tarballs. Exercise Store JSON+SQLite, Gate, Search, Files,
Stream, package install/recovery, HTTP/static upload assets, startup/shutdown and
relocation. Check `npm ls` and full exported import closure; engine runs without
WydHosting present. Dependency-cycle/static boundary check and WydClient distribution
checks required. No package publishing in this phase. If closure fails, keep source
in original location with unpublished adapters and report incomplete extraction; never
publish a wrapper that relies on monorepo paths.

### I5.5 — Worker protocol and disposable process supervision

Implement framed codec, authenticated bootstrap, version/generation checks, fixed
messages/queues/deadlines from [process design](process-isolation.md). Expose only
plain sanitized results; controller tokens and raw callbacks never cross channel.
New engine worker entry composes I3 wrapper and private listener. New WydHosting
supervisor owns desired/observed state, durable restart budgets and route revisions.
Start with disposable subprocess fixtures under same UID, explicitly marked nonproduction;
then qualify broker/systemd inherited channel with UID boundaries in next phase.

Run real Apps through child workers, death/restart/EOF/stale-message/backpressure/
blocked-hook/duplicate-operation tests. Confirm old authority cannot bind fresh runtime,
listener does not route early, required/optional policy parity, no accidental public
control endpoint and no orphan processes. Provider pool membership changes replace
fixed inventories with planned drain; preserve sibling data. Gate: no claim of paid
isolation before OS lane passes.

### I5.6 — Linux broker, private ingress and security qualification

On disposable Ubuntu candidate VM implement root-owned narrow broker, nonroot
supervisor/systemd worker units, restricted pool/customer identities and cgroup v2
policy. Implement staging with race-safe copy/sealed source strategy; current path
checks alone insufficient. Generate approved private worker endpoints. Qualify Unix
HTTP socket peer identity and engine routing support; alternatively prove kernel-enforced
loopback UID restrictions. No untrusted local proxy impersonation. Preserve current
trusted-proxy and local development profiles without widening peer trust.

Implement one tested proxy adapter and UFW transactional firewall adapter with independent
rollback timer, fresh SSH verification and IPv4/IPv6 external exposure checks. Operator
supplies approved certificates initially. Refuse unsupported panels/managers and missing
privilege; do not disable MAC. Set up quotas/I/O only where verified and report unavailable
controls. No persistent root supervisor/worker or arbitrary npm execution as root.

Gate: [host-security](host-security.md) VM attack matrix, worker access/UID/control
channel checks, OOM/CPU/cleanup, firewall interruption/reboot and proxy origin/browser
suite. Record exact image/kernel/Node/proxy/native module versions. Only after success
mark that exact lane officially tested; Debian lane independently follows. Inability to
complete these checks leaves experimental status and managed production setup disabled.

### I5.7 — Stopped migration and provider recovery

Implement single-host journaled free-to-paid flow for I3 local JSON/local Files/Stream
profile only, with account/pool provisioning, source stop/fence, final transfer,
destination validation, versioned routing cutover, verification and retained rollback.
No runtime reactivation of terminal controller. Enforce global namespace and exclusive
process ownership; prove old cgroup dead before new writer where required. If per-App
stop fails in shared pool, fail migration and coordinate maintenance, not kill unrelated
customers without operator policy.

Test interruption at every journal phase, SIGKILL during transfer/cutover, supervisor
restart, incomplete targets, stale route acknowledgement, destination writes before
rollback, disk full, backup restore and duplicate resource claim. Power-loss tests
need VM/storage qualification; document residual durability limits. SQLite/S3/custom
provider migrations return explicit unsupported errors until separately qualified,
not a partially successful generic copy. Distributed/multi-host cutover deferred.

### I5.8 — Integration and release decision

Rerun complete required checks after final edits. Include old entrypoint, I0–I3 examples,
standalone packed consumers, multi-worker real canonical Apps, Linux VM evidence and
failure matrix. Review manifests/lockfiles, export graph, root compatibility, all
historical browser checksums and full diff. Update versions/changelog only for actual
runtime/package changes; assign a new platform prerelease at implementation time and
pin package compatibility, without changing historical I3 alpha.12 snapshot schema
acceptance casually. New independent provider package version axis requires explicit
compatibility matrix. Publishing/tagging/deployment is a separate authorization.

## 5. Cross-phase acceptance and rollback

| Acceptance | Evidence required |
| --- | --- |
| Engine independent | Tarball consumer with WydHosting absent; default one App, explicit root/default/TTY/headless precedence; no Linux provider imports |
| Existing security parity | Full I0 ownership, I1 routing/origin, I2 accounting, I3 operations/relocation regressions unchanged, no grants from identity |
| Provider process ownership | Authenticated channel + durable generation, confirmed process death/exclusive resource owner before replacement |
| Paid isolation | Actual distinct UID/process/cgroup, kernel access denial and restricted private ingress; not same-UID child-process demo |
| Filesystem safety | Adversarial link/replacement race fixture; immutable execution inputs, bounded approved staging and global resource ownership |
| Installation safety | Typed plan authorization, no root runtime, independently scheduled firewall rollback, unsupported capability refusal |
| Recovery | Journal replay, stale route handling, post-write rollback consistency and qualified provider backup restore |
| Browser preservation | Existing browser suites and every tracked dist file byte-identical unless a separately authorized client change warrants a new immutable release |

Keep each subphase reviewable and compatible; if scope exceeds one milestone, stop
at a passed boundary and schedule I6 rather than omit security gates. During extraction,
keep compatibility shims until downstream migration is verified. Roll back code by
ordinary revert commits (no reset/history rewrite), retaining prior verified package
lock/config backups. Deployment rollback first retires new workers and resolves write
ownership; do not launch old engine against changed state without compatibility checks.
Provider schema changes need explicit read/upgrade/backup policy; refuse unknown schemas.
Keep production route disabled until the known-good runtime/data/ownership set agrees.

Deferred: density >16, dynamic inventory hot reload, worker-thread tenant isolation,
containers certification, live/zero-downtime migration, distributed fencing/HA, billing,
durable commercial metering, automatic DNS/ACME, generic SQLite/S3/custom migration,
web setup/admin GUI, native DEB/RPM/bootstrap shipping, control-panel plugins, WydOS,
Almond/desktop packaging and L's independent security audit. These deferrals keep I5
implementable without redesigning the working engine or overstating guarantees.
