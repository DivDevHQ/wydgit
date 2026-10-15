# I5.4 — Complete packed packages and safe extraction

Wydgine runs Apps. WydHosting operates hosting infrastructure. Both are private
locally installable npm packages at **0.3.0-alpha.13**. No publication, tag,
release or deployment is implied. WydClient stays **0.1.0-alpha.8**, WydSUB **0.1**;
all 23 tracked browser distribution files remain byte-identical.

The packaging/executable contract warrants the platform and provider prerelease
advancement. Canonical library implementation/API versions remain unchanged:
Store alpha.3, Gate alpha.4, Search/Files/Stream alpha.1. Their local package manifests
now describe their actual closure; these tarballs are development verification,
not republication of an existing registry version. Files/Stream remain private.

## Physical layout

```text
app.js, server.js                     historical sample entry points
wydgine/**/*.js                       compatibility re-exports only
packages/wydgine/
  bin/wydgine.js                      installed launcher
  src/app.js                         canonical App composition
  src/engine/                        sole complete engine implementation
    launcher/                        setup/selection/start/configuration
    trusted/worker.js                historical trusted adapter contract
    seam/, sewn/, wydbasic/, ...      original authority and execution modules
  src/trusted/{worker,provider,services}.js
  runtime/wydclient/{index,uploads}.js browser adapter assets
  runtime/client-package/             signing payload's WydClient source closure
  package.json, README.md, LICENSE
packages/wydhosting/
  bin/wydhosting.js
  src/{index,adapter,contracts,planning,registry}.js
  package.json, README.md, LICENSE
```

The compiler signing closure contains packages/data/network client helpers and
imports validation from the same canonical engine. These are server-side compiler
resources, outside the HTTP browser allowlist. Browser engine modules are served
directly from the canonical source, never from a second Node authority implementation.

## Exports

| Package entry | Contract |
| --- | --- |
| `wydgine` | `createApp`, `createHostApp`; explicit consumer root recommended, default invocation cwd |
| `wydgine/trusted/worker` | `createHostApp`, `validateAppInventory`, `createMultiAppHost`, `createOperationalHost`, `restoreLocalApp` |
| `wydgine/trusted/provider` | inventory validation/snapshot/execution limits; host config/routing/resource policy; existing closed JSON/ID validators |
| `wydgine/trusted/services` | canonical `ExecutionContext`, repository loading, Markdown/Page paths, receiveFile and destination helpers |
| `wydgine/package.json` | installed platform metadata |
| `wydhosting` | existing trusted registry/planning facade |
| `wydhosting/contracts` | existing provider contract validators |
| `wydhosting/package.json` | installed provider metadata |

Trusted Node interfaces do not register portable capabilities. Native Node code is
trusted; npm exports are not a security sandbox. No protocol export, IPC codec,
worker process, supervisor or alternate validator is invented here.

Root app.js preserves repository-relative sample defaults with thin wrappers; the
historical trusted worker re-export retains that same embedding default.
All legacy engine paths re-export canonical modules, including context constructors,
private WeakSet brands, registry dispatch and ownership/token machinery. Renderer
index exports retain their old meaning. Package metadata comes from Wydgine itself.
The historical alpha.12 stopped-local relocation descriptor remains accepted and
emitted unchanged; a packaging version bump does not redefine its data contract.

## Service and platform requirements

Node **>=24.21.0**, npm **11.19.0** verified on Linux x64. This floor matches Files'
explicit requirement and was exercised with all five libraries, including native
better-sqlite3 13.0.3 and argon2 0.45.1. Other supported Node operating systems retain
ordinary npm/native portability; this milestone does not certify untested OS lanes.
Service-free Wydgine has no mandatory native or canonical-service dependency.
Generated, licensed RE2JS 2.8.6 ships in the engine; esbuild/re2js are build inputs,
not installed-engine runtime imports.

Approved service implementations resolve with Node's createRequire anchored at
`<App root>/package.json`: install at that root or an explicitly trusted ancestor.
The existing loader checks metadata exports, package identity/version, canonical
manifest, publisher/trust, platform/API and explicit dependency bindings before
registration. No request or portable App installs providers. Missing or incompatible
implementations remain unavailable. The optional Gate facade resolves from the same
App ancestry only when a configured Gate integration actually uses it.

WydHosting depends on exactly `wydgine@0.3.0-alpha.13`. Search and Stream require that
same exact peer engine. An ordinary stable semver range does not admit this prerelease;
actual installs are verified with one physical engine, without nested incompatible
copies. Search now declares sanitize-html instead of borrowing root hoisting.

See [closure map](package-boundaries.md), [installation](isolated-installation.md),
and [verification](verification.md).

I5.5 retains worker protocol/process supervision; I5.6 Linux broker/accounts/cgroups,
private ingress and race-safe staging; I5.7 provider migration/cutover journal; I5.8
integrated qualification and a separately authorized publication decision. The prior
intermittent HTTP 500 class remains an open reliability risk, not a resolved defect.
