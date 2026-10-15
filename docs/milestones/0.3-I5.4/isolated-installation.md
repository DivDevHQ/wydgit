# Independent local tarball installation

Run from the development checkout to create artifacts, then use separate consumer
paths. Node >=24.21.0 is required; npm 11.19.0 was verified. None of these commands
publish a package. Supply actual absolute paths in place of the examples.

```sh
mkdir -p /tmp/wydgit-tarballs
npm pack ./packages/wydgine --pack-destination /tmp/wydgit-tarballs
npm pack ./packages/wydhosting --pack-destination /tmp/wydgit-tarballs
```

## Standalone

```sh
mkdir -p /some/path/wydgine
cd /some/path/wydgine
npm install /tmp/wydgit-tarballs/wydgine-0.3.0-alpha.13.tgz
./node_modules/.bin/wydgine setup
npm start
```

Prepare an existing canonical App beneath the consumer (content, prototypes, public,
requirements, host configuration and any installed package catalog/resources).
Setup selects that App, listener and npm start script; it creates no App or providers.
Alternatively write the existing closed `wydgine.launch/1` configuration with an
explicit default App. Headless missing selection fails closed. Runtime files are
inside node_modules/wydgine; the App root never defaults to the engine directory.
Setup writes the verified exact development version into consumer dependencies;
retain the local artifacts and explicitly reinstall them for subsequent local installs.
No public registry availability is claimed by that exact version.

## Canonical services

Pack each local Wydgit implementation from the checkout, retaining private flags:

```sh
npm pack ./packages/wydstore --pack-destination /tmp/wydgit-tarballs
npm pack ./packages/wydgate --pack-destination /tmp/wydgit-tarballs
npm pack ./packages/wydsearch --pack-destination /tmp/wydgit-tarballs
npm pack ./packages/wydfiles --pack-destination /tmp/wydgit-tarballs
npm pack ./packages/wydstream --pack-destination /tmp/wydgit-tarballs
```

At the consumer installation root, install the engine and implementations together:

```sh
npm install /tmp/wydgit-tarballs/wydgine-0.3.0-alpha.13.tgz \
  /tmp/wydgit-tarballs/wydgit-store-0.1.0-alpha.3.tgz \
  /tmp/wydgit-tarballs/wydgit-gate-0.1.0-alpha.4.tgz \
  /tmp/wydgit-tarballs/wydgit-search-0.1.0-alpha.1.tgz \
  /tmp/wydgit-tarballs/wydgit-files-0.1.0-alpha.1.tgz \
  /tmp/wydgit-tarballs/wydgit-stream-0.1.0-alpha.1.tgz
```

Wydgit dependencies come from these tarballs. Commodity dependencies use normal npm
registry/cache resolution; this is not an offline-install claim. Native dependency
build/prebuilt requirements and npm install-script policy belong to the consumer.
The verified lane uses package-provided native binaries; no compilation requirement
was inferred from the repository's installed node_modules. Test-only Cheerio 1.0.0
is explicitly installed in regression consumers and is not an engine dependency.

Owner approval and canonical host configuration are still required after npm install.
Use consumer-local storage and disposable credentials for verification. Search/Stream
use the exact peer Wydgine instance; do not link sibling development directories.
Future publication order must qualify/name-review Wydgine first, then dependent
Search/Stream/WydHosting. Store/Gate/Files have independent npm closures; publication
readiness remains separate, especially private Files/Stream. No manifest was made public.

## Provider

WydHosting's exact dependency must be supplied locally until publication:

```sh
mkdir -p /some/path/wydhosting
cd /some/path/wydhosting
npm install /tmp/wydgit-tarballs/wydgine-0.3.0-alpha.13.tgz \
  /tmp/wydgit-tarballs/wydhosting-0.3.0-alpha.13.tgz
./node_modules/.bin/wydhosting inspect --directory /absolute/private/state \
  --fixture-root /absolute/disposable/fixture
```

Bootstrap the registry explicitly through the supported trusted createRegistry API
before inspect. No missing-registry fallback exists. I5.3's inspect/validate/plan/
apply/reconcile commands remain the complete provider CLI. Apply requires exact
approval and only supported registry intent changes are applied. No setup wizard,
worker supervisor or OS provisioning is complete.

`npm install wydgine` and `npm install wydhosting` describe the intended future public
experience after publication; they are not verified public-registry commands today.

## Repeatable proof

From the checkout:

```sh
node scripts/verify-packed-packages.js
```

The script prints a retained `/tmp/wyd-i54-packed-*` evidence directory containing
real tgz files, npm pack records, install logs, dependency graphs, executed test logs,
consumer manifests/lockfiles, resolved-path logs and result.json. It creates three
independent consumers. A synchronous Node resolution hook rejects every ESM/CommonJS
path under the original checkout, including subprocesses. App fixtures use approved
consumer ancestry; there are no repository/workspace links or NODE_PATH fallback.
Each consumer has exactly one physical installed engine. Tests/fixtures are explicitly
staged verification inputs outside installable tarballs, not hidden runtime sources.
