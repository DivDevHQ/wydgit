# Canonical libraries — 0.2-H

**Libraries provide capabilities. SEAM grants authority.**

A Wyd runtime library is an independently versioned implementation package with a
validated descriptor and one explicit registration entry point. It is trusted
runtime infrastructure, not an ordinary Wydgit package. Ordinary Wydgit packages
can declare requirements; they cannot install Node dependencies or approve runtime
code. [WydStore](wydstore.md) and [WydGate](wydgate.md) are implemented canonical
libraries; other canonical libraries remain deferred.

**Repository location is a development concern, not part of library identity.**

## Workspace and identities

The root private `wydgit` package is the npm workspace host (`packages/*`). Existing
Wydgine and demo code deliberately remain in place. The fixture workspace is
`packages/test-library`, an independent `@wydgit/test-library@1.0.0` package with its
own metadata and exports. It is explicitly a non-production fixture and marked
private to prevent accidental publication. `packages/wydstore` adds the independently versioned `@wydgit/store@0.1.0-alpha.2`.
`packages/wydgate` adds `@wydgit/gate@0.1.0-alpha.3`.
Canonical package versions need not match the platform version or remain in this
repository.

Canonical mappings (only WydStore, WydGate and the fixture are implemented; none published):

| Canonical identity | Node implementation package |
| --- | --- |
| `wydstore` | `@wydgit/store` |
| `wydgate` | `@wydgit/gate` |
| `wydstream` | `@wydgit/stream` |
| `wydgaming` | `@wydgit/gaming` |
| `wydfiles` | `@wydgit/files` |
| `wydmail` | `@wydgit/mail` |
| `wydnotify` | `@wydgit/notify` |
| `wydsearch` | `@wydgit/search` |
| `wydqueue` | `@wydgit/queue` |
| `wydcache` | `@wydgit/cache` |
| `wydapi` | `@wydgit/api` |
| `wydcommerce` | `@wydgit/commerce` |
| `wydsocial` | `@wydgit/social` |
| `wydtest` | `@wydgit/test-library` (fixture only) |

Neither an npm package name, Git URL, directory nor Wydgit instance ID defines the
canonical library identity. Canonical IDs use lowercase letters, digits and
hyphens, beginning with a letter. Publisher identity is separate again.

`npm ci` links the workspace automatically. `npm ls --workspaces --depth=0` verifies
the link. `npm start`, `npm test`, and `npm run check` retain their root entry points.
No runtime installer or dependency orchestration is added.

## Installed, enabled, required

- **Installed:** the host can resolve the implementation package and its exported
  package metadata from its dependency tree.
- **Enabled:** trusted host configuration explicitly permits loading that package
  for a particular library ID, publisher, trust class and version range.
- **Required:** portable application/package data requests a library ID and range.

Installing a package grants nothing and never triggers library discovery.
Requirements do not enable or install packages. Enabled libraries are validated
and loaded even if currently unrequired; any enabled-library failure aborts startup.
Disabled packages are not resolved, imported or registered.

## Host configuration and trust

`wydgit.config.json` is host configuration, outside canonical App JSON:

```json
{
  "schema": "wydgit.host/0.1",
  "libraries": [{
    "id": "wydtest",
    "package": "@wydgit/test-library",
    "enabled": false,
    "version": "^1.0.0",
    "publisher": "wydgit.core",
    "trust": "canonical"
  }]
}
```

The shown fields are required. An optional `options` JSON object supplies only that
library’s host configuration to registration; each library validates its own shape.
Unknown fields are rejected. The library list makes
duplicate logical IDs detectable without relying on JSON object-key overwriting.
Only bare npm package names are accepted: no subpaths, file/HTTP URLs, versioned
specifiers or Node builtins. There are no secrets or ordinary Wydgit capability grants here. Optional
`bindings` approve private implementation-resource grants for declared library
dependencies; see below.
The demo ships with the fixture, WydStore and WydGate installed but **disabled**, and no requirements.

