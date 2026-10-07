# Wydgit Founding Architecture & Philosophy

**Status:** Founding architectural contract  
**Version:** 0.1  
**Purpose:** Define the principles and non-negotiable architectural decisions that guide Wydgit implementation.

---

## 1. What Wydgit Is

Wydgit is a portable application platform built around small, composable application objects called **Wydgits**.

Its long-term goal is broader than a site builder or web framework. Wydgit is intended to provide a portable, capability-safe application layer that can support:

- web applications,
- client-only applications,
- desktop applications,
- mobile applications,
- hosted network applications,
- embedded Wydgit applets inside existing platforms,
- and future renderers that do not yet exist.

The canonical Wydgit application model must therefore remain independent of HTML, the DOM, Node.js, any particular database, and any particular operating system.

A useful description of the ambition is:

> **Wydgit is a proposed shape for Web 4.0: a portable, capability-safe application layer for the open web.**

That vision must never become an excuse for unnecessary complexity.

---

## 2. Founding Engineering Philosophy

### 2.1 KISS / KICK

Wydgit follows two closely related rules:

**KISS — Keep It Simple, Stupid.**

The public developer and site-owner surfaces should remain as simple as practical.

KICK has a two-layer meaning. In general engineering philosophy terms:

> **KICK — Keep It Clean, King.**
> Keep the public-facing design clean, simple, coherent, and free of needless mess.

And in architecture discussions:

> **KICK — Keep It Complicated in the Kernel.**
> When complexity is unavoidable, bury it in the engine/runtime so developers and site owners don’t have to carry it.

When complexity is necessary for security, portability, compatibility, resilience, or performance, push that complexity into the runtime, compiler, framework, or canonical libraries rather than forcing every application developer to reproduce it.

The desired result is:

> **High-level simplicity with low-level discipline.**

### 2.2 Novel composition, mature components

Wydgit should avoid reinventing solved infrastructure.

Prefer mature, proven libraries and protocols for commodity functionality such as:

- networking,
- cryptography,
- databases,
- media processing,
- compression,
- TLS,
- queues,
- caching,
- storage providers,
- and operating-system integration.

Custom engineering should focus on the parts that make Wydgit itself unique:

- the object model,
- portability,
- capability safety,
- SEAM,
- SEWN,
- renderer independence,
- package composition,
- and developer/site-owner ergonomics.

> **Do not reinvent the wheel. Build the vehicle the existing wheels make possible.**

### 2.3 Security is a platform responsibility

Application developers should not need to remember dozens of security rules to produce a safe Wydgit.

The safe path should be the normal path.

> **Make the safe way the easy way, and make the easy way powerful enough that developers rarely need an unsafe way.**

If functionality and security genuinely conflict, Wydgit should err on the side of security.

This does **not** mean adding restrictions for theatrical or purely hypothetical threats. Security mechanisms must close a real class of risk.

### 2.4 Decision hierarchy

When no more specific architectural rule exists, prefer decisions in this order:

1. **Security**
2. **Portability**
3. **Simplicity**
4. **Functionality**
5. **Convenience**

This hierarchy is a tie-breaker, not an excuse for needless restriction.

---

## 3. Canonical Root: App

The canonical root object is **App**, not Site.

A website is one possible deployment and rendering profile of an App.

An App may later be rendered or compiled for:

- web,
- desktop,
- mobile,
- kiosk,
- TV,
- embedded environments,
- headless/server use,
- or future platforms.

Web-specific terminology and behavior must therefore remain outside the portable core where practical.

---

## 4. Wydgits Are First-Class Objects

Every Wydgit is an instance of a prototype.

The conceptual relationship is:

- **Prototype = class**
- **Wydgit = object instance**

The object model should feel familiar to developers with conventional object-oriented programming experience while remaining invisible to site owners who use no-code interfaces.

### 4.1 Identity

Every Wydgit instance receives an immutable internal ID at creation.

The following are distinct identities:

- App identity,
- publisher identity,
- package identity,
- prototype identity,
- Wydgit instance identity.

Names, titles, labels, URLs, paths, and friendly identifiers may change without changing object identity.

### 4.2 Inheritance

Wydgit 0.x uses **single inheritance**.

A prototype may inherit from:

- an official/public Wydgit prototype, or
- another prototype belonging to the same publisher namespace.

Cross-publisher inheritance is denied by default.

Future reuse across publishers should occur through explicit dependencies, interfaces, contracts, or other composition mechanisms rather than unrestricted inheritance.

> **Inheritance defines identity. Dependencies provide services.**

