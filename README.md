# Wydgit

Wydgit is an experimental application platform built around reusable, independently
packaged components called **Wydgits**. Components share a canonical object model:
typed properties, inheritance, interfaces, owned children, methods and events.

Authors can write WBasic and compile it to **SEWN**, the language-neutral execution
representation. **SEAM** checks the authority supplied by the host: being installed,
having a valid publisher signature or calling another component does not grant
capabilities. Portable application code receives controlled facades rather than
JavaScript, DOM objects, SQL or native filesystem access.

**Wydgine** executes server applications. **WydClient** executes a supported portable
subset on ordinary static websites, without Wydgine, a database or Node at runtime.
Both use the same SEWN executor and canonical object kernel. Their presentation and
service profiles differ explicitly.

## Why use it?

- Compose reusable objects with explicit ownership and package boundaries.
- Author classes, typed methods, lifecycle hooks and events in WBasic.
- Use declarative presentation, including native browser controls and bounded keyed lists.
- Keep service implementations behind canonical APIs and separately approved capabilities.
- Build deterministic CLIENT packages and verify signed browser distributions under host policy.

This is alpha software, not a production-readiness or independent security-audit
claim. KISS/KICK means simple authoring surfaces with enforcement in the kernel.

## Quick start: a WBasic component on a static page

Use **Node.js 24.21 or newer** and npm for the complete workspace development
workflow. Some individual packages support Node 22.12; WydFiles requires 24.21.
Native Argon2/SQLite modules need a supported prebuilt binary or a native build toolchain.
Python 3 below is just a convenient static HTTP server.

```sh
git clone --branch develop/0.3 https://github.com/DivDevHQ/wydgit.git
cd wydgit
npm ci
npm run build:client
node scripts/build-client-package.js examples/hello-client/build.json examples/hello-client/generated example
python3 -m http.server 8080 --bind 127.0.0.1
```

