# Package lifecycle verification — 2026-10-18

The entries below retain the **initial catalog-foundation evidence**. The later
[continuation qualification record](qualification-2026-10-18.md) supersedes its
implementation-status statements and records the checkpointed storage follow-up.

Implementation commit: `cbaad61` (`feat(packages): add recoverable local catalog
lifecycle`). Node **v24.21.0**. Tests use temporary local fixtures; no production
site/data, privileged system operation, VM, deployment, tag, release or push.

## Continuation handoff

Local commits `eb98ff3` and `e9769ec` add the bounded checkpointed contracts.
Completed final checks: **1,086/1,086** root, **176/176** focused,
**6/6** controlled HTTP probes; all have zero failed/cancelled/skipped cases.
Content validation passed for 3 Pages, 42 links and unique anchors; whitespace
checks passed. Exact commands, corrected failures, guarantees, retained checkpoint
semantics and remaining production blockers are in the continuation record above.
No version, immutable artifact, hosting deferral or deployment change occurred.

## Initial foundation executed checks

| Command | Recorded result |
| --- | --- |
| `npm test` after the first implementation | 991/991 pass; zero failed/cancelled/skipped |
| `npm test` after I/O failure and race coverage | 1000/1000 pass; zero failed/cancelled/skipped |
| `npm test` on committed implementation `cbaad61` | 1001/1001 pass; zero failed/cancelled/skipped; new alpha.9 artifacts reproduced under the immutable guard |
| `npm test` after documentation/shared-dependency race commit `52b54c9` | 1002/1002 pass; zero failed/cancelled/skipped |
| `node --test --test-isolation=none test/packages.test.js test/package-lifecycle.test.js test/package-infrastructure.test.js test/sewn-shared-budget.test.js` | 91/91 pass after the shared-dependency race and standard semver prerelease exclusion regressions; zero failed/cancelled/skipped |
| `node --test --test-isolation=none test/sewn-shared-budget.test.js test/package-lifecycle.test.js test/hardening.test.js test/hostname-host.test.js` | 59/59 pass at the earlier 40-case lifecycle stage; ordinary-user HTTP listeners |
| `node --test --test-isolation=none test-support/http-budget-probe.mjs` | 6/6 pass; unchanged Page deadlines, precommit cancellation, submitted-commit uncertainty and sibling survival |
| `npm run check` | Pass: 3 complete Pages, 42 internal links, unique anchors |
| `git diff --check` | Pass |

The final handoff records the required full-suite confirmation after the last
semver regression and documentation edits. The counts above are actual
completed runs, not predicted results. Focused no-isolation commands provide exact
case counts; authoritative root `npm test` retains the repository's normal process
isolation and concurrency. No test budget, assertion or concurrency setting was
relaxed to pass the root suite.

## Coverage and its limits

The final focused group includes **58 lifecycle cases**, the 14 existing package
cases, 14 infrastructure cases and 5 shared-budget cases. It covers:

- Approved dependency-first install, repeated installs/promotions, direct/shared/
  transitive dependencies, reverse version constraints, duplicate/namespace/cycle
  failures, protected/explicit retention, dependency additions/removals and orphan
  chains. Both new/legacy installer paths validate graph integrity.
- Update and explicit incompatible upgrade (including 0.x), rejected downgrades,
  configuration preservation, unchanged footprint requirements, same-version
  artifact integrity and explicit unsupported schema-migration refusal.
- Retained uninstall/reinstall, site additions, navigation/config preservation,
  narrowly authorized catalog purge, physical-purge refusal and foreign package
  subtree protection. Guestbook persists real content through JSON and
  SQLite adapter reopening and verifies unchanged approved authority.
- Nine real SIGKILL boundaries: install/update/uninstall at PLANNED, APPLYING and
  PUBLISHED. Recovery determines the exact old/new publication boundary, blocks
  live writers and safely allows fresh retries when nothing committed.
- Handled install/update/removal failures, failed operation-record writes,
  postpublication finalization failure, failed temporary cleanup, busy/stale plans,
  shared dependency install/uninstall races, upgrade/uninstall races, cancellation,
  zero budgets, shared parent charges and forged receipt/retained metadata.
- Deterministic pure graph removal trials: seeds `1`, `17`, `3003`, `0xdeadbeef`,
  100 DAGs of 20 nodes each, randomized edges/reasons/protection and removal order;
  installation-order invariants are checked. Two actual installed-DAG sequences
  use seeds `7` and `109`. Randomized migration/upgrade generation is not claimed.

The representative Guestbook scenario exercises install/configure/content/update/
major-upgrade/uninstall-retain/reinstall on both adapters, ending in a **safe physical
purge refusal**. It does not satisfy the commissioned end-to-end physical-purge or
schema-migration acceptance criteria. Pure catalog snapshots have a separate tested
explicit purge. Process-kill tests are not power-loss or network-filesystem tests.

## Investigated failures and retained limitations

The initial root pretest correctly refused rebuilding the frozen alpha.8 bundle
after shared ledger changes. No historical artifact was overwritten. WydClient,
runtime/authoring metadata, lockfile, examples and new distribution/size files were
advanced together to **0.1.0-alpha.9**; subsequent root builds and immutable artifact
tests passed. Wydgine/platform/WydHosting remain **0.3.0-alpha.15**, WydSUB **0.1**.

A sandbox HTTP/security run reported **48 pass / 11 fail out of 59**, with local
listener `EPERM`/`HOST.LISTEN` denials. Running the same command as the ordinary user
passed 59/59. This is separate from historical SEWN deadline exhaustion. Development
iterations also caught canonical-envelope serialization, Page reuse, explicit-reason
preservation and legacy error-contract mismatches; corrections and regressions are
included. Transient test assertion/syntax mistakes were corrected before the passing
focused runs; no unresolved test failure was discarded or disabled. Final policy review also removed an overly permissive
prerelease override; dependency resolution and update classification now preserve
standard semver exclusions, with explicit-prerelease acceptance/refusal coverage.

The historical Contact/drain failure did not recur in the recorded successful root
runs. Trusted meters now distinguish the first terminal resource, and implicated
assertions capture bounded sanitized meter snapshots. Passing runs and controlled
waits still do not attribute the intermittent full-suite delays. The
[reliability issue](../0.3-reliability.md) stays open; no limits were increased.

Raw logs were written to `/tmp/package-lifecycle-full.log`,
`/tmp/package-lifecycle-full-final.log`, `/tmp/package-lifecycle-committed.log`, `/tmp/package-lifecycle-handoff.log`,
`/tmp/package-focused-prerelease.log`,
`/tmp/package-focused.log`, `/tmp/package-security.log`,
`/tmp/package-security-host.log` and `/tmp/package-budget-probe.log` during this
session. Temporary paths are not a durable retention guarantee; this record retains
the commands, results, scope and unresolved gates.

## Release recommendation

**Do not mark the commissioned milestone production complete.** The conservative
catalog subset has regression evidence. Schema/data migration/checkpoint contracts,
physical data purge, provisioning crash/failed-compensation recovery, incompatible
instance migration and committed-upgrade rollback remain unqualified or unsupported.
The historical HTTP reliability issue remains a release blocker. J can do independent
administration design, but production lifecycle UX/claims must wait for these gates.
Decision 0003's managed hosting deferral and all six 0.4 security obligations remain
unchanged.
