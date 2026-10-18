# Wydgit — Long-Term Platform Vision

**Status:** Strategic planning document; not an implementation specification or a claim of existing functionality
**Recorded:** 15 October 2026
**Scope:** Wydgine, WydHosting, WydOS, Almond Linux Server, Almond Milk, deployment, administration, packaging, and business model

> **Guiding idea:** One portable Wydgit application model, deployed as a standalone Node application, on a managed hosting platform, or as an OS-integrated local application. Optional infrastructure must never become a mandatory dependency of the core engine.

## 1. Foundational separation

| Component               | Primary responsibility                                       | Dependency principle                                         |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Wydgine**             | Cross-platform Node.js engine for executing Wydgit applications | Operates independently of WydHosting and WydOS               |
| **WydHosting**          | Linux-first hosting-provider controller for multiple Wydgine instances and shared App pools | Depends on Wydgine; does not change App format               |
| **WydOS**               | Optional, portable SEAM-mediated interface to OS capabilities | Plugs into Wydgine through trusted service contracts         |
| **WydOS/Almond**        | Initial Linux OS-specific driver implementing WydOS capabilities | Almond Linux reference driver; broader Linux compatibility possible |
| **Almond Linux Server** | Turnkey WydHosting reference deployment                      | Uses the same public WydHosting/Wydgine artifacts as other installations |
| **Almond Milk**         | Edge-ready, lightweight ChromeOS alternative with local Wydgine and OS integration | Reuses Wydgit Apps and WydOS rather than bundling engines per App |
| **DivDev Studio**       | Future visual development and administration tooling         | Uses published interfaces rather than bypassing platform boundaries |

**Do not conflate these:** Wydgine is not itself a hosting-provider control panel; WydHosting is not required to self-host; WydOS is a library, **not the name of the OS**; Almond is both the Linux distribution family and the initial WydOS driver identity.

## 2. Wydgine: standalone single-App-by-default execution

A developer installs Wydgine anywhere Node.js and its required dependencies are supported. The ordinary entry point runs **one selected App** per Node.js process. A developer with three sites can run three independent instances without WydHosting:

```
npm start -- apps/brained.com
npm start -- apps/libundance.com
npm start -- apps/m3project.com
```

Each instance receives its own listener/port or Unix socket, lifecycle, and process environment. A hosting provider's existing reverse proxy/process manager may handle external domains and persistence. Note: simultaneous foreground commands require separate terminals or a process manager.

**App selection:** Allow an explicit CLI App root, a configured default, or—when invoked interactively without a selection—an App selection wizard. Headless instances with no configured App may offer a restricted setup experience, but never expose anonymous public App selection or filesystem discovery. Invalid explicit selection must fail closed. Ordinary `npm start` should retain its historical behavior until a deliberate, backward-compatible launcher migration is implemented.

**Site data shape** (illustrative target):

```
apps/
  brained.com/
    wydgit.config.json
    content/
    prototypes/
    public/
  libundance.com/
  m3project.com/
```

Names of directories are not authoritative App identities or grants; validate every selected canonical App root. Existing Wydgine multi-App work (0.3-I0 through I3) is valuable and should be reused behind a suitable host interface, not discarded. The **public self-hosting experience** can remain single-App-by-default even if internal multi-App execution supports WydHosting shared pools.

## 3. WydHosting: optional hosting-provider infrastructure

WydHosting is a **separately distributed, Linux-first library/service** for providers operating customer websites. It supervises Wydgine workers, manages domain-to-App placement, quotas, deployment and migration, and eventually provider administration. Wydgine never imports or requires WydHosting.

### 3.1 Tenant and allocation hierarchy

```
Hosting provider
  └── Customer/account
       └── Subscription/tier
            └── App pool(s) / worker placement
                 └── Wydgit App(s)
```

Customer, Linux user, pool, App, and WydGate identities remain independent. App permissions and SEAM scopes never expand implicitly because multiple Apps share a customer or worker.

| Default tier          | Sites                           | Linux ownership                                           | Worker/App pool arrangement                                  | Isolation expectation                                        |
| --------------------- | ------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Free**              | One App per customer            | No dedicated Unix user required; provider-managed storage | Multiple free customers share a restricted pool              | Logical App isolation + bounded resource policy; shared OS process risk disclosed |
| **Paid**              | Multiple Apps allowed by plan   | One Linux user per customer                               | One dedicated App pool per paying customer, serving their Apps | Process separation between customers; App-level separation within customer pool |
| **Higher paid tiers** | Multiple Apps according to plan | Dedicated customer Linux identity                         | Optional dedicated pool/process per site                     | Stronger site-level isolation and reserved capacity          |

