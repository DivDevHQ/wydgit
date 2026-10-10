# Wydgit

**A portable, capability-safe application platform for the open web.**

Wydgit is an experimental application platform built around small, composable objects called **Wydgits**.

It began as a server-rendered web application system, but its architecture is being designed around a broader goal: a portable application model that can eventually support web, desktop, mobile, embedded, and decentralized network environments without tying applications to HTML, the DOM, a specific database, or a specific runtime.

> **Wydgit is a proposed shape for Web 4.0: a portable, capability-safe application layer for the open web.**

---

## Philosophy

Wydgit follows two related design principles:

### KISS

**Keep It Simple, Stupid.**

Application authors and site owners should work with the simplest useful abstraction possible.

### KICK

**Keep It Clean, King.**

Public APIs, object models, configuration, and development workflows should remain clean and understandable.

Architecturally, KICK also has a useful backronym:

**Keep It Complicated in the Kernel.**

When complexity is necessary for security, portability, resilience, or compatibility, push that complexity into the platform instead of making every developer reproduce it.

The result should be:

> **High-level simplicity with low-level discipline.**

---

## Current Status

Wydgit is currently in **early alpha development**.

The 0.2 alpha implements an App object model, SEAM authority, bounded WydBASIC/SEWN behavior, semantic Forms, local declarative package installation, JSON/SQLite storage, WydGate identity, Hono transport and CSS-native system/light/dark presentation:

- validated bounded portable [SEWN workflows](docs/sewn.md) with procedures, safe contexts and service calls
- WydBASIC SUB/FUNCTION and source-declared EVENT modules compiled to canonical SEWN
- replaceable Hono HTTP transport adapter on Node.js
- canonical App-rooted JSON and immutable hydrated Wydgit instances
- single prototype inheritance with publisher boundaries and abstract bases
- validated named slots and deny-by-default scoped traversal
- authorized edit sessions, immutable commits, change sets and revision hooks
- npm workspaces, explicit host-approved library loading, portable requirements
- scoped storage services, typed records, optimistic concurrency and record history
- local users, Argon2id passwords, revocable sessions, roles/groups and explicit permissions
- Session-owned request-local Page lifecycles and bounded contextual events
- safe request/response, Markdown/file delivery and scoped headers/cookies
- WydClient lifecycle and semantic browser-event adapter (trusted host integration)
- server-side rendering
- Markdown content
- sanitized output
- navigation and page routing
- skins and scoped presentation rules
- nested App → Page → Section → Block composition
- renderer and HTTP tests

Implementation details: [object model](docs/object-model.md), [SEAM](docs/seam.md), [mutation model](docs/mutation-model.md), [library model](docs/library-model.md), [WydStore](docs/wydstore.md), [WydGate](docs/wydgate.md), [events/HTTP execution](docs/events.md), [HTTP transport](docs/http-transport.md), [SEWN](docs/sewn.md), and [WydBASIC](docs/wydbasic.md). Local declarative packages execute validated WydBASIC/SEWN through those boundaries; arbitrary package JavaScript remains forbidden.

The architectural contract is:

[`docs/FOUNDING-ARCHITECTURE.md`](docs/FOUNDING-ARCHITECTURE.md)

Current development version: **0.2.0-alpha.18**. Completed platform milestones
update `package.json`, matching root metadata in `package-lock.json`, and
`content/app.json` → `properties.revision` together. Version updates do not create
Git tags or publish releases. Completed milestones also update [CHANGELOG.md](CHANGELOG.md).

Expect significant changes before 1.0.

---

## Core Architecture

The emerging Wydgit platform is built around several major components.

### Wydgits

Wydgits are first-class application objects.

Each Wydgit is:

- an instance of a prototype
- uniquely identified
- composable into a parent/child object tree
- capability-limited
- renderer-independent

### Wydgine

**Wydgine** is the server-side runtime.

It handles server execution, rendering, storage access, application services, and other backend responsibilities.

### WydClient

**WydClient** is the independent client runtime.

It can eventually support Wydgits inside:

- Wydgine applications
- static HTML pages
- WordPress or Drupal integrations
- CDN-hosted pages
- WydGo member surfaces
- future browser-based hosts

WydClient provides controlled access to browser capabilities without exposing unrestricted DOM or JavaScript access to ordinary Wydgit packages.

### SEAM

**SEAM** is the **Secure Extension Architecture Model**.

SEAM provides deny-by-default capability security.

Its core principle is:

> **Authority belongs to the execution context, not the object being called.**

Inheritance, containment, visibility, and dependency relationships do not automatically grant authority.

### SEWN

**SEWN** is the **SEAM Execution Workflow Notation**.

SEWN is the canonical structured behavior format used by Wydgit runtimes.

It is intended to be:

- JSON-native
- deterministic
- schema-validatable
- bounded
- portable
- capability-controlled

A future human-friendly authoring language may be called **WydStitch**.