Abstract prototypes are permitted.

Multiple inheritance is not part of the founding model.

### 4.3 Containment

Inheritance and containment are separate concepts.

- Inheritance answers **what is this?**
- Containment answers **where is this?**

Every Wydgit except the App root has exactly one parent.

Children live in ordered, named slots.

A slot may define:

- accepted prototype or interface types,
- minimum cardinality,
- maximum cardinality,
- ordering behavior,
- and future validation rules.

The persisted object graph must remain acyclic.

Parent, sibling, root, and related navigation references are derived during hydration rather than serialized bidirectionally.

---

## 5. Canonical Serialization

Canonical Wydgit interchange and persistence use versioned JSON.

A minimum object envelope should resemble:

```json
{
  "schema": "wydgit/0.1",
  "id": "...",
  "prototype": "...",
  "properties": {},
  "slots": {},
  "provenance": {}
}
```

Canonical serialized Wydgits must never require:

- executable JavaScript,
- raw HTML,
- native object references,
- filesystem paths,
- DOM objects,
- Node.js objects,
- cyclic object graphs.

Hydration must be deterministic and explicitly validated.

Reserved JavaScript prototype-pollution keys such as `__proto__`, `constructor`, and `prototype` must be blocked or safely handled.

---

## 6. Renderer Independence

Canonical Wydgit objects describe semantic application structure, state, content, and behavior.

They do **not** describe a DOM tree.

Portable primitives should represent concepts such as:

- text,
- image,
- form,
- field,
- button,
- list,
- container,
- navigation,
- media,
- collection,
- status,
- and other semantic UI elements.

Canonical Wydgits must not depend on concepts such as:

- `div`,
- `span`,
- `window`,
- `document`,
- `innerHTML`,
- `onclick`,
- CSS selectors,
- or browser-only layout assumptions.

Each renderer decides how portable primitives map to its target environment.

---

## 7. WydClient

**WydClient** is the independent client runtime.

The client-side object surface exposed to Wydgits is **CLIENT**.

WydClient is not merely a browser helper bundled with Wydgine. It must be independently usable.

WydClient may be loaded by:

- Wydgine applications,
- static HTML pages,
- CDN-hosted pages,
- WordPress or Drupal bridge integrations,
- WydGo-compatible surfaces,
- or other host platforms.

A simple site should eventually be able to load WydClient from a CDN and mount compatible Wydgits without running Wydgine.

WydClient provides controlled access to browser/client capabilities rather than exposing the raw browser environment.

This includes safe abstractions over client-side persistence such as browser storage.

Historical note: the client runtime was briefly nicknamed **SUB** during early design. Production architecture uses WydClient / CLIENT.

---

## 8. Wydgine

**Wydgine** is the server runtime.

It hosts server-side Wydgit behavior and controlled server capabilities.

The server-side object surface may include safe objects such as:

- `SERVER`
- `REQUEST`
- `RESPONSE`
- `SESSION`
- `APPLICATION`
- `STORES`
- `FILESYS`
- identity/membership services
- canonical extension-library services

Wydgits must never receive unrestricted access to Node.js internals such as:

- `process`,
- raw filesystem access,
- `child_process`,
- arbitrary `require`,
- `eval`,
- `new Function`,
- or equivalent escape hatches.

---

## 9. SEAM

**SEAM** is the **Secure Extension Architecture Model**.

SEAM defines what an executing Wydgit may see and what it may do.

The central rule is:

> **Authority belongs to the execution context, not to the object being called.**

A low-authority Wydgit must not acquire additional authority merely by calling a higher-authority parent, child, dependency, or service.

### 9.1 Founding SEAM laws

- Deny by default.
- Inheritance does not grant authority.
- Containment does not imply trust.
- Containment does not imply visibility.
- Visibility does not imply authority.
- Traversal is explicitly granted.
- Capability escalation cannot be initiated by package runtime code.
- Security requirements on overridden behavior cannot silently weaken.
- Third-party code receives scoped interfaces or handles, never unrestricted raw runtime references.

### 9.2 Capability grammar

Capabilities use a hierarchical form:

```text
domain.resource.action
```

Examples:

```text
client.storage.read
client.storage.write

store.records.read
store.records.write

gate.identity.read

stream.media.play
stream.media.transcode
```

Implementation details should not be encoded into capability names.

A capability expresses **intent**. Runtime configuration determines the implementation.

### 9.3 Resource safety

SEAM governs more than data access.

Execution contexts must eventually support enforceable resource limits such as:

- maximum SEWN steps,
- bounded loops,
- execution time,
- recursion/depth,
- storage quotas,
- message sizes,
- outbound request limits,
- concurrency,
- and related denial-of-service protections.

A package that cannot steal data but can exhaust the machine is still unsafe.

---

## 10. No Raw HTML or Arbitrary JavaScript

Ordinary Wydgit packages do not emit arbitrary raw HTML or execute arbitrary JavaScript.

Rich authored content uses Markdown or another explicitly supported portable content representation.

Behavior uses SEWN.

Renderers own final output.

Expressions embedded into content must resolve to structured or Markdown-safe values before rendering.

No extension mechanism should quietly become an alternate path to `eval`, `innerHTML`, raw DOM mutation, arbitrary shell execution, or unrestricted server code.

Trusted platform implementation code is a separate concern from ordinary package behavior.

---

## 11. SEWN

**SEWN** is the canonical executable workflow representation.

SEWN stands for:

> **SEAM Execution Workflow Notation**

SEWN is:

- JSON-native,
- schema-validatable,
- deterministic,
- explicit,
- versioned,
- bounded,
- portable,
- and executable only through SEAM-authorized operations.

Wydgine and WydClient may execute appropriate SEWN behavior according to runtime target and granted capabilities.

Future authoring tools may compile into SEWN.

A future human-friendly text notation may be named **WydStitch**.

The architecture is:

> **WydStitch writes it. SEWN describes it. SEAM constrains it. Wydgine or WydClient runs it.**

WydStitch is optional and is not required for the first implementation.

---

## 12. Runtime Targets

Every package declares its required runtime target:

```text
client
server
client-server
```

### Client

Runs using WydClient without requiring Wydgine.

### Server

Requires Wydgine.

### Client-server

Uses both WydClient and Wydgine.

This distinction must remain explicit so packages do not accidentally acquire server assumptions.

---

## 13. State Ownership

Portable state is classified into three broad categories:

### Transient

Temporary runtime/UI state that need not survive the current execution context.

### Local

Persistent state owned by the local client/device/application installation.

Examples may include user preferences, local progress, or offline data.

### Authoritative

Canonical state owned by the server/application backend.

Networked applications treat the server-side authoritative store as the source of truth.

This distinction exists now so future synchronization does not require rewriting the object model.

---

## 14. Canonical Wyd Libraries

Vanilla Wydgine and WydClient should remain small.

Optional first-party capability families are delivered through canonical Wyd libraries.

Likely examples include:

- **WydStore** — storage abstraction
- **WydGate** — identity, membership, roles, permissions
- **WydStream** — audio/video/media services
- **WydGaming** — WebSockets, realtime rooms, game/client surfaces
- **WydFiles** — virtualized file/object storage
- **WydMail** — mail services
- **WydNotify** — notifications
- **WydSearch** — search/indexing
- **WydQueue** — background jobs and server tasks
- **WydCache** — caching
- **WydAPI** — controlled external APIs/webhooks
- **WydCommerce** — commerce infrastructure
- **WydSocial** — social-network primitives

This list is illustrative, not a commitment to implement all libraries immediately.

A capability should become a canonical library when it represents substantial trusted infrastructure that many unrelated Wydgit packages could reuse.

Application-level features such as guestbooks, blogs, forums, galleries, polls, and similar experiences should normally remain ordinary Wydgit packages built on top of canonical capabilities.

---

## 15. Dependency Trust Model

Ordinary Wydgit packages may depend on:

- the Wydgit core,
- canonical Wyd libraries,
- approved third-party Wyd extension libraries.

Ordinary Wydgit packages may **not** inject arbitrary npm or native runtime dependencies.

Canonical and approved Wyd extension libraries may themselves depend on vetted npm packages, native utilities, system libraries, or external components.

Therefore:

```text
Wydgit package
    ↓
approved Wyd capability library
    ↓
vetted implementation dependencies
```

Third-party publishers may create runtime extension libraries only after explicit DivDev approval and security review.

Approval to create a Wyd extension means permission to extend the trusted runtime surface. It does not grant permission to bypass SEAM.

---

## 16. Dependency Installation and Owner Consent

A Wydgit package may request a canonical or approved Wyd library.

It may not silently install one.

When a new runtime dependency is required, the App owner must be shown:

- the requested library,
- the requested version range,
- what capability it provides,
- and why the package requires it.

If approved, the platform may:

1. update runtime package dependencies,
2. install required transitive dependencies,
3. perform required provisioning,
4. restart the backend where necessary,
5. validate the resulting runtime,
6. activate the package only after success.

