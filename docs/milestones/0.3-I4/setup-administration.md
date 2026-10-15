# Setup and administration contracts

All commands below are I5 target UX. No wizard, bin or management service is implemented
in I4. Current `npm start` runs `node server.js` at repository root and ignores App
arguments. Existing sample origins and data roots stay unchanged until explicit migration.

## Standalone npm contract

```sh
mkdir -p /some/path/wydgine
cd /some/path/wydgine
npm install wydgine
npx wydgine setup
npm start
npm start -- apps/brained.com
npm start -- apps/libundance.com
npm start -- apps/m3project.com
```

Each start selects exactly one App in an independent process. `setup` creates/merges
the consumer's own package.json after preview and approval; dependency scripts are
not inherited. Example generated manifest (version placeholders are replaced with
actual verified exact releases, not literal publishable versions):

```json
{
  "name": "my-wydgine-installation",
  "private": true,
  "scripts": {"start": "wydgine start"},
  "dependencies": {"wydgine": "<verified-exact-version>"}
}
```

Package metadata: `bin: {"wydgine":"./bin/wydgine.js"}`, executable Node shebang.
`wydgine setup [--directory <absolute-path>]`, `wydgine start [app-path] [--config
<path>]`, `wydgine validate [app-path]`. Reject unknown options, extra positionals,
empty/invalid paths and unknown config versions. Direct CLI paths resolve against
invocation cwd; npm scripts run at consumer package root, including invocation from
its subdirectory. Config paths inside config resolve against config's own directory,
never package installation location. Do not select Apps relative to node_modules or
silently use `INIT_CWD`; report effective base locally for operator diagnostics.

Generated trusted launcher config `wydgine.local.json`:
`{schema:"wydgine.launch/1",appsDirectory:"apps",defaultApp:null,
listener:{host:"127.0.0.1",port:3000},setup:{enabled:false}}`.
`defaultApp`, when nonnull, is an explicit path; ordinary App config stays the existing
`wydgit.config.json`. Malformed selected launcher or App configuration is fatal even
if an explicit CLI App was supplied; CLI selection overrides a valid configured default,
not validation. Require one validated canonical App before a listener opens.

Selection order:

1. Explicit CLI path, canonicalize and validate expected App structure/catalog/recovery.
   Invalid path exits nonzero; never fallback.
2. Explicit configured default, resolved against config directory; invalid default fails.
3. No default and stdin+stdout TTY: bounded one-level discovery of real children of
   configured appsDirectory only, excluding symlinks/hidden dirs. Maximum 128 candidates;
   overflow asks for explicit path, no truncation. Show validated local candidates with
   display title plus canonical App ID; duplicate identities/ambiguous roots reject.
   Directory name is only a label. Select/cancel, revalidate before start; saving a
   default is separate consent. Even a single candidate requires selection.
4. No TTY/selection: exit with safe `APP_SELECTION_REQUIRED`, unless operator explicitly
   enabled secure restricted local setup. Never start the first directory or sample.

Discovery has no recursive filesystem scan, arbitrary package import or automatic
installation. A canonical App with malformed configuration is not silently eligible.
TTY controls presentation only; it is never operator authentication.

