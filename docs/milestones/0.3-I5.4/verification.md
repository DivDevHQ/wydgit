# I5.4 verification

Executed 2026-10-15 on Linux x64, Node **v24.21.0**, npm **11.19.0**,
Google Chrome **155.0.8059.79**. Baseline **bb4664efc8c4d38c62b8896db2ebaab3aa6b7de8**,
branch develop/0.3, initially clean and equal to origin after fetch. No later commits
were discarded. This milestone is local packaging verification, not publication or
production hosting qualification.

## Executed matrix

| Check | Actual result |
| --- | --- |
| Baseline `npm test`, normal isolation | 888 passed, 0 failed/skipped/cancelled |
| Baseline `npm run check` | passed: 3 complete pages, 42 internal links, unique anchors |
| Final `npm test`, normal isolation | 890 passed, 0 failed/skipped/cancelled |
| `npm run test:client` | 90 passed, 0 failed/skipped/cancelled |
| `node packages/wydclient/browser-smoke.js` | 16/16 actual Chrome cases |
| `node packages/wydclient/browser-controls.js` | 4 native input/signed/embedded/quick-start fixtures passed |
| `node scripts/verify-hostname-browser.js` | 5 actual Chrome HTTP/TLS/hostname/parking fixtures passed |
| `node scripts/verify-i4-architecture.js` | 4 architecture groups passed; historical mock npm-mechanics case remains labelled as such |
| `node scripts/verify-packed-packages.js` | three actual independent tarball consumers passed |
| Installed five-library regression | 148 passed, 0 failed/skipped/cancelled |
| Installed provider regression | 35 passed, 0 failed/skipped/cancelled |
| Installed provider npm bin | inspect, validate, deterministic plan, unauthorized refusal, apply, reconcile, stale/hostile rejection passed |
| `npm pack --workspaces --dry-run --json` | all 9 workspaces packed successfully |
| `npm run check` | passed |
| `git diff --check` | passed |
| Browser history/build integrity | all 23 tracked distribution files byte-identical to bb4664e; immutable historical guard and candidate rebuild passed |

The full suite includes I5.1 boundary, I5.2 launcher/setup/TTY/CLI, I5.3 closed provider,
I0–I3 controller/routing/governance/operations/relocation, canonical services,
WBasic/SEWN, package recovery, token retirement and hostile security regressions.
Two new package-boundary tests inspect real canonical sources and assert legacy /
installed context identity and exact prerelease behavior. Source-safety tests were
repointed to canonical compiler/executor modules; they do not merely inspect shims.
Transport tests follow the actual browser module graph and compare canonical bytes.

Real example verification: membership demo passed with JSON and SQLite; media demo
uploaded PNG/WAV, rendered gallery/player, returned 206 ranges and denied anonymous
access. Multi-App, hostname-host and search JSON/SQLite example runners served actual
HTTP, then their disposable processes were stopped. Hosting-operations init/start /
restart, installed Taskboards, Contact, Guestbook and Search/Stream packages are also
exercised through full and packed regression fixtures. Source-components and WBasic
Taskboard builders execute in the existing real-App/compiler tests.

## Retained local evidence

Final independent installation evidence is **/tmp/wyd-i54-packed-UARuks**:

- `tarballs/*.tgz`: seven real locally packed Wydgit artifacts.
- `*-pack.json`: npm pack file lists, sizes and integrity.
- `*-install.log`, `*-dependencies.json`: real npm installation and dependency graphs.
- `service-free.log`: installed binary, npm script startup, complete browser resource
  closure, clean engine/npm shutdown, restart/default selection, malformed/absent refusal.
- `five-library-tests.log`: 148 real installed-package regression cases.
- `provider-tests.log`, `provider-bin.log`: 35 registry cases and actual npm bin commands.
- Per-consumer `resolved-paths.log`: synchronous ESM/CommonJS/native resolution evidence;
  original development-repository paths cause immediate failure, including subprocesses.
- Service-free `asset-paths.log`: every requested runtime asset physically present under
  that consumer's installed engine, compared byte-for-byte with its HTTP response.
- `result.json`: final success, runtime version, tarballs and consumer directories.

Wydgine tarball: **101 files**, integrity
`sha512-0asW/4XEmJxRQpqK+dvanYj3FgIOO1pZ0t3oRSCwI9FlzjRht92m8qJkBsl5ZC2Vowo5nZNHzTd/c79hqyt6gQ==`.
WydHosting tarball: **9 files**, integrity
`sha512-R9nt9ulnDu7QXW1/sTR/uvX4eneC74g+v6bbPvazWRi+6Z1Rhk28YClX7zClksPYX8qN08BAiN7C7AUtX3m54w==`.

