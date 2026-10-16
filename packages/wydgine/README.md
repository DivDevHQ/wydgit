# Wydgine

Wydgine runs canonical Wydgit Apps. Version 0.3.0-alpha.14 is a private,
locally packed development artifact; it has not been published to npm.
Requires Node >=24.21.0. No WydHosting or Linux hosting installation is required.

Install a verified local tarball in a consumer directory:

```sh
npm install /verified/path/wydgine-0.3.0-alpha.14.tgz
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