Trust classes:

- `canonical`: host-approved first-party runtime code, publisher `wydgit.core`.
- `approved`: an explicitly approved third-party runtime extension, with its exact
  publisher and implementation mapping supplied by the host.
- Ordinary Wydgit packages: intentionally **not** a loadable trust class. An
  `ordinary` manifest/config is rejected rather than promoted to runtime code.

Configuration is trusted operator policy, not package-authored approval. Before
import, the host validates that policy and the installed package's name/version.
After import, the manifest must match the approved logical ID, publisher, trust
class and version. A package's own trust claim or `@wydgit/` prefix is insufficient.
This is an explicit approval boundary, **not cryptographic publisher verification**.
Operators must review/install vetted artifacts and dependencies. npm lockfile
integrity remains deployment tooling's responsibility.

Importing a library executes trusted Node code before exported metadata can be
inspected. This mechanism does not sandbox arbitrary JavaScript, prevent malicious
import-time side effects, or authenticate a package that lies about its publisher.
Never enable unreviewed code. Approved runtime libraries may carry vetted npm/native
transitive dependencies; ordinary Wydgit packages may not inject them.

## Manifest and registration

A Node implementation exports `manifest` (strict JSON data) and `register` (a
function). The package must export both its root entry and `./package.json`, with a
root export resolvable through Node's `createRequire().resolve`; the loader imports
that exact resolved entry by file URL. No repository-relative fallback is used.

```js
export const manifest = {
  schema: 'wydgit.library/0.1',
  id: 'wydtest',
  version: '1.0.0',
  publisher: 'wydgit.core',
  trust: 'canonical',
  platform: '^0.2.0-alpha.3',
  targets: ['server'],
  capabilities: ['test.echo.read'],
  services: [{ name: 'echo', capability: 'test.echo.read' }]
};
export function register({ service }) {
  service('echo', value => value);
}
```

The shown manifest fields are required. Optional `requirements` uses the portable
requirement envelope below. Unknown fields, dangerous keys, accessors,
non-JSON metadata, invalid/duplicate declarations and unsupported schemas fail.
Targets can contain `server`, `client`, or both; this Wydgine loader requires
`server`. Declaring client support does not implement WydClient.

Service names are local to the library. Every service names a declared capability;
every capability must have at least one declared service. Capabilities follow the
shared SEAM `domain.resource.action` grammar. A capability has exactly one provider
in a loaded registry; duplicate providers fail instead of silently overriding.

Registration receives frozen `{service(name, handler, policy?), options, failure, dependency, lifecycle}`.
`policy.authorize(request, context)` must return `true` to allow bound service
dispatch; omitting it keeps a service host-only. `failure(code)` creates a branded,
sanitized structured failure without accepting arbitrary messages or details.
The options are copied, JSON-validated and deeply frozen. Registration cannot
access the registry, runtime objects or SEAM policy through this API. Only explicitly
approved dependency services are accessible through `dependency(library)`. Handlers must be functions, registered exactly once under declared names.
Registration may return a promise, which is awaited. Missing, extra or duplicate
registrations fail, including invalid attempts caught by library code. The API
closes after registration; retaining it cannot add services later.

No global self-registration or automatic import registration exists. Lifecycle is
host-owned: initialize once before accepting requests, discard the registry on
failure, and end it with the host process. Libraries must avoid background work or retained resources during registration.
WydStore performs bounded initialization/validation and closes file handles before
returning. Initialization may have external effects that are not rolled back when
a later library fails. Teardown/reload is deferred.

## Loader, registry and startup

`loadLibraries({config, requirements, platformVersion, root})`:

1. Validate configuration and requirements; reject missing/disabled requirements.
2. Sort enabled mappings by canonical ID.
3. Resolve **only** each configured package's exported metadata and root entry.
4. Validate installed package identity/version, import the entry, verify manifest,
   publisher/trust expectations, platform compatibility, targets and uniqueness.