The [npm start](https://docs.npmjs.com/cli/v11/commands/npm-start/) and
[package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
contracts require the consumer script and bin. The I4 fixture verifies forwarding,
local bin resolution, package-root cwd, npm exec setup and missing inherited setup
script entirely offline. Its mock bin does not validate a future published package.
`npx` may fetch a missing package: setup instructions must verify the installed local
release first; managed production uses pinned local binaries and no opportunistic download.

## Compatibility and optional headless setup

Keep repository `server.js` and root `npm start` behavior during I5; retain legacy
`createApp`/`createHostApp` imports. A migration command previews explicit root default
and existing HOST/PORT behavior, writes backed-up launcher config and offers script
change only with consent. New installs opt into `apps/`; never move existing content,
change HTTP origin, drop service roots or reinterpret existing scripts automatically.

Restricted HTML setup is optional and deferred beyond initial CLI implementation.
Default is disabled. When enabled by a trusted operator, bind literal loopback only,
refuse wildcard/public binds or reverse-proxy forwarding, strict Host/Origin allowlist,
no CORS, CSP/no-store and session-bound CSRF on mutations. DNS rebinding and local
untrusted users remain threats even on loopback. Require a short-lived one-use random
256-bit bootstrap credential from an already authorized operator terminal or 0600
credential file (no stdout service logs, URL query, access log or referer leakage).
Exchange via POST for HttpOnly SameSite=Strict session; restrict tries, expire in ten
minutes, consume once and close bootstrap listener on completion. Remote operator
uses an authenticated SSH tunnel plus the credential; tunnel/TTY is not itself the
web authorization check. If token delivery, local identity or origin cannot be made
secure, fail closed with CLI instructions. Anonymous responses show no App names,
paths, config, inventory or install controls. Local user threat must be reviewed; no
assumption that every localhost caller is trusted. No I4 wizard implementation.

## WydHosting installation and shared engine

```sh
mkdir -p /some/path/wydhosting
cd /some/path/wydhosting
npm install wydhosting
npx wydhosting setup
npm run start:hosting
```

`bin: {"wydhosting":"./bin/wydhosting.js"}`; setup adds only
`"start:hosting":"wydhosting serve"` to consumer scripts and exact verified dependency.
Preserve any `start` byte-for-byte; conflicts require explicit reviewed alternative,
never overwrite. No `install` lifecycle wizard, postinstall account/firewall changes or
root npm execution. `wydhosting validate`, `plan`, `apply --plan <id>`, `serve`,
`status`, `recover --operation <id>` are proposed verbs. Native production starts the
same nonroot service through systemd, not an interactive npm terminal requirement.

One trusted setup/configuration engine consumes typed input and exposes versioned
`wydhosting.admin/1` host-only methods:

| Operation family | Narrow contract |
| --- | --- |
| `setup.inspect/plan/validate/apply/reconcile` | Read preflight, produce immutable plan+digest+expected revision, separately authorize application, record outcomes |
| `registry.registerApp/associateDomain/assignPlacement` | Customer/App/domain approvals and ownership checks; stage approved snapshots; never infer grants |
| `pool.start/retire/inspect` | Approved registry pool ID/revision; supervisor lifecycle only, no raw process args |
| `operations.health/capacity` | Operator-scoped redacted snapshots, OS observations separately labeled |
| `migration.plan/execute/reconcile`, `recovery.inspect/restore` | Journaled supported profiles, explicit exclusive owner and approved backup |
| `provision.request` | Signed/locally authenticated approved plan reference sent to narrow privileged broker, never arbitrary OS commands |

Request includes schema, operationId, expectedRevision and typed parameters. Trusted
caller authorization is a transport/service concern, not a user-supplied `operator:true`.
Results `{ok,operationId,revision,state,code}` use fixed codes and sanitized validation
issues; confidential details only through separately scoped operator diagnostics.
Interfaces are proposed, not public APIs today. Query/list endpoints are paginated and
bounded; audit records include actor, action, target, approved plan hash, revisions,
time and result, excluding secrets. Conflicting stale plans fail, not silently replan.

Setup states: `unconfigured → inspected → planned → authorized → applying →
verification-required → ready`; failure becomes `blocked` or `recovery-required`.
Ready requires supported isolation/proxy/firewall verification. Each operation journals
intent/outcome and can reconcile interruption. Frontends cannot skip validation or
convert unknown verification into success.

A future small shell bootstrapper verifies a pinned release using independently trusted
signature/digest, stages it unprivileged and invokes this same engine. No speculative
live URL. DEB/RPM integration, control panels and Almond recipes call the same engine,
not divergent shell configuration logic. Their upgrade/uninstall ownership must be
explicit; never delete unmanaged resources. Standalone cPanel/Plesk/Webmin adapters
can manage Wydgine without WydHosting if the existing provider already owns processes.

## Administration and J boundary

J can implement CLI/web UX over these operations with operator authentication, scoped
provider grants, MFA for remote privileged access, short-lived sessions, strict origin
checks, CSRF, secure cookies, reauthentication and explicit plan confirmation for
privileged/destructive changes. API clients require separately scoped credentials and
replay protection. Customer views expose only separately authorized customer records.

A Wydgit admin App receives a narrow SEAM-governed management service facade with
explicit host grants and action authorization. WydGate membership can establish a
subject, never Linux privilege, operator grants or SEAM capability. Admin App has no
raw Node/process/shell/filesystem/firewall/account/principal/context/token access.
Trusted broker rechecks authorization for every privileged action and audits denials.
Origin/CSRF are defense in depth, not substitutes for operator authorization. I5
implements trusted local contracts/CLI first; J owns full GUI/session/user experience.
