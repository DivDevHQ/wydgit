# Wydgine

**0.3 release direction (2026-10-18):** continue the five-site migration goals
using independent Node processes, separate OS users, secrets and storage behind a
conventional reverse proxy. Managed, multi-tenant WydHosting qualification and the
Debian 13 VM experiment are deferred to 0.4; I5.6 remains incomplete and unqualified.
Debian remains a supported target. These standalone deployments do not qualify
managed WydHosting. Intermittent `SEWN.LIMIT` HTTP 500s remain an unresolved 0.3
reliability issue. See repository `docs/decisions/0003-defer-managed-hosting-qualification-to-0.4.md`
and `docs/milestones/0.3-release-status.md`. No deployment or guest changes are
authorized by this documentation decision.

Wydgine runs canonical Wydgit Apps. Version 0.3.0-alpha.21 is a private,
locally packed development artifact; it has not been published to npm.
Requires Node >=24.21.0. No WydHosting or Linux hosting installation is required.

Install a verified local tarball in a consumer directory:

```sh
npm install /verified/path/wydgine-0.3.0-alpha.21.tgz
./node_modules/.bin/wydgine setup
npm start
```

Setup configures an existing canonical App; it does not create an App or install
canonical services. A prepared `wydgine.local.json` is also supported. Commands:
`wydgine setup`, `wydgine validate <app-path>`, `wydgine start [app-path]`.
Run `wydgine --help` for exact options. Paths resolve from invocation/configuration
locations, never from the engine source directory. Missing headless selection,
malformed configuration and unavailable approved services fail closed.

The root export provides `createApp` and async `createHostApp`. Supply an explicit
App `root` for embedding; the default is the caller's current working directory.
`createHostApp` validates and initializes services before publishing HTTP readiness.
Use its `shutdown(server)` or `stop()` for cleanup.

Trusted Node exports are `wydgine/trusted/worker` (existing controller/operations/
relocation), `wydgine/trusted/provider` (provider validation helpers), and
`wydgine/trusted/services` (canonical implementation integration). These are trusted
native integrations, not portable App grants or a sandbox against hostile Node code.
The trusted `wydgine/trusted/protocol` and `wydgine/trusted/worker-entry` exports
provide the development-only inherited-IPC worker (`wydgine-worker`). It refuses
startup without parent-created IPC and accepts only fixed approved inventories.
WydHosting owns supervision; Wydgine retains execution. This is not OS isolation.

Canonical implementations must be separately installed and explicitly approved in
App configuration. Resolution starts at the App root and follows normal npm ancestry.
Store SQLite and Gate use native dependencies. Search and Stream explicitly accept alpha.13/alpha.14
Wydgine peers. Local tarballs remain sufficient while private packages
are unqualified for publication. Nothing installs providers during HTTP execution.

MPL-2.0; see LICENSE. Future public-registry installation is intended to use
`npm install wydgine`, after separate publication authorization and qualification.

Linux service mode uses worker protocol `wydgine.worker/2`, an inherited authenticated
stream, and a credential-checked private Unix HTTP profile. `native/peercred.c` must
be built explicitly and installed as a reviewed immutable artifact; no install hook
runs. Standalone and same-UID fork modes require no native helper. Trusted exports
`trusted/stream-peer` and `trusted/unix-peer` are host integration, never portable
capabilities. This experimental lane has no privileged Linux qualification evidence.

`wydgine/trusted/packages` now includes `planPackagePolicy`, `approvePackagePolicy`,
`applyPackagePolicy`, `cancelPackagePolicy` and read-only `inspectPackagePolicy`. These native stopped-App operations
require independent lifecycle and policy-management capabilities; they are not
portable services. See repository `docs/reviewed-package-policy-reconciliation.md`
for exact revision/approval bindings, local recovery and cross-process drain limits.


BackOffice in alpha.21 serves `/backoffice` and bounded action discovery/invocation
over installed BackOffice Wydgits. The platform shell groups authorized action
metadata and renders closed input/output contracts. Existing Gate/SEAM, exact
site, CSRF, Origin and generation checks remain mandatory. Use trusted hostname
routing for proxy/HTTPS; native `createHostApp({root,localHostname:'localhost'})`
and a loopback listener enable explicit local browser development. The historical
unbound standalone entry point rejects BackOffice. No accounts, elevated grants,
native policy endpoint or wider administrative domains are created.
