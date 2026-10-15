# I5.3 verification

Starting branch **develop/0.3**, clean at requested baseline
**b6f9c33aa38544fc89c3f00cc2e2b7dceb7f4fcd**. Fetch from
`git@github.com:DivDevHQ/wydgit.git` confirmed HEAD/origin equality (0/0).
No subsequent commits were discarded. Read local agent/development/founding rules,
I4 architecture/customer/setup/filesystem/process/security/recovery/phase contracts,
I5.1/I5.2 implementation and verification, and existing inventory/controller/routing/
governance/operations/relocation/setup persistence code. No historical milestone
contract was rewritten. Implementation refinements from the proposed I4 schema are
listed in this milestone's README and registry contract.

Environment: Linux, Node **24.21.0**, npm **11.19.0**, Google Chrome
**155.0.8059.79**. Platform/private adapter version remains **0.3.0-alpha.12**;
WydClient remains **0.1.0-alpha.8**. The lockfile adds only the private provider workspace,
bin and exact development Wydgine dependency. No external dependency was added.
An offline, scripts-disabled workspace install created two missing local workspace
links; subsequent `npm ls --depth=0` passed with WydHosting → Wydgine deduped.

## Executed gates

| Command / check | Result |
| --- | --- |
| Baseline `npm test`, normal isolation | **853/853**, no failures/skips/cancellations; 26535 ms |
| Full `npm test`, normal isolation, after implementation/docs | **888/888**, no failures/skips/cancellations; 31535 ms |
| Provider `node --test packages/wydhosting/test/provider.test.js` | **35/35**, including actual process interruption, linked CLI and real canonical Apps |
| Focused provider/launcher/boundary/multi-App/routing/governance/operations regression gate | **113/113**, normal isolation; initial final-code gate 9115 ms |
| Temporary diagnostic full suite, normal isolation | **887/887** before final additional recovery test; 30483 ms |
| `npm run test:client` | **90/90**, no failures/skips/cancellations |
| `node packages/wydclient/browser-smoke.js` | **16/16** actual Chrome cases |
| `node packages/wydclient/browser-controls.js` | **4/4** actual Chrome fixtures |
| `node scripts/verify-hostname-browser.js` | **5/5** actual Chrome TLS/proxy/origin/cookie/parking/local HTTP fixtures |
| `node scripts/verify-i4-architecture.js` | **4** architecture validation groups |
| `npm pack --workspaces --dry-run --json` | **9/9** workspace packages; no publication or independent installation claim |
| Actual local workspace `node_modules/.bin/wydhosting` commands | **5/5** inspect/validate/plan/apply/reconcile in a disposable private fixture |
| `npm run check` | **3** complete pages, **42** internal links, unique anchors |
| `git diff --check` | Passed |
| WydClient baseline Git blob byte comparison | **23/23** tracked artifacts identical |

The final suite contains **888 tests**, including 35 provider tests. The completing
required rerun after final review is recorded in the final handoff. Required checks,
focused provider/engine regressions and artifact comparison are rerun after final
edits. Counts above represent executed checks, not skipped OS qualification gates.
Logs are `/tmp/i53-*`; they are disposable diagnostic evidence, not shipped artifacts.
Sockets, Git subprocesses and Chrome use the authorized environment. Default test
isolation, assertions and security timeouts remain unchanged.

Focused command:

```sh
node --test test/launcher.test.js test/engine-boundary.test.js test/multi-app.test.js test/hostname-routing.test.js test/hostname-host.test.js test/tenant-governance.test.js test/governance.test.js test/hosting-operations.test.js packages/wydhosting/test/provider.test.js
```

## Provider evidence

35 tests cover free unrelated customers, paid multiple Apps, higher-tier separate-App
pools, multiple domains, entitlement changes and qualified transition plans. They reject
identity/case/root/account/domain collisions, unsupported revisions/fields/claims,
foreign customer substitutions, free privilege claims and multiple Apps, pool overflow
including parking, provider-wide namespace overlap, source/root traversal and links,
forged/rehashed plans, unauthorized actors, expired/stale/replayed operations and unsafe
state permissions. Retired identities/domains/roots/namespaces remain reserved.