An **App pool** is a supervised Wydgine process or explicitly defined process group, not a promise that one Node worker thread supplies a robust tenant sandbox. Prefer OS processes for customer fault containment; worker threads may be useful for trusted internal workloads but are not an adequate replacement for OS-enforced isolation.

The earlier idea of **20–50 free sites per pool is a benchmark hypothesis**, not a fixed capacity target or a change to existing controller limits. Benchmark memory, startup time, active workloads, I/O, request concurrency, contention and recovery before setting or raising limits. Existing I0 inventory capacity is 16 Apps per controller until deliberately revised.

### 3.2 Filesystem ownership and registration

Illustrative configuration:

```
/home/wydhosting/wydhosting/      # Optional provider install layout
/home/user1/brained.com/
/home/user1/libundance.com/
/home/user2/example.com/
/var/lib/wydhosting/pools/        # Candidate storage for shared free-tier deployments
```

One Linux user per **paying customer**, not necessarily one per website. The proposed convenience symlink structure (for example, `.../wydhosting/apps/brained.com -> /home/user1/brained.com`) is permissible only as a display/discovery convenience, **not proof of identity or a trusted security boundary**. The existing I0 App root validator rejects symlinked roots and requires canonical confinement; do not weaken this validation merely to support convenience links. A privileged provider registry should resolve and explicitly authorize canonical App roots, ownership, package state and resource access. Shared free-tier workers should use approved, staged/immutable App deployments, not unbounded access to customers' writable home directories.

### 3.3 Promotion and relocation

Upgrading a free App to paid should be a managed migration:

1. Provision a restricted customer Linux account, home directory and dedicated pool.
2. Stage and integrity-check the App package, content and persistent service state.
3. Apply customer ownership, private storage mappings, grants and resource profiles.
4. Quiesce mutations or otherwise ensure consistent cutover; transfer final state.
5. Atomically switch approved routing where possible, verify health, then retire the old deployment.
6. Preserve a recoverable source/rollback path; never duplicate live App authority or secrets.

App code and Wydgit package structure should remain portable across tiers. Migration is **not** automatically live/zero-downtime until proven and tested. Avoid conflating App migration with distributed databases or high-availability replication.

### 3.4 Hosting-controller responsibilities

Provider inventory and placement; shared/dedicated worker process spawning; crash detection and bounded restart; route/proxy coordination; tenant-aware quota assignment; provider-wide monitoring; secure account provisioning; lifecycle coordination; backup/recovery and migrations. Keep enforcement of individual App capabilities, requests, canonical services and SEAM in the correct Wydgine-side boundaries.

## 4. Installer, setup, and distribution experience

### 4.1 Wydgine: developer/self-hosting

```
mkdir -p [path]/wydgine
cd [path]/wydgine
npm install wydgine
npx wydgine setup
```

The CLI wizard configures application location/selection, listener, dependencies and safe deployment defaults. It may generate a local `package.json` with `npm start` and other development scripts. The package's executable is exposed via npm `bin`; **`npm run setup` will not automatically invoke scripts belonging to installed dependencies**. Use `setup` rather than npm's reserved `install` lifecycle script.

### 4.2 WydHosting: operator/provider

```
mkdir -p [path]/wydhosting
cd [path]/wydhosting
npm install wydhosting
npx wydhosting setup
```

A WydHosting setup wizard configures provider directories, worker accounts/pools, domains, reverse proxy, resource policies, firewalls, management access, logging and service supervision. Production setup **requires authorized administrative/sudo access** under the intended Linux support policy. Normal workers and the persistent supervisor must not run as root.