Open [http://127.0.0.1:8080/examples/hello-client/](http://127.0.0.1:8080/examples/hello-client/)
and activate **Say hello** with the mouse or keyboard. The displayed state changes
to “Hello from SEWN!” through a compiled method, with no application JavaScript.
The complete [source](examples/hello-client/hello.bas) is:

```basic
PUBLIC CLASS Hello EXTENDS wydgit.core/section
    META Id = "example/hello"
    PUBLIC PROPERTY Message AS String = "Ready."
    PUBLIC SUB Greet()
        Me.Message = "Hello from SEWN!"
    END SUB
    PRESENTATION CLIENT
        HEADING "Hello Wydgit"
        BUTTON Greet LABEL "Say hello" CALL Greet
        STATUS Message VALUE Me.Message
    END PRESENTATION
END CLASS
```

The explicit [build inventory](examples/hello-client/build.json) declares CLIENT,
package identity, source files and entry. The final CLI argument is an independent
local publisher approval. The generated registry uses the existing browser package
contract. [host.js](examples/hello-client/host.js) is trusted local-development
configuration: it separately approves the publisher, exact action and edit scope.
It implements no application behavior. Do not adopt sample trust as a production default.
Third-party deployment requires reviewed origins, trusted publisher keys, integrity,
signatures and exact package/version execution approval; see [client authoring](docs/milestones/0.3-H4/README.md).

Stop the static server with Ctrl+C. Generated output is ignored and can be rebuilt.
Only static files and a modern browser are needed after the developer build.
For a larger example, build and serve the [interactive Taskboard](examples/wbasic-taskboard/README.md).

## Architecture

```text
WBasic source → shared definition IR → canonical prototypes + SEWN
                                      ↓ host approval / SEAM
                         Wydgine                 WydClient
                         server                  browser / WydSUB roots
                         services + HTTP         native controls + static hosting
```

| Component | Implemented role |
| --- | --- |
| Wydgit | Canonical prototype and instance model, typed members, composition and lifetime |
| WBasic | Compiler frontend; SERVER default and explicit CLIENT family builds |
| SEWN | Validated bounded execution, methods, static helpers and typed events |
| SEAM | Host-issued contexts, visibility, capability, resource and scope enforcement |
| Wydgine | Node server execution, Hono HTTP adaptation, server presentation and service dispatch |
| WydClient / WydSUB | Standalone classic browser script; isolated document/embedded roots; protocol 0.1 |
| WydGate | Local identity, sessions, App membership, recovery and server browser-auth flows; identity is not SEAM authority |
| Canonical services | WydStore, WydSearch, WydFiles and WydStream through approved server library bindings |

## Current capabilities and boundaries

Current versions are **Wydgine/platform 0.3.0-alpha.8**, **WydClient 0.1.0-alpha.8**
and **WydSUB 0.1**. WBasic/component contracts are implemented through 0.20;
the language reference also contains clearly marked future proposals. These are
separate version axes. Historical browser artifacts remain immutable.

SERVER supports service-backed applications, HTTP forms, routing, sanitized Markdown,
file/media delivery and installed declarative packages. CLIENT supports authenticated
SEWN components, all five lifecycle hooks, typed events/subscriptions, scalar bindings,
bounded keyed repetition and native labels, buttons, text/textarea, checkbox, select,
forms and accessible feedback. Inputs are drafts; validated submission invokes an
explicitly approved public action. No raw browser event enters SEWN.

Client code has no general network, storage, DOM or Server/Session facade. Browser
Markdown stays literal. CLIENT controls are not server HTTP forms. Same-realm host
JavaScript is trusted; cross-origin iframe isolation is not implemented. There is no
browser compiler. Packages cannot self-approve authority.

WydStore has JSON/SQLite providers; WydFiles has local/S3-compatible providers;
WydSearch uses WydStore; WydStream uses bounded media metadata and binary storage.
These are server capabilities, not implicit WydClient services. Recovery is specific
to each implemented subsystem, not a general backup service. Canonical libraries are
workspace packages, not a public registry or automatically installed npm extensions.

The local server installer supports staged installation and failure recovery.
General upgrade/uninstall/migration, multi-App hosting, platform administration,
an installable CMS, remote embedding, other source languages and native runtimes
remain future work. The browser signed envelope and the proposed general `.wydpkg`
ZIP format are distinct; the latter is not the current installer.

## Documentation and examples

- [Development rules](docs/DEVELOPMENT.md) and [founding architecture](docs/FOUNDING-ARCHITECTURE.md)
- [Canonical objects](docs/canonical-oop.md), [object model](docs/object-model.md), [mutation](docs/mutation-model.md)
- [WBasic implemented guide](docs/wydbasic.md) and [language reference](docs/wbasic-language-ref.md)
- [SEWN](docs/sewn.md), [SEAM](docs/seam.md), [components](docs/components.md), [events](docs/events.md)
- [WydClient](packages/wydclient/README.md), [H4 controls and CLIENT authoring](docs/milestones/0.3-H4/README.md)
- [Local server packages](docs/packages.md), [browser packages](docs/wydclient.md), [distribution architecture](docs/wydgit-package-distribution.md)
- [WydStore](docs/wydstore.md), [WydSearch](docs/wydsearch.md), [WydFiles](docs/wydfiles.md), [WydStream](docs/wydstream.md), [WydGate](docs/wydgate-membership.md)
- [Guestbook](examples/guestbook/README.md), [Taskboard](examples/wbasic-taskboard/README.md), [search](examples/search/README.md), [media](examples/media/README.md)
- [H5 inventory and findings](docs/milestones/0.3-H5/review.md), [verification](docs/milestones/0.3-H5/verification.md), [changelog](CHANGELOG.md)

To run the tracked server sample (Home, About, Contact), use `npm start` and open
http://127.0.0.1:3000/. Services are disabled until explicitly configured. See the
Guestbook walkthrough before installing anything; use a disposable copy because
uninstall is not implemented.

## Testing and contributing

```sh
npm test
npm run test:client
npm run check
node packages/wydclient/browser-smoke.js
node packages/wydclient/browser-controls.js
```

Chrome fixtures require local sockets and Google Chrome (`WYDCLIENT_CHROME` can
select the control runner's executable). `npm test` uses ordinary process isolation;
H3/H4 serial verification history is preserved in their reports. Content checks cover
the rendered sample site, not every Markdown link. See [H5 verification](docs/milestones/0.3-H5/verification.md)
for exact commands, requirements and evidence.

Follow [development rules](docs/DEVELOPMENT.md), preserve canonical authority
boundaries, add focused regressions for defects and update the relevant contracts.
There is no separate contribution agreement or dedicated CONTRIBUTING guide in this
repository. Discuss changes through the repository's normal issue/pull-request process.

## Project status and roadmap

Wydgit 0.3 is under development. A–G established canonical services, storage,
search, media/files and identity/membership. H0–H4 added canonical OOP, independent
WydSUB roots, browser execution, controls and CLIENT authoring. H5 consolidates
contracts, tests and documentation. See the [review](docs/milestones/0.3-H5/review.md).

Next are I: Multi-App Hosting; J: Platform/App Administration; K: Installable CMS;
and L: integration, independent security audit, hardening and prerelease. These are
planned milestones, not existing features or a Wydgit 0.3 final release.

## License

[Mozilla Public License 2.0](LICENSE) (MPL-2.0). See the license text for obligations
on modifications to covered files and combining them with separately licensed code.