Real canonical five-library Apps pass the original inventory validator and activate
through the existing controller for actual Store calls and foreign-context refusal.
Compilation preserves relative pool confinement, exact IDs, approved domain routes and
finite reductions. Tests reject foreign service ownership, wrong canonical identity,
snapshot/content drift, symlink/hardlink redirection, package recovery markers and
unreserved actual remote configuration. No S3 network or OS enforcement is simulated
as a successful deployment. Existing I0–I3 tests retain installed WBasic Taskboards,
Gate/Store/Files/Stream/Search, raw hostname/origin/proxy/parking controls, admission,
shutdown/retirement and stopped local relocation. Existing I5.1/I5.2 tests retain
standalone startup, actual npm/root legacy start, setup, terminal/signal and service
boundary evidence. Wydgine/App/launcher implementation files remain unchanged.

Byte-exact trees before/after inspect/validate/plan prove no persistent side effects.
Tests cover authorized registry-only commit, stable duplicate results, conflicting IDs,
writer concurrency, malformed/missing/ambiguous journal state, post-commit verification
failure and lost acknowledgements. A real subprocess exits immediately after the synced
prepared envelope: its old registry and stale writer lock survive; apply refuses until
the test operator observes process exit and explicitly removes only that stale lock.
Fresh authorization can finish the exact prepared plan, including after initial plan
expiry. A prepared operation cannot be hidden by reconciling an older successful one.
No account or runtime action is marked completed by any test.

## Intermediate failures and open reliability observations

- Initial restricted baseline and provider test invocations had sandbox integration
  failures; they are not counted as passing checks. Authorized baseline passed 853/853.
- Initial provider suite **22/23**: the test's byte snapshot tried to read the real
  fixture's approved node_modules directory symlink as a file. Corrected the test
  to snapshot link text without following it; **23/23**, then **31/31**, **34/34**,
  finally **35/35** as meaningful cases were added. No engine restriction was weakened.
- Actual workspace-bin smoke initially exited without JSON: the main-module guard
  compared an unresolved bin symlink to the real module path. Resolve the invoked
  entrypoint before comparing; add a subprocess symlink regression. All five actual
  workspace-bin commands then passed.
- The first concurrent full/focused verification attempt reproduced existing HTTP500
  observations. Focused: **111/112**, installed Taskboard initial hostname GET returned
  500 at `test/hostname-host.test.js:47`. Full: **885/887**, concurrent Contact POSTs
  returned 500 for both JSON and SQLite at `test/hardening.test.js:46–48`. Running
  both suites concurrently added workload; it does not establish causation.
- The failed hardening child retained a TCP listener after its assertion failures.
  A temporary local inspector collected active handles: three pipe handles and one
  TCP server, no active HTTP socket. Only that disposable child was then terminated
  to let the runner finish reporting. No unrelated process was stopped.
- Investigation followed Page response/error handling, shared dispatch, the 1000 ms
  SEWN execution ledger, service calls and test cleanup. A temporary `/tmp` Node load
  hook logged sanitized Page error codes/deadlines/charges **without editing repository
  runtime**. Targeted hostname/hardening run passed **13/13**; normal-isolation full
  diagnostic run passed **887/887**. Unexpected original errors did not recur with
  diagnostics, so their exact internal code/root cause is still **unconfirmed**.
  Deliberately invalid cases emitted expected security/budget codes. The scheduling/
  deadline hypothesis remains a hypothesis. No timeout, assertion, normal isolation
  setting or existing runtime implementation was changed to make tests pass.

The earlier held-request shutdown HTTP500 observation also remains open; neither
successful reruns nor this provider milestone constitute a reliability fix. Retain
these observations for further diagnostic recurrence rather than declaring them solved.

## Review and limits

Full diff, dependency direction, status/stat, whitespace and baseline browser bytes are
reviewed before the authorized commit/push. No alternate execution validator, grant
mechanism, browser API, management HTTP service, published package, engine extraction,
OS account creation, live migration, worker/firewall/systemd/proxy/cgroup operation or
production-ready result is introduced. Private JSON/plan digests are integrity checks,
not cryptographic operator authentication. Root checks assume trusted OS ownership;
race-safe staging, cross-UID denial and storage power-loss qualification remain absent.
The embedded full-plan journal is intentionally small and fails when byte/count limits
are reached; no silent compaction or corruption repair exists.

Recommended I5.4 sequence: expose the existing trusted helper surface, extract the
single coherent engine/metadata/runtime-asset closure with identity-preserving shims,
verify isolated service-free and five-library tarball consumers without WydHosting,
then replace provider repository imports and verify its exact dependency closure.
I5.5–I5.8 retain supervision, Linux qualification, migration and release decisions.

Resolve the completing commit without a self-referential SHA:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.3/verification.md
```

Delivery confirms local/remote SHA equality and a clean working tree. No tag,
publication, deployment, main merge or history rewrite is part of this work.