Where administrative privileges are unavailable, recommend standalone Wydgine and separate Node process per website, managed by the existing provider/process manager. Installing WydHosting must **not** silently change how `npm start` launches Wydgine; hosting startup is explicit (e.g. `npm run start:hosting`, or the package's native executable). All commands and layouts are **future target UX**, not guaranteed currently published packages.

### 4.3 One provisioning engine, several front ends

CLI wizard, local-only web setup UI, future DivDev Studio experience, cPanel/WHM plugin, Plesk extension, Webmin/Virtualmin module, Linux shell bootstrapper and native packages should call **common validated setup/configuration operations** rather than implement their own incompatible logic. OS-privileged operations require narrow trusted brokers/commands and explicit authorization. A browser setup wizard must not let anonymous public visitors enumerate Apps or choose server behavior.

### 4.4 Distribution strategy

- **Wydgine:** npm-first, cross-platform where Node and dependencies run; OS packages optional later.
- **WydHosting:** npm library and executable; initially an independently reviewable, version-pinned Linux shell bootstrapper invoking npm and the common setup engine; eventually our own signed APT/RPM repository and possibly distribution-maintained packages.
- **Almond Linux Server:** ships with tested Wydgine/WydHosting components already integrated as the **reference installation**, using the same public packages, not hidden privileged forks.

Example conceptual bootstrap flow: download installer, verify source/signature or pinned digest, review, and run with appropriate elevation. **Never present a speculative download URL as live.** Make Node version resolution explicit and pin releases so upgrades cannot unexpectedly change production infrastructure.

## 5. WydHosting Linux security baseline

Initial official target: select, tested Linux distributions (candidate shortlist: Ubuntu Server LTS and Debian Stable; Alma/RHEL family is another future candidate). Support claims require an actual test matrix; unsupported platforms may have community ports and documentation without claims of equivalent isolation.

The hosting wizard must not assume prior firewall/security experience. Its privileged provisioning stage should:

- Detect existing system and cloud firewall management (UFW, firewalld, nftables, panel-managed rules and provider controls).
- Discover the actual remote administrative connection; preserve authorized SSH access/ports.
- Explain proposed exposure: public proxy ports (typically 80/443), private worker sockets/loopback ports, restricted management endpoints.
- Plan, preview and obtain consent for changes; protect remote sessions with an independently enforced, timed rollback or refuse automated changes if safe rollback cannot be established.
- Detect compatible systemd, privilege/drop-user, SELinux/AppArmor, cgroups v2, filesystems, TLS and reverse-proxy policies as applicable.
- Use dedicated least-privilege system accounts, confined deployment storage and no unnecessary public worker listeners.
- Verify effective local policy and, where possible, test external reachability; state what was **not** verified.
- Record operations for auditing/reconciliation and avoid silent replacement of unrelated server settings.

**Security invariant:** The firewall is defense in depth, not the only boundary. No arbitrary OS commands exposed to WBasic/Wydgits; no implicit host privilege from package provenance or customer identity. Public-facing management should be off by default until separately authorized, strongly authenticated and encrypted. For remote administration, use MFA, carefully bounded sessions, CSRF protection, audit records and private networking where possible.

## 6. Almond Linux Server: turnkey reference implementation

Almond Linux Server is the easy-to-install and reproducible reference for WydHosting. Its OS setup prepares firewall policy, system services, runtime dependencies, worker boundaries and a **Wydgit-powered server administration website** (a future Webmin-like management interface).

The admin UI should be a normal Wydgit application. It uses a narrow, separately privileged management broker, not root access through WBasic or direct arbitrary command execution. Proposed UI modules include monitoring, customers, sites/pools, certificates/domains, service status, backups/restores, firewall/security and controlled updates.

The panel has two separable scopes:

- **WydHosting Admin:** Provider sites/accounts/pools, usable on any officially supported WydHosting Linux installation.
- **Almond System Admin:** Additional OS/host functions available through tested WydOS/Almond server capabilities on Almond Linux.

The Almond reference should be reproducible and remain optional. Documentation and configuration recipes should help users compare supported non-Almond deployments against the reference setup.

## 7. WydOS: optional portable OS-integration library

The [WydOS platform independence foundation](../wydos.md) develops this vision into
proposed service, discovery, authorization and portability-validation contracts.
It governs the detailed WydOS proposal; examples here remain strategic illustrations,
not implemented APIs. Linux (including Almond), Windows and macOS are long-term
targets. WydOS does not require Almond or WydHosting.

**WydOS is a library that plugs into Wydgine, not an operating system.** It publishes portable contracts for host-approved OS capabilities and routes authorized operations to OS-specific drivers through SEAM. Driver support is optional and capability-discoverable; unsupported functionality fails explicitly and safely.

Proposed future capability families, **not existing APIs**:

- Desktop notifications and dialogs.
- User-approved files and folders, native pickers and printing.
- Clipboard integration with narrowly scoped consent.
- Window management and desktop application integration.
- Devices/peripherals through explicit permissions.
- Approved background jobs and host metrics.
- Administrative service control through a separate, privileged broker and stronger authorization.

Example conceptual namespace: `OS.NOTIFICATIONS.SHOW`, **illustrative only**, not a committed WBasic syntax or permission contract. WydOS must honor SEAM; it does not invent a new unchecked authority system. Desktop and server capability profiles are distinct.

### 7.1 WydOS/Almond driver

**`WydOS/Almond`** is the proposed initial reference driver for Almond Linux; it is
not implemented and is not a dependency of the portable WydOS contract. Given its AlmaLinux basis, it may share implementation with AlmaLinux, Rocky Linux, RHEL and Fedora, subject to concrete capability/version/security testing. Common facilities include systemd, D-Bus, SELinux, firewalld/nftables, cgroups v2, RPM/DNF and freedesktop desktop interfaces. Detect actual capabilities, not just `/etc/os-release` branding.

Internally, favor common Linux building blocks plus thin distribution-specific adapters when needed. Other OS drivers (Windows, macOS, Debian-family, etc.) may follow through community contribution, but need independent validation for security-equivalent claims.

## 8. Almond Milk: local, lightweight Wydgit applications

Almond Milk is a proposed **edge-ready ChromeOS alternative** that bundles Wydgine and WydOS/Almond to run portable Wydgit Apps locally. It may share one OS-installed runtime and browser engine rather than bundle Chromium/Node in each individual application as Electron deployments often do.

Potential benefits: smaller App payloads; less repeated dependency storage; standardized OS-mediated updates; fast local launch; offline functionality; same App package family across desktop and hosted environments. But shared process/browser resources have their own overhead and isolation costs—**do not promise superior memory, speed or security without measurement**. Window lifecycle, safe multi-App local concurrency and package compatibility are engineering work, not solved by WydOS alone.

A Wydgit App's OS permissions should be declared, visibly approved when needed and enforced by SEAM and the appropriate OS broker/driver. Installing Almond Milk must not turn all website Wydgits into privileged desktop software.

## 9. Integrations with existing hosting control panels

Develop optional adapters/plugins for **cPanel/WHM, Plesk, Webmin/Virtualmin**, subject to their actual runtime and extension capabilities. These provide a visual route to install/manage **standalone Wydgine** inside infrastructure that already manages OS users, domains, TLS, processes and resource quotas; they must **not** require WydHosting. Plugins invoke the same management contracts as the CLI and setup GUI. A shared-hosting account without persistent Node-process capability cannot be assumed compatible.

Separately, WydHosting's own administration UI operates provider-level infrastructure and does not need to recreate every control-panel feature in the initial release.

## 10. Business model and distribution freedom

The platform remains usable independently of DivDev-managed infrastructure. Potential optional revenue streams:

1. Freemium managed Wydgit hosting with capacity/feature upgrades.
2. Paid customer isolation, multiple sites and higher resource tiers; higher tiers can purchase dedicated per-site pools.
3. Advanced developer tooling and future commercial Wydgit ecosystem/marketplace.
4. Almond Linux enterprise support subscriptions: supported configurations, security fixes, update guidance, incident assistance; higher tiers may add priority assistance or contractual response commitments when staffing supports them.
5. Almond deployment/migration consulting and optional fully managed infrastructure.

**No artificial free-version crippling is required.** Paid support purchases operational assurance, convenience, capacity and accountability, rather than application portability. Do not advertise contractual SLAs or continuous security support until those obligations can be fulfilled.

## 11. Relationship to the 0.3 roadmap

**Approved update — 2026-10-18:**
[Decision 0003](../decisions/0003-defer-managed-hosting-qualification-to-0.4.md)
defers managed, multi-tenant WydHosting qualification and the Debian 13 VM experiment
to **0.4**. I5.6 stays **incomplete, experimental and not security qualified**, with
all six outstanding work packages, acceptance criteria and evidence requirements
preserved. Debian remains a supported target; no VM creation/guest changes are
authorized. The [feasibility assessment and trial plan](../milestones/0.3-I5.6/recovery-and-debian-feasibility.md)
remain the basis for later separately approved work.

Wydgine **0.3 continues toward five-site migrations** through independent Node
processes, separate OS users, secrets and storage behind a conventional reverse
proxy. This operator-managed path does not qualify managed WydHosting. Track
intermittent `SEWN.LIMIT` HTTP 500s separately as the open
[0.3 reliability issue](../milestones/0.3-reliability.md). The
[current release record](../milestones/0.3-release-status.md) governs this split;
the original sequence below is retained as historical planning, not a requirement
to qualify managed hosting before standalone 0.3 migrations. No security gates are
waived and no deployment is authorized by the decision.

This document is a **long-term plan**. It should not expand active milestones by accident.

- **0.3-I3:** Continue its already-established operational scope unchanged; do not reopen the work order because of these ideas.
- **0.3-I4 (design milestone):** Formalize Wydgine/WydHosting package boundary, single-App standalone UX, shared process/worker architecture, placement/tier model, strong isolation options, filesystem ownership and trust boundaries, setup/distribution contracts and migration plan. Produce risk/acceptance mapping rather than a wholesale refactor.
- **0.3-I5 (if approved):** Implement incremental package separation and stronger process supervision/isolation, keeping Wydgine independently installable. Split further as needed; gate on tests and security review.
- **0.3-I6 (only if needed):** Additional integration/hardening before administration.
- **0.3-J:** Platform/App administration APIs and user experiences; design for provider and OS broker separation.
- **Later independent programs:** Native control-panel plugins, full Almond Linux Server reference release, Almond Milk, WydOS service contracts/drivers, formal enterprise support offerings. **These are not committed deliverables for 0.3.**

Existing Wydgine I0–I2 host code includes `wydgine/multi-app.js`, `wydgine/http/routing.js`, and `wydgine/governance.js`; I3 extends operational capabilities. These should be assessed for extraction without weakening proven boundaries or breaking immutable package artifacts. Before implementation, Cooter should inspect current Git state because this snapshot reflects planning and observed work **through I2**, with I3 commissioned.

## 12. Non-negotiable engineering principles

1. **Portable Apps:** Same Wydgit packages/application model across standalone, shared, dedicated and local desktop contexts where capabilities permit.
2. **Optional integration:** Wydgine requires neither WydHosting nor WydOS for ordinary operation.
3. **Fail closed:** Unapproved App roots, unknown hosts, broken manifests, ambiguous owner mappings, unsafe setup or missing permission must not trigger fallback to another App or higher privilege.
4. **No untrusted Node privileges:** SEAM and bounded execution remain authoritative; OS-facing actions cross a narrow, audited, host-approved service interface.
5. **Layered isolation:** Logical App isolation, process isolation, Unix identities, immutable staging and kernel security are distinct protections; never represent one as another.
6. **Easy install, explicit administration:** Setup should guide novices without silently modifying firewalls, root-owned files or active hosted Apps.
7. **Provider-neutral:** Existing cPanel/Plesk/Webmin hosting and self-managed Node deployments remain legitimate; Almond is a reference, not a requirement.
8. **KISS. KICK. KICK ASS.:** Reuse proven Wydgine mechanisms, keep packages decoupled, benchmark before tuning and avoid implementing future product visions inside today's milestone without approval.

## 13. Open design questions for future reviews

- Exact npm package names/workspace layout and standalone CLI startup compatibility.
- Which host-only I0–I3 code is internal Wydgine worker infrastructure vs. WydHosting provider orchestration?
- Process pool limits, worker trust model, cgroups/SELinux policy and economically viable free-tier density.
- Account provisioning authority, filesystem immutable deployment/snapshot scheme and symlink handling.
- Dedicated-customer pool lifecycle, crash recovery, backups, cross-node migration, data consistency and cutover.
- The privileged host setup engine's Linux platform adapter interface and supported distro matrix.
- Standard reverse proxy/HTTPS, cloud firewall coexistence, remote admin bootstrap and recoverable firewall changes.
- Versioned WydOS capability schema, driver ABI, consent/UI semantics, portable unsupported-capability behavior.
- Almond Linux base distro support/update strategy; reproducibility and publication of reference deployment recipes.
- Almond Milk browser/runtime process model and actual baseline vs. Electron/ChromeOS benchmarks.
- Commercial pricing, quotas, support hours and contractual enterprise services once operational capacity exists.

------

**North star:** Developers can run `Wydgine` on their own VPS with a single App. Hosting providers can add `WydHosting` to operate many customers and pools. Almond Linux Server makes that provider setup turnkey. Almond Milk brings the same Wydgit application model onto lightweight local devices via `WydOS/Almond`. Users can move between those environments without being trapped by the platform.

## I4 implementation handoff

The [I4 architecture](../milestones/0.3-I4/README.md) audits actual I0–I3 code and
records the [incremental I5 plan](../milestones/0.3-I4/I5-plan.md). I3's stopped local
JSON relocation is implemented; installable engine/provider packages, process/OS
isolation and provisioning remain future work. The preceding strategic snapshot
is preserved; it is not evidence that those capabilities already exist.

## I5.6 implementation status

Managed, multi-tenant qualification and the Debian 13 VM trial are deferred to 0.4
by Decision 0003 above. I5.6 is incomplete and unqualified. The original technical
status below is preserved; its outstanding security gates remain required.

I5.4/I5.5 delivered independent packed packages and actual same-UID supervision.
The [I5.6 candidate](../milestones/0.3-I5.6/README.md) adds executable Linux
broker/staging/service/private-ingress boundaries, but has **no privileged Linux
qualification** and is **not implementation complete**. Live firewall transactions,
automatic retirement and the VM attack matrix remain. I5.7 migration/cutover and
I5.8 integrated release qualification are still separate work. The earlier strategic
snapshot and I4 design remain historical; they are not current certification claims.
