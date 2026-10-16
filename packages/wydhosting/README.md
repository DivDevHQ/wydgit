# WydHosting

Private local development package 0.3.0-alpha.15, requiring exactly Wydgine
0.3.0-alpha.15 and Node >=24.21.0. Wydgine runs Apps; WydHosting operates hosting
infrastructure. No public npm publication is claimed.

```sh
npm install /verified/path/wydgine-0.3.0-alpha.15.tgz /verified/path/wydhosting-0.3.0-alpha.15.tgz
./node_modules/.bin/wydhosting inspect --directory /absolute/private/state --fixture-root /absolute/disposable/fixture
```

The root export provides `createSupervisor` plus the trusted registry/planning facade; `./contracts`
provides closed provider record validation, and `./package.json` exposes metadata.
Registry bootstrap is explicit through `createRegistry(...).initialize(...)`.
The CLI supports inspect, validate, plan, apply and reconcile. Applying requires
exact operation/digest approval from an already trusted local operator.

This version preserves registry/journal/replay and canonical Wydgine inventory
validation. Its local fixture adapter records provider intent. The same-UID supervisor starts installed Wydgine workers with bounded inherited IPC,
readiness and crash recovery. The additional Linux backend uses a separately installed
root-reviewed broker, restricted systemd units, immutable byte-verified staging and
credential-checked Unix ingress. It is **experimental and unqualified**. Live firewall
transactions, automatic resource retirement and privileged VM integration remain
incomplete. No production-ready result is emitted.

`wydhosting setup` is read-only preflight. `wydhosting setup --input /absolute/input.json`
prints a candidate approval; neither command provisions anything. `serve --config`
requires protected administrator-installed configuration and a nonroot provider UID.
Root-only broker code, reviewed systemd/Caddy assets and self-contained Linux operator
documents ship in `broker/`, `templates/`, `docs/`. Read [the Linux guide](docs/README.md)
and [VM installation/recovery](docs/service-and-cgroups.md) before considering use.
No root npm installation, privilege escalation, public deployment or live firewall
mutation is performed by setup.

MPL-2.0; see LICENSE. `npm install wydhosting` is a future public-registry command,
subject to separate publication qualification and authorization.

Use `registry.supervisorStateDirectory` (explicit private 0700 directory) with
`createSupervisor`. Start only approved pools, read `inspectPool`/`readHealth`/`health`,
stop with `stopPool`, and always await `shutdown()` in `finally`. `recoverPool` resets
a stopped crash-loop budget only after operator diagnosis. The repository milestone
`docs/milestones/0.3-I5.5` documents the protocol, example, ownership recovery and
mandatory I5.6 cross-UID/private-ingress/orphan-cleanup gates.