5. Resolve application and library requirements, reject dependency cycles, and
   validate host bindings before invoking any registration.
6. Register declared services in deterministic dependency-first order into private staging maps.
7. Return the frozen registry only after all work succeeds.

There is no `node_modules` enumeration, naming-prefix discovery, fallback loader,
global registry or package-provided policy setter. Node's normal explicit package
resolution and the approved package's own dependency imports still apply.

Registry host API:

- `list()` / `get(id)`: frozen metadata, including loaded version and trust class.
- `capabilities()`: sorted capability/provider pairs; these are availability records.
- `service(id, name)`: a raw **trusted-host-only** implementation function.
- `bind(context)`: a frozen caller-bound dispatcher exposing only `call(library, service, input)`.
- `resolve(requirements)`: validate/resolve additional portable requirements against
  this registry; returns frozen manifest records, without loading anything new.

Raw services are not safe Wydgit handles. Pass only a bound dispatcher or a library
facade across a package boundary. Dispatch checks an authentic context, the declared
capability and the registered authorization policy, retains the original caller,
and copies/freezes JSON input and output. It returns `{ok:true,value}` or a safe
structured failure. Unexpected exceptions and non-JSON results become
`SERVICE.FAILED`; invalid input becomes `SERVICE.INVALID_REQUEST`; missing grants,
services or authorization policies yield `SEAM.DENIED`. Branded failures retain
only their safe code. Library registration/dispatch never grants capabilities.

`initializeHost({root})` reads host config plus `content/requirements.json` and uses
the platform package version. `createHostApp()` retains the resulting registry in
`app.locals.libraries` for trusted host code. `server.js` awaits this initialization
before creating a listener. Missing/malformed startup documents fail closed.
The existing synchronous `createApp()` remains a web-adapter factory for renderer
and HTTP tests, not the production library startup path.

## Portable requirements and versions

`content/requirements.json` is a portable companion manifest, separate from the
six-field canonical App object envelope. Future Wydgit package manifests can reuse
this same contract:

```json
{
  "schema": "wydgit.requirements/0.1",
  "libraries": [{ "library": "wydstore", "version": "^1.0.0" }]
}
```

It contains no npm names, Git URLs, paths or implementation details. Duplicate
library IDs within one document and extra fields are rejected. Multiple future
package documents can be checked individually against the same registry; package
aggregation and installation are deferred. The current demo's requirement list is
empty. No Node wiring is added to canonical App properties or provenance.

Three versions are independent:

- Platform version: `wydgit@0.2.0-alpha.17`.
- Library version: e.g. the fixture's `1.0.0`, equal to its npm package version.
- Compatibility ranges: manifest `platform`, host-approved implementation `version`,
  and portable requirement `version` each constrain their respective version.

The loader uses npm's [semver implementation](https://github.com/npm/node-semver).
Standard prerelease exclusion applies; no loose/coerced matching or blanket
`includePrerelease` option is enabled. Ranges must be nonempty valid strings; npm
dist-tags such as `latest` are not ranges. The fixture explicitly supports the
platform's 0.2 prerelease series through `^0.2.0-alpha.3`.

## Failure behavior

Failures throw `WydgitError`; `toJSON()` emits the established safe structured error
shape. Normal messages exclude package paths, import exception messages and stacks.
The server logs that structured form and exits unsuccessfully without listening.

