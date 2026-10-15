# H5 verification

Baseline: `e8af7577d5f4ff478081e593ab6fe04477a8c644`, branch `develop/0.3`.
Fetch confirmed local/remote equality and a clean starting tree. Implementation is
the H5 commit containing this report; resolve its exact SHA with
`git log -1 --format=%H -- docs/milestones/0.3-H5/verification.md`. The final delivery
also reports that SHA after commit/push, rather than embedding a self-referential hash.
No tag, release, merge, deployment or downstream/reference-project change is included.

## Versions and inherited evidence

| Axis | Before | After |
| --- | --- | --- |
| Wydgine / platform | 0.3.0-alpha.8 | unchanged |
| WydClient | 0.1.0-alpha.7 | 0.1.0-alpha.8 |
| WydSUB | 0.1 | unchanged |
| WBasic/component contracts | 0.20 | unchanged |
| Canonical service APIs | 1.0.0 | unchanged |
| Store / Gate implementations | 0.1.0-alpha.3 / alpha.4 | unchanged; stale READMEs corrected |

H4 reported 771 repository tests, 89 client tests, 19 Chrome fixtures and reproducible
alpha.7 artifacts. H5 independently reproduced **771/771** with ordinary default
process isolation before implementation, in **22532 ms**, and the pretest build
matched history-pinned alpha.7 bytes (Brotli 86636). H4's 89/19 counts remain inherited
baseline evidence; H5 browser acceptance below ran the new alpha.8 artifact.
H3/H4 serial/isolation/interrupted-run history remains unchanged in their reports.

Environment: Linux, Node **v24.21.0**, installed workspace/native dependencies,
Google Chrome **155.0.8059.79**. Complete Git history, local sockets, subprocesses,
native SQLite/Argon2 support and writable temporary directories are required.
Workspace-wide documented setup uses Node >=24.21 because WydFiles has that floor;
individual packages and the root server declare their own supported floors.
No claim is made about a fresh dependency download on another OS or architecture.

## Final matrix

| Verification | Command / evidence | Result |
| --- | --- | --- |
| Complete default regression suite | `npm test` (normal process isolation) | **772/772**, no failures/skips/cancellations; repeated after final documentation |
| Historical serial comparison | `npm test -- --test-isolation=none` | **772/772**, no failures/skips/cancellations, 71906 ms |
| Standalone client suite | `npm run test:client` | **90/90**, no failures/skips/cancellations |
| Actual Chrome compatibility/execution | `node packages/wydclient/browser-smoke.js` | **16/16**, newly built alpha.8 |
| Actual Chrome native controls | `node packages/wydclient/browser-controls.js` | **4/4**, newly built alpha.8; local/signed/embedded Taskboard and public quick start |
| Sample site content | `npm run check` | **3 complete pages, 42 internal links**, unique anchors |
| Builds / package reproducibility | Two repeated `npm run build:client` and public Taskboard CLI builds; SHA-256 comparison of readable/minified/versioned+current size reports and package/registry/integrity output | Exact byte/hash equality |
| Historical artifacts | `verifyArtifacts` and direct H4 Git-byte comparison | Alpha.1–alpha.7 untouched; history-unavailable/deletion/mutation negative tests retained |
| Package dry runs | `npm pack --workspaces --dry-run --json` | All **7** workspace packages, including non-production test-library; nothing published |
| Public authoring diagnostics | Fresh temporary Hello source/config, public CLI with CLIENT-forbidden `SESSION.id` | Rejects `WYDBASIC.TARGET`, `hello.bas`, line 5, column 22; temporary data removed |
| README source accuracy | Compare fenced WBasic example with `examples/hello-client/hello.bas` | Exact source equality |
| Documentation targets | Separate local target scan of root/current docs, H5 reports and workspace/example READMEs | No missing local file targets; external destinations and Markdown anchors not certified |
| Diff / version review | `git diff --check`, changed-file inventory, full source/doc diff, manifest/lock/runtime/build checks | Reviewed; only H5 changes and new versioned files |

The repository suite includes WBasic class/family/language and IR lowering,
canonical objects/interfaces/access, SEWN types/static libraries, SEAM,
WydStore/Search/Files/Stream/Gate, package installation/signing/recovery,
lifecycle/events/shared budgets, HTTP forms, Taskboard and Guestbook regressions.
The default suite is substantially faster here than serial execution; no runner
policy or assertion was weakened to obtain a pass.

## Failures investigated, not counted as passes

The initial restricted default attempt failed temporary Git/socket fixtures and
stalled at the renderer HTTP worker. Inspection found an older H3 worker with the
same fixture and baseline-log ownership. Both identified stale runs were stopped.
The fixture awaited only `listening`; a denied bind could never settle that promise.
Registering teardown first and using `events.once(server,'listening')` makes server
errors reject. The restricted renderer reproducer then exited **1** with explicit
**EPERM in 384 ms**, rather than hanging; this is expected failure evidence, not a
passing integration test. Unrestricted full suites exercised real HTTP successfully.
This explains that failure mode, not every historical interrupted run.

