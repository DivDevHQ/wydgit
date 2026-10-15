# I5.1 verification

Starting SHA **7df135082197b9dfbcdc42efc06127990f527834**, branch
`develop/0.3`, clean tree; authorized `git fetch origin develop/0.3` confirmed
origin equality. No later commits were discarded. The final commit containing this
report is resolved without a self-referential hash:

```sh
git log -1 --format=%H -- docs/milestones/0.3-I5.1/verification.md
```

Commit/push SHA equality and clean-tree status are checked at delivery. No tag,
publication, release, deployment or main-branch change is part of this phase.

## Environment and dependencies

Linux, Node **v24.21.0**, npm **11.19.0**, Google Chrome **155.0.8059.79**.
`npm ls --depth=0` exited 0 with all seven workspace links and expected native/
external packages installed; no missing/invalid dependencies reported. Installed
versions are recorded in the [dependency audit](dependency-audit.md). Root manifest,
lockfile and platform **0.3.0-alpha.12** are unchanged; WydClient **alpha.8** and
WydSUB **0.1** unchanged. No dependency installation/update was performed.

Read AGENTS, development/founding rules, all ten I4 documents and I0–I3 contracts/
verification, then reviewed their actual implementations and security fixtures.
Baseline checks preceded structural edits. Tests needing sockets, Git-history writes
in disposable repositories, subprocesses or npm cache used the authorized unrestricted
environment. Test output is retained in `/tmp/i51-*` logs, not committed artifacts.

## Executed gates

| Command / check | Result |
| --- | --- |
| Baseline `npm test` (default isolation, socket-enabled) | **832/832**, no failures/skips/cancellations; 24135 ms |
| Post-refactor `npm test` (default isolation) | **836/836**, no failures/skips/cancellations; 24595 ms |
| `node --test test/engine-boundary.test.js test/multi-app.test.js test/hosting-operations.test.js` | **32/32**, no failures/skips/cancellations after fixture corrections |
| `npm run test:client` | **90/90**, reproducible browser build and historical integrity checks |
| `node packages/wydclient/browser-smoke.js` | **16/16** actual Chrome cases |
| `node packages/wydclient/browser-controls.js` | **4/4** actual Chrome fixtures, controls/signing/embedded/public CLI |
| `node scripts/verify-hostname-browser.js` | **5/5** actual Chrome HTTPS/proxy/origin/cookie/parking/local HTTP fixtures |
| `node scripts/verify-i4-architecture.js` | **4 validation groups passed**, including offline mock-bin npm mechanics |
| `npm pack --workspaces --dry-run --json` | **7/7** existing packages, no publication |
| `npm run check` | **3 pages, 42 internal links**, unique anchors |
| `git diff --check` | Passed |
| All tracked `packages/wydclient/dist` compared byte-for-byte with starting I4 | **23/23 identical**, including historical distributions and current sizes pointer |
| Extracted validator/helpers compared with I4 source | Identical after export/name normalization; no validation-body change |

Full suite includes existing native HTTP/transport/server signal tests, canonical
JSON/SQLite providers, package installation/recovery and I0–I3 regression checks.
Required repository tests and content checks are rerun after final documentation
edits; final handoff reports that final run. Browser checks use ephemeral local test
certificates, not public CA/domain verification. Dry-run JSON is `/tmp/i51-pack.json`.

## Real examples and focused evidence

`node examples/multi-app/run.js` started both canonical listeners and exited 0 on
SIGTERM. `node examples/hostname-host/run.js` started five routed hostnames, served
native HTTP 200 for alpha.localhost and exited 0 on SIGTERM. These are persistent
examples; their listeners were explicitly shut down, not left running.
`node examples/hostname-host/governance.js` exited 0 after real admission/quota,
sibling survival, independent stop, stale-token rejection and disposal assertions.
`node examples/hosting-operations/relocate.js` exited 0 with installed WBasic execution
under newly approved destination routing. Existing operational CLI integration also
runs SIGTERM/restart without reinstalling.

Four new boundary tests prove direct adapter/function identity and object-model/SEAM
constructor identity; selected-root standalone canonical HTTP, approved five-library
startup, actual Store calls, byte-exact served upload runtime asset, frozen branded
contexts and retirement; validator compatibility/frozen result parity, 17-App rejection,
nested-root/hardlink/catalog refusal; recursive local ESM closures excluding controller/
operations/provider orchestration for standalone, relocation and inventory.
Existing multi-App/operations fixtures now use trusted facade imports, exercising
all previous assertions rather than duplicating the historical suites. They retain
real independently installed Taskboards, resource/session identities, borrowed/copied/
foreign/retired tokens/contexts, new-controller nonrevival, I1 parking/routing,
I2 admission/governance and I3 readiness/shutdown/relocation. Other historical suites
and I4 fixture still use the compatibility paths.

## Intermediate failures and reliability observations

- Restricted `git fetch` failed because `.git/FETCH_HEAD` is read-only. Authorized
  fetch succeeded. Initial restricted `npm test` failed at file level: **65/88**
  passed, **23 failed**, no skips/cancellations. That restricted environment cannot
  provide the suite's normal socket/Git fixture facilities; its coarse file reporter
  does not diagnose every underlying failure. It is not counted as a passing baseline.
- First focused run: **31/32**. The new dependency guard incorrectly classified
  `wydgine/sewn/operations.js` as hosting operations. Restricted the assertion to
  `wydgine/operations.js`; no runtime change.
- Second focused run: **31/32**. The new asset test wrongly expected an import in
  the classic upload script. It now compares actual served bytes to source instead.
  Third focused run: **32/32**. These were fixture mistakes, not runtime failures.
- An exploratory `node examples/multi-app/demo.js` failed MODULE_NOT_FOUND; the actual
  documented executable is `run.js`, which was subsequently started and shut down.

The historical held-request shared-host shutdown HTTP500 and concurrent JSON
Guestbook/Contact HTTP500 did **not recur** in the successful baseline or post-refactor
full runs. Their root causes remain unestablished; success here is not a reliability
fix. No timeout increase, assertion removal, isolation change or speculative lifecycle/
provider fix was made. If either recurs, retain the complete failure and investigate
its actual scheduling/lifetime/provider path before claiming resolution.

## Review and limitations

Source review confirms one validator, one original SEAM runtime graph, no new
relocation/controller cycle, exact compatibility export identity and no WydHosting
import in the engine. Runtime diff is validation extraction plus direct adapter exports;
no schema, transport, ownership, service policy, startup or browser behavior change.
Current README/navigation and changelog describe this work; historical reports remain
untouched. Full diff/status/stat are reviewed before the authorized commit/push.

This is ready groundwork for **I5.2: Standalone App Selection and Setup**. It is not
an independently installable engine tarball: root metadata/assets, Gate's static
client import, native/service packages and cross-source dependencies still require
I5.4 work. No supervisor, worker IPC, setup wizard, Linux broker, isolation certification,
provider migration journal or production-readiness claim is added. Existing hostile-OS
filesystem races, shared-process scheduling/native contention and stopped local-only
relocation limits remain. No second runtime or new grant system.