Canonical-library transitive dependencies are implementation details and should normally remain invisible to the App owner.

---

## 17. Package Lifecycle

Package installation is staged.

Initial lifecycle states are:

```text
available
approved
provisioning
installed
active
disabled
failed
```

The core rule is:

> **Provision first. Activate last.**

A package must never become active before its dependencies, storage requirements, migrations, validation, and runtime requirements have succeeded.

Failed installation must leave the previous application state usable wherever practical.

Upgrade and uninstall states may be added when those flows are implemented.

---

## 18. Package Ownership vs App Ownership

Package publishers own package definitions such as:

- prototypes,
- schemas,
- migrations,
- capability declarations,
- default/sample object templates,
- admin descriptors,
- package metadata.

Once a Wydgit instance is created inside an App, the App owns that instance.

Package upgrades may migrate compatible instances but must not blindly overwrite owner modifications.

Installed objects should retain provenance such as:

- publisher,
- package,
- package version,
- prototype source,
- creation source.

Provenance supports upgrades and migrations without erasing ownership.

---

## 19. Versioning

Use semantic versioning where it fits operational software:

- Wydgine,
- WydClient,
- canonical libraries,
- Wydgit packages.

Use explicit schema/protocol versions for:

- canonical Wydgit JSON,
- SEAM,
- SEWN,
- other serialized contracts.

Packages should declare minimum supported platform/runtime versions.

Maximum versions should be avoided unless a known incompatibility exists.

Compatibility should fail explicitly rather than producing undefined runtime behavior.

---

## 20. Structured Results and Errors

Platform boundaries return structured results.

Implementation-specific exceptions must not leak across SEAM as arbitrary runtime objects.

A platform error may resemble:

```json
{
  "ok": false,
  "code": "STORE.CONFLICT",
  "message": "The record changed after it was loaded.",
  "details": {}
}
```

Error codes should be:

- stable,
- machine-readable,
- renderer-independent,
- and safe to handle from SEWN.

---

## 21. WydStore

WydStore will provide an adapter-neutral storage model.

Initial adapters should prove the abstraction across meaningfully different storage styles, beginning with:

- JSON
- SQLite

The object model owns persistence semantics.

Persistence does not own the object model.

WydStore should eventually provide:

- stores,
- collections,
- items,
- typed fields,
- original/current values,
- dirty tracking,
- insert/update behavior,
- optimistic concurrency,
- record history/versioning,
- adapter capabilities,
- publisher isolation.

Wydgits and SEWN should never need raw SQL or backend-specific paths.

---

## 22. WydGate

WydGate provides identity and membership services.

The initial scope should remain deliberately small:

- local users,
- login/logout,
- secure password handling,
- sessions,
- roles/groups,
- permissions,
- basic profiles.

Federation, AgePass, enterprise directory integration, and broader identity protocols may build on the same abstraction later.

The exposed scripting/object surface must remain backend-neutral.

---

## 23. Virtual Filesystem

Any filesystem capability exposed to Wydgits is virtualized.

A future `FILESYS` surface may expose a hierarchy such as:

```text
FILESYS
  → dirs
  → dir
  → files
  → file
```

The implementation may use:

- local disk,
- SQLite BLOBs,
- S3-compatible storage,
- cloud object stores,
- or other adapters.

Wydgits never receive paths to application source code, `node_modules`, runtime internals, or unrestricted host filesystems.

SEAM separately governs read, write, list, delete, roots, and quotas.

---

## 24. Backups and Authoritative State

Server-hosted authoritative state is backed up by the server/application publisher.

Networked desktop/mobile clients do not independently back up server-owned authoritative data.

Self-contained client applications may expose platform-appropriate local export or backup functionality.

Backup scheduling and unattended backend tasks are primarily server concerns.

Version history is not a substitute for backup.

---

## 25. Existing-Web Compatibility

WydClient provides an adoption bridge for sites that do not want to migrate to Wydgine.

An existing platform may host a WydClient-powered Wydgit surface while keeping its current technology stack.

Possible hosts include:

- static HTML,
- WordPress,
- Drupal,
- legacy CMS platforms,
- custom PHP/ASP/etc. sites.

A pure WydClient applet can remain portable.

If the applet begins depending on host-specific APIs such as WordPress internals, it becomes host-adapted or host-specific and may require forked development.

This is acceptable, but host-specific dependencies must not be confused with canonical portability.

---

## 26. WydGo

