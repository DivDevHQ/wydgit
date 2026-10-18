# I4 — Wydgine / WydHosting architecture

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

Status: design and executable validation, **not a hosting implementation**. Baseline
I3 `b55d214ebe14ee27bc255e60ac2f4c8f9f168368`; inspected HEAD
`583a43e24378cc6a844c91e49923db78313924d6` preserves the subsequent platform vision.
Platform remains **0.3.0-alpha.12**, WydClient **0.1.0-alpha.8**, WydSUB **0.1**.
No runtime, dependency, schema or distribution version bump is warranted.

**Wydgine runs applications. WydHosting operates hosting infrastructure.**

## Established decisions

- Wydgine is a portable Node engine, independently installable, with one selected App
  per ordinary CLI invocation. WydHosting is an optional Linux-first provider package.
  Dependencies point from WydHosting to Wydgine, never back.
- Keep I0's trusted controller, I1 raw-request routing and I2 governance in Wydgine.
  These enforce execution ownership even inside a shared worker. Wrap before extracting.
- WydHosting owns placement, customer/plan records, worker supervision, provider-wide
  resource policy, domain assignment, provisioning and migration coordination.
- Free pools share a bounded process and logical App boundaries. Paid customers get
  separate restricted Linux identities and processes; higher tiers can separate sites.
  No same-process OS isolation claim. Initial controller ceiling stays sixteen total
  Apps, including parking; 20–50 low-activity Apps is an unqualified benchmark hypothesis.
- Managed deployments use approved immutable source snapshots, separate mutable
  service state, a trusted registry and private listeners. Convenience links confer
  no authority; existing symlink/hardlink rejection remains.
- One setup engine validates plans for CLI and future administration interfaces.
  Root is limited to narrow provisioning, never the persistent supervisor or workers.

## Actual repository and evidence

I0–I3 already validate inventories, canonical App/service ownership, package catalogs
and recovery markers; issue process-local contexts/tokens; route exact approved
hostnames before HTTP adaptation; meter admission/output; drain/retire Apps; expose
host-only readiness/capacity and snapshot/restore stopped local JSON Apps.
`server.js` still starts the repository sample; it ignores positional App arguments.
The private root package is `wydgit`, with no `wydgine`/`wydhosting` package or bin.
No process supervisor, Linux accounts/cgroups, native setup, public management API,
automated domain verification, commercial provisioning or general migration exists.

[Verification](verification.md) records reproducible checks. The new disposable
script proves explicit-root standalone HTTP initialization without a controller,
current path/size rejection and npm mechanics using a mock local executable. Existing
integration tests provide the real five-library, installed-package, routing and
retirement evidence. No OS isolation benchmark or production provisioning was run.

## Documents and implementation handoff

| Document | Decision scope |
| --- | --- |
| [Dependency map](dependency-map.md) | Actual imports, ownership and executable graph |
| [Customer/pool model](customer-pool-model.md) | Identities, tier guarantees and lifecycle |
| [Process isolation](process-isolation.md) | Worker protocol, fencing, limits and failure tests |
| [Filesystem security](filesystem-security.md) | Registry, snapshots, ownership and race defenses |
| [Host security](host-security.md) | Distribution gates, privilege and firewall contracts |
| [Migration/recovery](migration-recovery.md) | Stopped transfer, cutover and provider qualification |
| [Setup/administration](setup-administration.md) | Standalone UX, npm scripts and shared setup engine |
| [I5 plan](I5-plan.md) | Ordered file/package changes and release gates |
| [Verification](verification.md) | Commands, observed results and untested areas |

Provisional decisions: package names require registry/ownership verification before
publication; density requires workload measurements; exact distro releases require VM
qualification; private Unix-socket HTTP needs routing peer support; each provider
migration profile needs independent durability tests. These are explicit I5 gates,
not reasons to weaken current execution invariants.

## Forward compatibility and scope

The [long-term vision](../../roadmap/long-term-platform-vision.md) is strategic.
Its snapshot says I3 was commissioned; actual I3 is now implemented, narrowly as
stopped local JSON relocation. Its installable packages, setup, pools, native installers,
OS drivers and administration are still proposals. This milestone resolves package
ownership and protocols without treating those proposals as delivered functionality.

Almond Linux Server can bundle Wydgine, WydHosting, tested OS policy, systemd,
firewall/proxy integration and a Wydgit administration App as an optional reference
installation using the same public contracts. It is not a dependency or an already
certified distribution. WydOS is a future independent optional SEAM-governed library:
`App → Wydgine/SEAM → WydOS → OS driver`. WydOS/Almond may reuse Alma/RHEL facilities
only after qualification. Almond Milk is a future edge desktop distribution running
local Apps with explicitly approved OS capabilities. Neither Wydgine nor WydHosting
needs these initiatives to operate.

I5 implements the incremental plan; I6 may qualify remaining integration if needed.
J supplies authorized platform/App administration over the trusted contracts; K builds
an installable CMS; L handles integration, independent audit, hardening and prerelease.
WydOS, Almond packaging, desktop runtime, native panel integrations and billing remain
independent future work. No full administration GUI or hosting supervisor is added here.
