# I5.2 — Standalone App selection and setup

Platform remains **0.3.0-alpha.12**. One canonical engine, one selected App per
standalone process. WydHosting is optional and is not imported by the launcher.
This is a working **development-engine CLI**, not an independently installable npm
release. The private `packages/wydgine` bin still imports repository source. I5.4
must extract the complete metadata, native dependency, compiler and runtime asset
closure and verify real isolated tarball installs before published-install claims.

## Historical repository startup

At repository root, `npm start` still runs `node server.js`, serving the historical
sample with existing HOST/PORT behavior. Its positional arguments remain ignored.
No App content/data, service paths, origins or deployment settings are migrated.
Use the new CLI explicitly in this checkout:

```sh
npm run wydgine -- --help
npm run wydgine -- validate /absolute/path/to/existing-app
npm run wydgine -- start /absolute/path/to/existing-app
```

## Standalone command contract

```text
wydgine setup [--directory <absolute-path>]
wydgine start [app-path] [--config <path>]
wydgine validate [app-path]
wydgine --help
```

With the local bin available and existing canonical Apps in the consumer directory:

```sh
wydgine start apps/brained.com
wydgine start apps/libundance.com
wydgine start apps/m3project.com
```

Each invocation starts exactly one App in a separate Node process. Concurrent
processes need distinct configured listening ports and an appropriate external
reverse proxy. This launcher supports literal IPv4/IPv6 addresses and TCP ports
1–65535; approved Unix-socket ingress remains future work. Use separate `--config`
files for different listener assignments. A collision fails; no alternate port or
neighbor App is selected. HOST/PORT environment variables belong to the historical
entrypoint; the new CLI uses its validated listener configuration.

Paths supplied on the CLI resolve against invocation cwd. `--config` also resolves
against cwd. Paths stored in configuration resolve against that file's directory.
Consumer npm scripts run at the consumer package root, including `npm start` invoked
from its subdirectory. `INIT_CWD` and the package's node_modules location never choose
the App root. Spaces and Unicode paths are supported; quote them in the shell.
Canonical identity comes from validated App content, never directory spelling.

## Configuration and selection

Default `wydgine.local.json`:

```json
{
  "schema": "wydgine.launch/1",
  "appsDirectory": "apps",
  "defaultApp": null,
  "listener": { "host": "127.0.0.1", "port": 3000 },
  "setup": { "enabled": false }
}
```

Missing implicit configuration uses these safe defaults. An explicitly named missing
file, malformed/unknown fields/schema, invalid paths/listener, unsafe linked files,
or `setup.enabled:true` fails before listening. HTML setup is unsupported; it never
opens a browser/setup endpoint. A configured default must itself validate, including
when an explicit path overrides it. Invalid explicit selection never falls back.

Selection order: explicit CLI App, valid configured default, interactive terminal
choice, then safe headless `APP_SELECTION_REQUIRED`. Discovery occurs only with both
stdin and stdout TTY. It enumerates one level below appsDirectory, excludes hidden
and symlinked candidate directories, rejects more than 128 candidate directories
without truncation, validates each candidate through existing inventory/catalog/
recovery checks, and refuses duplicate canonical IDs. Invalid directories are omitted;
select an explicit path for a sanitized validation failure. Existing bounded canonical
tree validation still inspects each App's execution inputs; discovery does not recursively
search for additional Apps or import publisher JavaScript.

Even one candidate requires a numbered choice. `q`, `quit`, `cancel` or EOF cancels;
three invalid choices fail. Input and buffered lines are bounded. A separate yes/no
prompt controls saving the default. The selected App is revalidated after prompting
and before initialization; changed configuration/identity fingerprints fail. Ordinary
canonical services initialize through `createHostApp`, ready before the listener.
`validate` checks canonical/package/configuration integrity without starting services
or listening; runtime implementation availability is checked during `start`.

Startup has a 30-second process deadline. SIGINT/SIGTERM drain through existing
shutdown, with a five-second deadline before forced exit. Errors are fixed sanitized
messages with nonzero exits; cancellation exits 130. No shell execution, arbitrary
imports, new renderer/controller, SEAM grant mechanism or App-accessible launcher
configuration API is added. Selection grants no extra authority or host resources.

## Functional setup in a development consumer

The repository dependencies must already be installed as described by the root
development instructions. This controlled arrangement links the **actual private
adapter**, retaining the repository engine closure. It does not test npm extraction
and performs no remote download:

```sh
# Run first from the repository root.
repo="$PWD"
installation="$(mktemp -d /tmp/wydgine-consumer-XXXXXX)"
mkdir -p "$installation/node_modules/.bin"
ln -s "$repo/packages/wydgine" "$installation/node_modules/wydgine"
ln -s ../wydgine/bin/wydgine.js "$installation/node_modules/.bin/wydgine"
cd "$installation"
./node_modules/.bin/wydgine setup
npm start -- /absolute/path/to/an/existing-canonical-app
```

Setup reports the installation/configuration location, prompts for Apps directory,
offers keeping/selecting/entering/removing a default, asks for listener IP/port, previews
the launcher configuration and manifest changes, and requires save confirmation.
App creation is not implemented: configure an existing App. Existing trusted engine
installer/provisioning tools retain their current purpose; no alternate canonical App
creation workflow is invented here. Headless setup fails with terminal instructions.

Setup verifies the locally linked package metadata/bin/version against this adapter.
It writes the actual verified **0.3.0-alpha.12** dependency, `private:true` for a fresh
consumer manifest, and `scripts.start: "wydgine start"`. It preserves unrelated
metadata, scripts, dependencies and any existing lifecycle hooks without adding one.
A conflicting start script needs separate explicit replacement consent. Malformed
manifests fail; a Wydgine devDependency must be moved explicitly first. No npm install
is run. During development, retain the controlled links: this generated exact version
does not assert that an independently usable release is published.

Reruns validate the existing closed launcher schema and preserve its settings unless
changed through prompts; the default is kept unless explicitly changed. Both reviewed
file revisions are checked before saving. An exclusive `.wydgine-setup.lock` prevents
cooperating writers; an interrupted lock requires verifying no setup process is alive
before manual removal. Each file is written 0600 through a synced same-directory
temporary file and atomic rename, with a unique exact 0600 `.backup-*` copy of each
original and directory sync. The two-file operation is **not** a transaction. After a
partial error/interruption inspect both files, restore the desired matching backup
pair, remove a stale lock only after checking process ownership, then rerun setup.
Backups can contain private manifest metadata; retain them privately. No App data is
changed. Like existing inventory checks, these checks do not defeat hostile OS writers
that can replace trusted ancestry concurrently; production snapshot ownership and
race-safe staging remain later provider work.

Future verified independent installations will support the intended `npm install
wydgine`, local `wydgine setup`, then consumer `npm start` workflow. Dependency npm
scripts are not inherited. Do not rely on remote npx fallback or treat this development
adapter as a published package.

## Next phases

I5.3 owns provider registry and safe setup plans. I5.4 owns genuine packed installation.
No provider allocation, supervision, IPC, OS accounts/firewall/systemd, public management,
HTML wizard, migration or publication is included. Existing I0–I3 trusted multi-App
facilities remain intact. Versions stay alpha.12 because this is private launcher
infrastructure on the unchanged engine ABI; no release/version bump is required now.

See [verification](verification.md), [I5.1 boundary audit](../0.3-I5.1/dependency-audit.md)
and [I4 setup contract](../0.3-I4/setup-administration.md).