| Code | Meaning |
| --- | --- |
| `LIBRARY.INVALID_CONFIG` | Missing/malformed host configuration or invalid mapping. |
| `LIBRARY.INVALID_REQUIREMENTS` | Missing/malformed portable requirements. |
| `LIBRARY.NOT_INSTALLED` | Configured package or required exports cannot resolve. |
| `LIBRARY.IMPORT_FAILED` | Resolved implementation throws/fails to import. |
| `LIBRARY.INVALID_MANIFEST` | Invalid package metadata, exports or descriptor. |
| `LIBRARY.IDENTITY_MISMATCH` | Exported library ID differs from configured ID. |
| `LIBRARY.UNTRUSTED` | Disallowed class or publisher/trust mismatch. |
| `LIBRARY.VERSION_MISMATCH` | Installed, descriptor, platform or required version incompatible. |
| `LIBRARY.TARGET_MISMATCH` | Server target unsupported. |
| `LIBRARY.DUPLICATE` | Duplicate logical identity or capability provider. |
| `LIBRARY.UNKNOWN` | Unconfigured required library or unknown registry lookup. |
| `LIBRARY.NOT_ENABLED` | Required library explicitly disabled. |
| `LIBRARY.NOT_LOADED` | Required configured library absent from the loaded set. |
| `LIBRARY.DEPENDENCY_CYCLE` | Library requirements contain a cycle. |
| `LIBRARY.DEPENDENCY_DENIED` | Missing or invalid host approval for dependency services. |
| `LIBRARY.REGISTRATION_FAILED` | Registration throws, violates or omits declarations. |
| `LIBRARY.INITIALIZATION_FAILED` | Unexpected server initialization error, sanitized at startup. |

No partial registry escapes on failure. This does not roll back JavaScript module
side effects or external effects from vetted registration code. Node caches imported
modules; repeated initializations use separate registries but are not module reloads.

Deferred: canonical libraries other than WydStore and WydGate, package installation/approval
UI, automatic dependency edits, restart orchestration, cryptographic package
approval, resource lifecycle hooks, marketplace, client runtimes and other
later-phase systems. No founding-contract revision or
human architectural decision is required by this implementation.


WydStore 0.2-E uses the same library registration and caller-bound dispatcher for
both JSON and SQLite. Its host-only `options.stores` selects the provider; manifest
capabilities and portable requirements contain no database choice. The vetted
`better-sqlite3` dependency belongs to the WydStore workspace, not Wydgine or the
root package. SQLite connections close after each operation, so no library
lifecycle API was added. See [WydStore](wydstore.md) for the adapter contract.


## Approved library dependencies

A library may declare portable `requirements` using the same envelope as App
requirements. A requirement does not enable a library or grant access to it. The
host must explicitly enable each implementation and supply one `bindings` entry
per dependency: `{library, app, capabilities, scopes}`. Capabilities must be
provided by that dependency. Duplicate, missing or undeclared bindings fail closed.

During registration, `dependency(id)` returns only `{identity, call(service,input)}`.
The loader binds it to a private host-issued implementation context with the
consumer's publisher and package identity `library:<consumer-id>`, plus exactly the
App, capabilities and scopes approved in host config. Calls use the normal JSON,
capability and resource-scope checks. The library cannot choose a principal or
alter those grants. This handle remains within trusted library code.

Public service calls still receive their original application ExecutionContext.
Their authorization is checked separately before a library uses its private
implementation resources. Neither loading, dependency declaration nor an API call
adds grants to an application caller. WydGate uses this mechanism to reach a
WydGate-owned WydStore collection; ordinary packages receive only safe identity
results. See [WydGate configuration](wydgate.md) for a complete host example.


0.2-H adds a narrow `lifecycle(event)` registration hook and optional host
`loadLibraries({lifecycle(libraryId,event)})` observer. It copies/freezes JSON and
provides no grant or registry access. WydGate uses it after committed Session
transitions; Wydgine dispatches under explicitly chosen host authority. It is not a
global package event bus or durable queue. Observer failure cannot undo committed
revocation; Gate continues terminal cleanup notifications. See [events.md](events.md).


## 0.2-P local packages

Local packages declare required libraries; they cannot enable/install them. Operators separately map logical resources and approve grants. Startup resolves cataloged requirements; library versions/contracts remain unchanged. See [packages](packages.md).