**WydGo** is conceived as a decentralized network that organizes independent websites and Wydgit-enabled pages into something more connected than a traditional web ring, but less centralized than a social media platform. Each member site remains independently owned, hosted, and governed, while WydGo provides the shared discovery, navigation, identity-aware interaction, and compatible application surfaces that make those separate sites feel like parts of one larger network. In KICK terms, **Keep It Clean, King** means users experience one coherent social web without having to think about where each page lives or what technology powers it; **Keep It Complicated in the Kernel** means WydGo, WydClient, Wydgine, and SEAM handle the messy work of resolving member sites, validating compatible Wydgits, enforcing trust boundaries, and rendering them consistently without turning the whole network into one centrally controlled platform.

WydGo should be able to consume Wydgit-compatible application surfaces without trusting arbitrary host-page HTML or JavaScript.

A WydGo-compatible site may expose a dedicated WydClient/Wydgit surface while leaving the rest of the existing site unchanged.

WydGo should render validated Wydgit structure rather than blindly rendering arbitrary third-party page code.

Member navigation may therefore require endpoint discovery/resolution rather than treating every member destination as a raw web link.

The exact discovery protocol is intentionally deferred.

---

## 27. Hosted and Self-Hosted Editions

Wydgit should support both:

- FOSS/self-hosted deployment,
- commercially hosted deployment.

They should share the same core architecture.

The commercial hosted offering may add:

- tenant isolation,
- provisioning,
- quotas,
- scaling,
- managed secrets,
- monitoring,
- backups,
- billing,
- fleet updates,
- edge routing.

Do not fork the core into incompatible FOSS and commercial implementations.

Commercial value should come from operations, convenience, support, managed services, and advanced packages rather than intentionally crippling the open platform.

---

## 28. Security Release Gate

Wydgit should not be promoted as a safe third-party application platform until the security architecture has been aggressively tested.

Testing should include hostile packages and fuzz/property tests targeting:

- hydration,
- malformed object graphs,
- prototype pollution,
- prototype resolution,
- inheritance boundaries,
- cross-publisher leakage,
- containment traversal,
- confused-deputy attacks,
- WydStore isolation,
- FileSys escape attempts,
- Markdown/XSS paths,
- malformed SEWN,
- excessive loops/execution,
- resource exhaustion,
- package tampering,
- capability escalation,
- unsafe dependency behavior.

External review and penetration testing should be performed before broad claims of platform safety.

> **We burst our seams so no one can burst yours.**

---

## 29. What Must Remain Small

The following should remain deliberately small at first:

- Wydgine core,
- WydClient core,
- canonical object model,
- SEAM primitive rules,
- SEWN primitive operations.

New features should usually arrive as:

- Wydgit packages,
- canonical Wyd libraries,
- adapters,
- renderers,
- tooling,

rather than continual expansion of the core.

---

## 30. What We Are Deliberately Not Designing Yet

Do not overdesign these before implementation proves their requirements:

- complete SEWN syntax,
- WydStitch syntax,
- every WydStore adapter,
- every WydGate identity backend,
- WordPress/Drupal integrations,
- WydGo discovery details,
- native mobile/desktop compilation,
- marketplace economics,
- every canonical Wyd library,
- every renderer,
- every future package lifecycle state.

The architecture should preserve room for these without pretending we already know their final form.

---

## 31. Implementation Rule for Humans and Coding Agents

Before making a structural change, ask:

1. Does this preserve SEAM's deny-by-default security model?
2. Does this preserve renderer independence?
3. Does this preserve the distinction between object identity and object location/name?
4. Does this keep ordinary package code away from raw runtime escape hatches?
5. Does this belong in the core, a canonical library, an adapter, or an ordinary Wydgit package?
6. Are we introducing complexity because it solves a demonstrated problem?
7. Can mature existing software provide the low-level machinery?
8. Will this decision make a future web, desktop, or mobile renderer unnecessarily difficult?
9. Does an App owner remain in control of capability and runtime-dependency escalation?
10. Are failure states explicit and recoverable?

If a proposed implementation violates this document, either change the implementation or explicitly revise this document first.

Do not silently drift the architecture.

---

## 32. Founding Summary

Wydgit should be:

- **simple at the edge, disciplined underneath,**
- **secure by construction rather than developer vigilance,**
- **portable by object model rather than by emulating a browser everywhere,**
- **modular rather than bloated,**
- **open without being indiscriminately trusting,**
- **extensible without granting arbitrary execution,**
- **useful as a small tool before it ever becomes a grand platform.**

The grand vision matters.

The implementation should still begin with the smallest thing that proves it.