Service-free installs only Wydgine and its declared commodity dependencies: WydHosting,
Store and Gate resolution is explicitly absent. The provider first installs only Wydgine/WydHosting and executes every CLI command;
canonical service tarballs are added afterward for its real-App regression. Full and
provider regression consumers use all local Wydgit tarballs plus ordinary third-party npm resolution. No offline claim is
made. Cheerio 1.0.0 is an explicitly installed regression-only dependency. All three
consumers contain exactly one physical Wydgine package; installed package directories
are real directories, not workspace/repository links. Fixtures that need canonical
libraries resolve from their consumer installation ancestry. Exact engine pins and
Search/Stream peers prevent reliance on stable-range prerelease assumptions.

Native execution resolves to consumer-local better-sqlite3/prebuilds/linux-x64.node
and argon2/prebuilds/linux-x64/argon2.glibc.node. Real SQLite transactions, concurrency,
corruption refusal, process-death recovery, Gate password hashing/login/session and
cleanup ran successfully. npm 11 reported an unapproved Argon2 install script; its
shipped prebuild worked without approving or running that script. Other OS/native
build lanes were not executed and are not certified here.

Root logs are retained under /tmp/wydgit-i54-*: baseline-native.log, final-test.log,
client-unit.log, chrome-smoke.log, chrome-controls.log, chrome-routing.log, i4.log,
packed-final.log, membership-json.log, membership-sqlite.log, media.log,
example-runners.log, workspaces-pack.json and browser-hashes.json. These disposable
logs/artifacts are intentionally excluded from package contents and repository state.
The first restricted-sandbox baseline failed at test-file/subprocess/socket boundaries;
the artifact test and full baseline passed with normal process/loopback access.
Subsequent checks use that normal environment, preserving test isolation.

Initial extraction verification exposed version/source-path assertions requiring
updates. Early consumer fixture attempts exposed missing staged configuration and
consumer ancestry, and an npm-parent-versus-engine signal assertion. Those fixture
errors were corrected without weakening runtime security or deadlines. A hostname
smoke harness using fetch's Host override received expected 421; native HTTP with the
explicit approved Host passed. These are not evidence of an App HTTP500 defect.

## Dependency audit

`npm audit --json` returned nonzero for two unchanged baseline dependencies:
file-type 21.0.0 (moderate ASF parser/ZIP denial-of-service advisories) and happy-dom
20.8.4 (high cookie-origin/code-generation advisories). Both exact lockfile versions
match bb4664e. happy-dom is a development test dependency, excluded from the engine
and provider tarballs and installed runtime dependency graphs. Stream's existing ZIP
opaque-attachment guard and regression remain intact, but this milestone does not
qualify the ASF advisory or claim all file-type risks resolved. Dependency upgrades
and advisory remediation remain follow-up security work; no unrelated automatic
`npm audit fix` or unverified version substitution was applied. Details are retained
in /tmp/wydgit-i54-audit.json. This is not a passing dependency-audit claim.

## Reliability and limits

No unexpected HTTP500 recurred in the successful baseline, final repository,
concurrently isolated five-library test files, provider or browser runs. This does
**not** diagnose or fix the prior held-request, Taskboard hostname, Contact/Guestbook
JSON/SQLite failures. Scheduling/resource contention and SEWN deadlines remain
unconfirmed hypotheses. No execution budget/deadline was increased, no security
assertion was disabled and normal full-suite isolation was retained. Preserve the
I5.3 observations as an open reliability risk for I5.5 investigation.

Only eight existing engine files differ beyond physical relocation: installed
metadata paths, Gate client lazy resolution, HTTP resource mapping, launcher package
identity, compiler signing-resource path and the trusted adapter comment. The rest
of the engine is moved unchanged. The App composition separates consumer cwd defaults
from installed runtime assets; root wrappers retain historical sample defaults.
All old engine modules are re-export shims and the same private authority graph is
used by installed trusted integrations. No duplicate SEAM implementation was added.

I5.5–I5.8 work remains as listed in README: process protocol/supervision, Linux and
race-safe staging qualification, provider migration/cutover recovery and final release
qualification. No tags, publishing, deployment, main merge or history rewrite occurred.

Resolve the completing commit without a self-referential SHA:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.4/verification.md
```

Delivery verifies local/remote SHA equality and a clean working tree after the
explicitly authorized commit and push.
