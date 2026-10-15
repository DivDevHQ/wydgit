# I5.2 verification

Starting branch **develop/0.3**, SHA **31f658070eb187f3a958089b856b2e8aa944c720**,
clean tree. `git fetch origin develop/0.3` and `git rev-list --left-right --count
HEAD...origin/develop/0.3` confirmed **0/0**. No subsequent commits were discarded.
Read AGENTS, development/founding architecture, all ten I4 documents, I5.1 implementation,
dependency audit and verification; reviewed actual App/server/host/inventory/library/
transport/trusted-adapter code and startup regressions before implementation.

Environment: Linux, Node **24.21.0**, npm **11.19.0**, Chrome **155.0.8059.79**.
The baseline passed **836/836** before source changes, ordinary default isolation,
27423 ms. Socket/Git/Chrome integration commands use the authorized environment where
required. Logs are `/tmp/i52-*`; they are disposable evidence, not shipped artifacts.

## Executed gates

| Check | Result |
| --- | --- |
| Baseline `npm test` | 836/836, no failures/skips/cancellations |
| Implementation `npm test`, normal default isolation | 853/853, no failures/skips/cancellations; 24542 ms |
| Focused `node --test test/launcher.test.js test/engine-boundary.test.js test/multi-app.test.js test/hosting-operations.test.js` | 49/49, no failures/skips/cancellations; 8062 ms |
| `npm run test:client` with required Git subprocess access | 90/90, no failures/skips/cancellations; 4709 ms |
| `node packages/wydclient/browser-smoke.js` | 16/16 actual Chrome cases |
| `node packages/wydclient/browser-controls.js` | 4/4 actual Chrome fixtures |
| `node scripts/verify-hostname-browser.js` | 5/5 actual Chrome TLS/proxy/origin/cookie/parking/local HTTP fixtures |
| `node scripts/verify-i4-architecture.js` | Four validation groups passed |
| `npm pack --workspaces --dry-run --json` | Eight packages, including private development adapter; no publication |
| `npm run check` | Three complete pages, 42 internal links, unique anchors |
| `git diff --check` | Passed |
| Tracked WydClient distributions compared to starting SHA via Git blob bytes | 23/23 byte-identical |

After final code/documentation edits, required `npm test`, focused launcher tests,
`npm run check`, whitespace and distribution comparisons are rerun before commit.
Their exact final result is reported in the delivery message; the test count is 853
including 17 new launcher tests. No test isolation setting, assertion, timeout or
historical browser artifact was weakened to obtain a passing gate.

## New executable evidence

Seventeen launcher tests exercise command grammar and limits; unknown/duplicate flags,
extra positionals, unsupported HTML setup, closed schema/listeners; relative/absolute,
Unicode/space and config-relative paths; configured default and explicit precedence;
headless refusal; discovery, hidden/symlink/invalid roots, duplicate IDs and overflow;
single/multiple numbered choice, invalid retry, cancel/EOF and revalidation; recovery
markers/hardlinks; bounded terminal input; fresh setup/rerun/default preservation and
save refusal; conflicting manifest scripts and unrelated field preservation; exact
local version verification; atomic replacement, 0600 exact backups, stale revisions,
exclusive setup lock and simulated partial-save recovery.

Real Linux pseudo-terminals (`script`) execute the actual CLI selector and setup wizard.
The selector requires a choice for one App, asks separate default-saving consent, and
launches the chosen canonical App. Setup prepares an actual consumer package.json.
These supplement presentation-independent prompt tests, not replace them.

Two real concurrent processes launch distinct Apps with distinct TCP listeners; one
starts through consumer npm from a subdirectory with forwarded Unicode/space App and
relative config arguments. HTTP verifies distinct content and runtime assets, no
cross-App substitution, explicit listener collision error, and SIGTERM/SIGINT cleanup.
Another test invokes historical root `npm start -- apps/ignored`, verifies the sample
still responds and shuts it down. The historical server.js and root start script are
unchanged. Tests clean native listener processes as well as npm/script wrappers.

The existing real five-library fixture runs through launcher validation/start, renders
HTTP, invokes canonical Store count through the original branded SEAM context, closes
services/listener, then proves a configured implementation-version failure leaves its
port available. Focused I5.1/I0–I3 suites retain real installed Taskboard, recovery,
ownership, retirement, routing and relocation assertions. Full tests retain canonical
JSON/SQLite, Gate, Files, Search, Stream, browser assets and historical distributions.

## Intermediate failures and disposition

- Initial restricted fetch failed writing `.git/FETCH_HEAD`; authorized fetch succeeded.
- Initial restricted baseline: 65/89 file-level tests passed, 24 failed, no skips or
  cancellations. Integration fixtures lack their normal socket/Git facilities in that
  environment. The authorized baseline then passed 836/836; the restricted result is
  not counted as a passing baseline.
- First new focused run passed 12/12. Expanded run passed 15/16: the pseudo-terminal
  readiness parser incorrectly required JSON at the beginning of a line, while the
  prompt precedes it on that line. Corrected only the test parser; the next run passed
  16/16. Process inspection confirmed no leftover launcher. A seventeenth bounded-input
  test was added and the combined focused run passed 49/49.
- Initial restricted client run: 89/90. Historical-distribution integrity's `spawnSync
  git` returned **EPERM**. The same command with authorized subprocess access passed
  90/90. No historical integrity check was removed or altered.

The historical held-request shared-host HTTP500 and concurrent Guestbook/Contact
HTTP500 did not recur in the successful baseline or implementation full runs. Their
root causes remain unestablished; this milestone does not claim a reliability fix.
No speculative runtime change, increased timeout, weakened assertion or reduced test
isolation was used. Chrome uses ephemeral local TLS certificates and existing test
exceptions, not public CA/domain qualification.

## Review, versions and remaining boundaries

New source is confined to `wydgine/launcher`, the private `packages/wydgine` adapter
and launcher tests. Root package gains only a development CLI script; lockfile gains
the private workspace/bin metadata. README/navigation and changelog point to this
milestone. No existing execution, service, SEAM, transport, controller, browser source,
sample App or data root is changed. One existing `createHostApp` executes each selected
App; the launcher uses the authoritative inventory validator without creating a controller.

Platform and adapter **0.3.0-alpha.12**, WydClient **0.1.0-alpha.8**, WydSUB **0.1**.
Private launcher tooling introduces no new engine ABI or published release; no automatic
version bump is warranted. Offline package-lock-only update adds no external dependency.

Setup persistence is atomic per file, with private exact backups and conflict checks,
not a multi-file transaction or hostile-OS race-proof staging system. Partial failures
and interrupted locks require the documented inspection/backup procedure. Startup and
shutdown deadlines can force process exit; they cannot preempt synchronously blocked
trusted native code. Process separation alone does not enforce cross-UID resource
ownership; external process/OS policy remains the operator's responsibility.

The private adapter tarball is deliberately not self-contained. Consumer fixtures
retain controlled links to the repository engine closure, and setup verifies that
actual local adapter/version. No remote npx downloads, independent package installation,
publication, web setup, provider registry, supervision, IPC or OS provisioning is claimed.
I5.3 registry/safe setup plans can build on these validation/persistence operations;
I5.4 must complete genuine packaging and isolated installs.

Full diff/status/stat and all 23 browser blobs are reviewed before the authorized
commit/push. Resolve the completing commit without a self-referential hash:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.2/verification.md
```

Delivery confirms local/remote SHA equality and clean working tree. No tag, release,
main merge, live deployment or npm publication is authorized or performed.
