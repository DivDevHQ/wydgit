# I4 verification and evidence limits

Starting branch `develop/0.3`, clean tree. An authorized fetch confirmed local HEAD
and `origin/develop/0.3` both **583a43e24378cc6a844c91e49923db78313924d6**.
I3 baseline **b55d214ebe14ee27bc255e60ac2f4c8f9f168368** is retained, together with
subsequent long-term vision documentation. No reset/rebase/history rewrite.
The completing commit is resolved with:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I4/verification.md
```

## Scope and inspection

Read development/founding architecture guidance, root README/manifests and launchers,
renderer and App composition, host initialization, controller, operations, relocation,
governance, raw routing, Hono transport/pipeline, SEAM context provenance, library
initialization/dispatch/approved package resolution, repository/catalog and installation
recovery. Reviewed I0–I3 reports/verification, hosting operations, long-term vision,
canonical workspace exports, browser build/release conventions and regression fixtures.

Ten I4 documents plus current navigation/changelog additions describe proposed contracts.
Only executable addition is `scripts/verify-i4-architecture.js`, a disposable validation
fixture. No production API/module extraction, dependency/manifest/lockfile change,
supervisor, OS provisioning, wizard, public administration endpoint or commercial
service is implemented. Platform **0.3.0-alpha.12**, WydClient **0.1.0-alpha.8** and
WydSUB **0.1** unchanged; design-only work requires no runtime version bump.

## Executed evidence

Environment: Linux, Node **24.21.0**, npm **11.19.0**, Chrome **155.0.8059.79**,
installed workspace/native dependencies. Required local socket/Git operations use the
authorized environment outside read-only/socket restrictions. Logs are disposable
`/tmp/wyd-i4-*` artifacts, not committed test outputs.

| Command / comparison | Observed result |
| --- | --- |
| `npm test` | 832/832, ordinary default process isolation; zero failures/skips/cancellations |
| `node --test test/hostname-host.test.js` | 9/9 focused regression run |
| `node --test test/hardening.test.js` | 4/4 focused regression run |
| `npm run test:client` | 90/90, includes reproducible client build |
| `node packages/wydclient/browser-smoke.js` | 16/16 actual Chrome cases |
| `node packages/wydclient/browser-controls.js` | 4/4 native controls/signing/embedded/public CLI fixtures |
| `node scripts/verify-hostname-browser.js` | 5/5 actual HTTPS/proxy/origin/cookie/parking/local HTTP fixtures |
| `npm pack --workspaces --dry-run --json` | 7/7 existing workspaces; no publication |
| `npm run check` | 3 complete pages, 42 internal links, unique anchors |
| `node scripts/verify-i4-architecture.js` | Four validation groups passed |
| `node --check scripts/verify-i4-architecture.js` | Syntax valid |
| All tracked `packages/wydclient/dist` vs inspected baseline | 23/23 byte-identical, including historical artifacts/current pointer |
| Local I4 documentation link targets | All relative file targets exist |
| `git diff --check` | Passed |

The focused fixture constructs real canonical example content in a private temporary
root, calls `createHostApp({root,appId})` directly, serves real HTTP 200 and shuts down
without creating a multi-App controller. It validates the existing inventory, proves
symlink alias rejection and confirms 17 entries fail the current ceiling. It then
installs an offline local mock package with `bin` metadata using npm (scripts disabled),
checks npm-created executable link, absent inherited dependency setup script, generated
consumer start/hosting scripts, forwarded App arguments, subdirectory package-root cwd,
and local `npm exec` setup. It cleans temporary Apps, listener and npm cache.
This proves npm mechanics, not availability or implementation of future named packages.

Existing full-suite tests provide real five-library/installed Taskboard/controller
ownership, required/optional startup, retirement, health and stopped local relocation
coverage. I4 does not duplicate those production paths. New process topology and
wire schemas are design, not an experimentally implemented supervisor protocol.

Initial restricted fetch could not write `.git/FETCH_HEAD`; the authorized fetch
succeeded. Initial restricted fixture could not open its local listener; its teardown
masked that denial with `ERR_SERVER_NOT_RUNNING`. The fixture cleanup now checks
listener state; authorized socket-enabled runs pass. These attempts are not passing
checks and no production transport was changed to accommodate them.

One intermediate default-isolation full rerun was **831/832**: the existing
`shared dispatch drains accepted requests and isolates shutdown, asset validators
and failed parking` test received 500 rather than 200 for its held Alpha request at
`test/hostname-host.test.js:64`. The unchanged focused file passed **9/9**. The
underlying cause is unconfirmed; a contention/deadline hypothesis is not a diagnosed
runtime defect. No test assertion, execution deadline or production code was changed.
This remains a test-reliability observation alongside the successful complete run;
the final required rerun is reported in the handoff.

A second intermediate full run was also **831/832**, this time in existing
`JSON: clean interactive Contact install, concurrent HTTP submissions, restart and
explicit base-site cleanup`: one concurrent POST returned 500 at
`test/hardening.test.js:46`. Its unchanged focused file passed **4/4**. This is
consistent with the class of concurrency observation recorded in I2, but no shared
root cause is established. Both failures are retained here; neither focused success
nor a later full success proves the reliability issue resolved.

## External contract references and untested gates

Checked official [npm start](https://docs.npmjs.com/cli/v11/commands/npm-start/),
[npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
and [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) documentation.
Local npm fixture is the environment-specific evidence; cgroup documentation informs
the proposed layers, not a claim that WydHosting enforces them.

Not run/implemented: real engine/provider tarball installation (packages absent),
supervisor authenticated IPC, cross-UID/cgroup isolation, race-safe staging helper,
Unix HTTP proxy authentication, firewall rollback, systemd provisioning, distro VM
qualification, Caddy executable/live CA validation, 20–50-App capacity benchmark,
SQLite/S3/custom migration, power-loss qualification or distributed fencing.
No officially tested WydHosting distro, security certification or production-readiness
claim follows from these tests. Those are explicit I5 acceptance gates; J/K/L and
future Almond/WydOS/desktop work remain outside this milestone.

Final review covers complete diff, working-tree status/stat, unchanged runtime and
dependencies and documentation links. Required checks are rerun after final edits.
The final handoff records commit/push SHA equality and clean working tree; no tag,
release, deployment, npm publication or main-branch change is authorized here.
