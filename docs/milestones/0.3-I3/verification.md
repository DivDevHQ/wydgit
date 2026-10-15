# I3 verification

Baseline: `84cfb35d44976134ab509550eecf93bb5cbaadd5`, `develop/0.3`.
Fetch confirmed local/origin equality and an initially clean tree. The completing
commit contains this report; resolve its full reference with:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I3/verification.md
```

Platform/Wydgine advances alpha.11 → **0.3.0-alpha.12**. Root manifest/lockfile,
canonical runtime revision, current docs and explicit version assertions agree.
WydClient **0.1.0-alpha.8**, WydSUB **0.1**, workspace service versions unchanged.
No new dependency, portable service, browser implementation or protocol was added.

## Baseline and execution environment

Node **24.21.0**, Chrome **155.0.8059.79**, local Linux fixtures. Initial sandboxed
`npm test` could not access required Git-history/socket facilities. The authorized
unrestricted **default-isolation** baseline passed **823/823**, zero failures,
skips or cancellations, 28.0 seconds. Baseline client/browser/package numbers were
independently reproduced against the final compatible implementation below rather
than simply copied from I2.

Investigation covered I0/I1/I2 contracts, the private controller, governance/output
meter, native hostname routing, single-App entrypoint/composition, Server/Session
retirement and library cleanup, persisted Gate sessions, local JSON/SQLite behavior,
Files local/S3 ownership, Search/Stream dependency state, catalog/receipt checks,
installation recovery markers and existing durability documentation. I3 reuses those
production paths; it adds no alternate executor, authority registry or provider API.

## Implemented operational APIs and acceptance

- Existing controller: `health()` and cleanly stopped `snapshotApp(id, target)`;
  `status`, `usage`, activation, binding, routing and retirement remain compatible.
- `createOperationalHost(policy, options)`: closed required/optional configuration;
  `start`, `snapshot`, `shutdown`, `signals`, trusted `controller` access.
- `restoreLocalApp(snapshot, destinationPolicy)`: bounded directory integrity,
  local-root rebinding, catalog validation, ordinary complete inventory validation.
- No HTTP probe or administrative REST endpoint; no Session or credential parsing
  for operations. Snapshots are cloned/frozen, fixed-dimension and sanitized.
- Host readiness differs from process liveness; App readiness, saturation, draining,
  failed and stopped states remain distinct. Required failure prevents listener
  startup; optional Start failure remains 503 while siblings/parking serve.
- Capacity uses actual I2 lifetime counters, with bounded deterministic warnings.
  Sum of App peaks is labeled as such, not a simultaneous hardware peak. Payload
  acceptance is not delivery. Quotas reset in a fresh controller, not a billing cycle.
- Real installed WBasic Taskboards execute through native HTTP before/after restart
  and relocation. There is no fake application executor.
- Shutdown marks not-ready before cleanup, denies new admission, uses I0 bounded
  drain and reports terminal failure on deadline. Held real Files provider work proves
  busy/ready distinction, sibling survival and deadline retirement. Listener collision
  prevents successful startup. Actual CLI subprocesses handle SIGTERM and restart
  without reinstalling. Existing single-App SIGINT/SIGTERM tests remain intact.

## Persistence and relocation evidence

Clean restart uses two real Apps, ordinary parking, one shared listener and JSON
providers. It verifies Store record recovery, Gate account/session reopening in the
same App, local Files existence, canonical Search indexing, Stream listing and a
persisted upload ticket (completion still correctly fails STREAM.STATE without a
body). Fresh runtime authority works; old App tokens and bound service handles fail.
This does **not** claim completed media-upload recovery or physical power-loss safety.

Stopped relocation copies Alpha to a new Host B root, preserving canonical content,
installed package/catalog, Store records, retained Gate membership/session state,
local Files bytes and a local media resource file. Installed Taskboard executes at B;
A's old bindings fail, A's Alpha route is 503, and Beta still serves. The separate
runnable relocation CLI also proves newly approved **shared hostname routing** at B.
The media-byte fixture is not a completed media-upload/reconciliation acceptance.
Destination executable dependencies are provisioned separately; source node_modules
and host routing never transfer. Destination inventory revalidates resource ownership.

Hostile cases include active source export, source links, directory traversal,
wrong identity/schema, extra metadata, missing/mismatched package inventory,
modified hashes/content, missing catalog, snapshot symlinks/hardlinks, existing
output, unsupported SQLite provider, changed resource owner and out-of-bound resource
root even with recomputed integrity records. Failed attempts leave no newly created
destination. Existing I0/I1/I2 suites retain recovery-lock, missing implementation,
stale config, ownership, unavailable parking, transport, timeout, quota and session
security coverage. No security regression was removed or timing assertion relaxed.

Snapshot hashes are unkeyed integrity records, not source authentication. Trusted
operators still approve transferred content, package policy, destination domains and
exclusive resource ownership. Tests do not establish cross-machine fencing.
SQLite/S3/custom-root relocation is explicitly rejected and requires provider-specific
handoff; it is not reported as completed migration. SIGKILL/interrupted-copy leftovers
require operator inspection; no automatic ambiguous recovery is attempted.

## Verification results

| Check | Result |
| --- | --- |
| Default-isolation baseline `npm test` | 823/823 |
| Final default-isolation `npm test` | 832/832; zero failures/skips/cancellations |
| New operational integration scenarios | 9/9 included in repository suite |
| Existing WydClient isolated-in-process unit run | 90/90 |
| Actual Chrome smoke | 16/16 |
| Actual Chrome controls/signing/embedded/public CLI | 4/4 |
| Actual Chrome hostname/HTTPS/origin/parking | 5/5 |
| Chrome total | 25/25 |
| Workspace `npm pack --workspaces --dry-run --json` | 7/7; no publishing |
| Reproducible `npm run build:client` | 23/23 distribution files byte-identical before/after |
| Baseline distribution comparison | 23/23 unchanged; fail-closed history guard retained/passing |
| `npm run check` | 3 complete pages, 42 internal links, unique anchors verified |
| `git diff --check` | Passed |
| Runnable local relocation CLI | Passed with real installed WBasic and Host B shared routing |
| Caddy executable syntax/live certificate deployment | Not run; executable unavailable, documentation-only reference |

Commands use the repository's default test isolation. Client-only command:
`node --test --test-isolation=none packages/wydclient/test/*.test.js`. Browser commands:
`node packages/wydclient/browser-smoke.js`, `node packages/wydclient/browser-controls.js`,
`node scripts/verify-hostname-browser.js`. Local Chrome HTTPS fixtures use ephemeral
certificates and a test-only validation exception, not a public CA deployment.

An intermediate run found two stale transport version expectations and a new fixture
that mixed installed package handlers with an independent host Page handler. Version
assertions were synchronized; the saturation fixture now holds an actual canonical
Files provider operation, preserving the production principal boundary. The initial
relocation CLI used fetch's unsuitable Host-header path; native HTTP now sends the
exact authority. All were corrected without weakening application/security assertions.

I2's reported concurrent Guestbook transient did not recur in the reproduced baseline
or final default-isolation runs. This observation remains **unresolved/not reproduced**;
passing reruns are not proof that the intermittent cause was fixed. No broad H5 review
or Guestbook timing change was introduced.

## Delivery and remaining scope

Documentation includes the I3 architecture/state/persistence/relocation contract,
practical operator guide, persistent multi-site CLI, relocation demonstration and
Caddy reference; current README/HTTP/SEAM guidance and changelog are updated.
Historical milestone reports and browser distributions are unchanged.

No live deployment, tag, release, main merge or downstream project change. This is
shared-process logical isolation, not CPU/heap/worker fairness. Counters are volatile.
No public admin API, distributed lock, live migration, remote namespace transfer,
automated backups, hard-crash/power-loss certification or public certificate test.
The narrow relocation profile's size/provider limits are deliberate rejections.

I3 supplies the runnable local operational/portability foundation. Remaining external
qualification is explicit: actual proxy execution, provider-specific backup/restore,
completed media recovery and abrupt-process termination exercises. Recommend I4 for
supervisor/process-isolation and provider failure/recovery qualification before
closing hosting infrastructure work; J should add separately authorized administration,
not infer authority from this metadata. This report is not production certification
or an independent security audit. Commit/push and clean-tree equality are verified
in the final handoff against the completing commit.