The new literal-data regression failed against the uncorrected profile and passed
after the narrow correction. During expansion to classic artifacts, the harness
initially supplied cross-realm JavaScript JSON objects; the actual bundle correctly
rejected them. The harness now constructs trusted configuration/arguments inside
the browser realm, as existing artifact conformance does. No runtime JSON gate was
relaxed. A restricted nested npm subprocess also failed EPERM during reproducibility
checking; the successful unrestricted check is the evidence reported above.

## Findings, remediation and coverage

[Review and inventory](review.md) records **3 Low**, **1 Documentation** and
**1 Informational** finding; no Critical, High or Medium issue was demonstrated.

- H5-01: fixed valid literal records being mistaken for server/service instructions.
  One added repository/client case runs source and both actual alpha.8 artifacts,
  while real Server/canonical service expressions still fail staging.
- H5-02: rebuilt the root README around current implemented behavior and a working
  author workflow; scoped installer deferrals and corrected current library versions,
  historical client headings, size pointer and superseded media statements.
- H5-03: authoring test temporary output now has teardown.
- H5-04: renderer socket errors now reject instead of leaving a fixture pending.
- H5-05: added public-CLI/native-Chrome quick-start evidence; expanded independent
  canonical conformance/control execution to retain alpha.7 alongside alpha.6/current.

Existing adversarial coverage remains: forged contexts/references/publisher claims,
private/protected/friend and hidden member restrictions, signature-only authority,
exact package/version approval, malformed controls/typed payloads, unsafe keys,
prototype pollution/injection, synthetic/forged/cloned/transplanted controls,
cross-root/App contexts, stale remount/key identities, awaited completion after
teardown, lifecycle failures, event recursion and shared budget exhaustion.
These are regression evidence, not an independent security audit.

## Browser and developer workflow

**20/20 total Chrome fixtures** load current alpha.8 bytes. The original 16 retain
bootstrap/signature/H1–H3/executable/root evidence. Four native fixtures cover:

1. Local generated CLIENT Taskboard: mouse navigation, typed custom event/state
   update, invalid input feedback, Enter submission, text/textarea/checkbox/select,
   mouse submission, draft retention/reset and Unload/reactivation.
2. Signed generated Taskboard: ephemeral Ed25519 key, SHA-256 verification,
   independent trusted-key and exact package/version host approval, same native flow.
3. Two roots: separate drafts/actions, survivor after sibling unmount, fresh remount,
   stale button rejection and complete form teardown.
4. Hello quick start: copy explicit WBasic/config files to a fresh temporary author
   directory, invoke `scripts/build-client-package.js` as a CLI, serve its actual
   generated registry, click a native button and observe compiled SEWN changing state.

The checked-in page/host/source/config are the documented public example. Test-host
URL adaptation only serves these files and generated artifacts; it does not implement
Greet or Taskboard actions. Existing workspace dependencies are reused for the build.
The runtime is static HTTP with no Wydgine/database. The README snippet exactly
matches the executed source. Unsupported CLIENT context diagnostics were separately
verified using that same CLI in a fresh directory.

Observed final Chrome timings were approximately **102 ms bootstrap / 19 ms navigation**
for the local Taskboard and **52 / 18 ms** signed. These include scheduling/CDP overhead
and are diagnostics, not performance guarantees. No Firefox/Safari/mobile or complete
screen-reader audit is claimed.

## Distribution

| Bytes | Alpha.7 | Alpha.8 | Change |
| --- | ---: | ---: | ---: |
| Readable | 505469 | 505495 | +26 |
| Minified | 312377 | 312395 | +18 |
| Gzip | 100323 | 100332 | +9 |
| Brotli | 86636 | 86775 | +139 |

The change is the literal-data scan correction; compressed-size movement reflects
compression of the whole artifact. No compiler, source IR lowerer, package builder,
server HTTP/storage infrastructure or UI framework was added to the browser closure.
Classic script / ES2022 and existing required browser crypto/API assumptions remain.
Build metafile guards and no-arbitrary-script tests remain enabled.

Two repeat builds compared hashes for both alpha.8 forms, both size metadata files
and all three generated Taskboard package files. The Git-history guard remains
fail-closed for shallow/missing history and protects all committed versioned outputs;
direct comparisons also checked alpha.1–alpha.7 against the H4 commit. Only the
unversioned `sizes.json` pointer moves. Package signing compatibility is unchanged;
no new package or WydSUB schema was invented for the correction.

## Remaining limits and readiness for I

The [inventory and parity table](review.md) distinguish shared contracts from intentional
runtime differences. No required H5 verification was skipped because of a missing
browser/service. External S3 deployment, broad cross-browser/accessibility behavior,
OS-level cancellation/power-loss behavior and independent hostile review remain
outside the evidence produced here. Current local fixtures do not certify those.

Same-realm browser hosts remain trusted. CLIENT has no general services/storage/network,
Server/Session or raw DOM facade; server native-control presentation is unsupported.
General upgrades/uninstall/registry, scheduled backup orchestration and multi-App
hosting remain unimplemented. Existing provider capacity/durability, package-principal
and source-diagnostic limits remain explicit in the review. No authority model changed.

H5 provides a verified baseline for **0.3-I Multi-App Hosting**, with single-App service,
session, package and resource isolation treated as requirements for its design.
Administration, CMS and independent audit/hardening remain J/K/L. This is internal
consolidation evidence, not production readiness or external security certification.