---

## Modular Capability Libraries

Vanilla Wydgine and WydClient are intended to remain small.

**Libraries provide capabilities. SEAM grants authority.**

The library contract and explicit loader are implemented. `@wydgit/store` is the
first real workspace library, with JSON and SQLite adapters. `@wydgit/gate` adds
local identity/authentication through host-approved WydStore services; a separate
non-production fixture exercises loading. All three are disabled in
`wydgit.config.json` by default. Federation and login UI/auth-cookie issuance remain deferred. Gate permissions
never automatically grant SEAM capabilities.
`content/requirements.json` holds portable library requirements; it never names
Node implementation packages. Repository location is a development concern, not
part of library identity.

Optional capabilities will be supplied through canonical Wyd libraries such as:

- **WydStore** — storage abstraction
- **WydGate** — identity and membership
- **WydStream** — media hosting and streaming
- **WydGaming** — WebSockets, realtime applications, and game-oriented services
- **WydFiles** — virtualized file storage
- **WydMail** — mail services
- **WydNotify** — notifications
- **WydSearch** — indexing and search
- **WydQueue** — background work and scheduled tasks
- **WydCache** — caching
- **WydAPI** — controlled external API access
- **WydCommerce** — commerce infrastructure
- **WydSocial** — social-network primitives

Ordinary third-party Wydgit packages may request approved Wyd libraries, but may not inject arbitrary Node.js dependencies into the runtime.

---

## Security Model

Wydgit is being designed around the assumption that third-party application code should not automatically be trusted.

Ordinary Wydgit packages should not receive unrestricted access to:

- raw JavaScript execution
- Node.js internals
- the host filesystem
- arbitrary npm dependencies
- shell execution
- unrestricted network access
- raw SQL
- unrestricted DOM mutation
- arbitrary HTML injection

Instead, packages operate through explicitly granted capabilities.

The long-term goal is simple:

> **Make third-party code useful without requiring it to be trusted.**

Or, less formally:

> We assume third-party code may be poison.  
> The platform should keep it from becoming dangerous.

---

## Renderer Independence

The canonical Wydgit object model is not a DOM model.

Portable Wydgits describe semantic concepts such as:

- text
- images
- forms
- fields
- buttons
- lists
- containers
- navigation
- media
- collections

Renderers decide how those concepts become:

- HTML
- native mobile controls
- desktop UI
- future interfaces

This distinction is central to Wydgit's portability goals.

---

## WydGo

**WydGo** is a decentralized network that organizes independent websites and Wydgit-enabled pages into something more connected than a traditional web ring, but less centralized than a social media platform.

Each member site remains independently owned, hosted, and governed, while WydGo provides shared discovery, navigation, identity-aware interaction, and compatible Wydgit application surfaces.

In KICK terms, users should experience a coherent network without needing to know whether a destination runs Wydgine, WydClient, a legacy-site bridge, or some future renderer.

---

## License

Wydgit is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

Modifications to MPL-covered source files remain under the MPL, while Wydgit may be combined with separately licensed code in larger works.

See [`LICENSE`](LICENSE) for the full terms.

---

## Run the Current Alpha

Requires:

- Node.js 22.12 or newer
- npm

Try the tracked sample site (Home, About and Contact):

```sh
git clone https://github.com/DivDevHQ/wydgit.git
cd wydgit
npm ci
npm test
npm run check
npm start
```

Open http://127.0.0.1:3000/. Native Argon2 and SQLite dependencies use prebuilt
binaries where available; unsupported platforms need their native build toolchain.

Validate with `npm test` and `npm run check`. Inspect workspace linking with
`npm ls --workspaces --depth=0`. Startup validates enabled libraries and portable
requirements before opening the HTTP listener.


Guestbook is a tracked example package, **not installed by default**. Stop the host
and run the experimental alpha installer:

```sh
node scripts/install-package.js examples/guestbook
npm start
```

Review and explicitly approve authority, WydStore enablement and storage provisioning.
Choose JSON or SQLite, then a Page/parent/slot, and confirm the final plan. The
installer can provision host-owned `.wydgit-data`; no manual WydStore setup is
needed. Packages cannot approve their own grants. See [package contracts and recovery](docs/packages.md)
and the [Guestbook walkthrough](examples/guestbook/README.md). Use a disposable copy
for experiments: there is no uninstall operation.

## 0.2 limitations

This is alpha-quality software, with no beta-level security or ecosystem promise.
There is no uninstall, upgrade, storage migration, remote package registry, package
signature verification or automatic package dependency installation. Only one
installed package principal per Page and one installation of each fixed-ID package
template are supported. WydClient has no automatic bootstrap/transport. There is no
admin console or CMS. Canonical libraries currently live in this monorepo/workspace;
they are not independently published for general external consumption.

The [0.2-R audit record](docs/hardening-0.2-R.md) distinguishes automated verification
from remaining browser acceptance.
