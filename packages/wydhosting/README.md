# WydHosting

Private local development package 0.3.0-alpha.14, requiring exactly Wydgine
0.3.0-alpha.14 and Node >=24.21.0. Wydgine runs Apps; WydHosting operates hosting
infrastructure. No public npm publication is claimed.

```sh
npm install /verified/path/wydgine-0.3.0-alpha.14.tgz /verified/path/wydhosting-0.3.0-alpha.14.tgz
./node_modules/.bin/wydhosting inspect --directory /absolute/private/state --fixture-root /absolute/disposable/fixture
```

The root export provides `createSupervisor` plus the trusted registry/planning facade; `./contracts`
provides closed provider record validation, and `./package.json` exposes metadata.
Registry bootstrap is explicit through `createRegistry(...).initialize(...)`.
The CLI supports inspect, validate, plan, apply and reconcile. Applying requires
exact operation/digest approval from an already trusted local operator.

This version preserves registry/journal/replay and canonical Wydgine inventory
validation. Its local fixture adapter records provider intent. The supervisor starts actual
installed Wydgine workers through a bounded inherited-IPC protocol, monitors readiness,
handles bounded crash recovery and confirms process death on shutdown. It cannot
provision Linux, stage deployments or certify production safety. All disposable
workers use the current development UID and loopback fixture endpoints.
There is no provider setup wizard. Use private disposable state and fixture roots.

MPL-2.0; see LICENSE. `npm install wydhosting` is a future public-registry command,
subject to separate publication qualification and authorization.

Use `registry.supervisorStateDirectory` (explicit private 0700 directory) with
`createSupervisor`. Start only approved pools, read `inspectPool`/`readHealth`/`health`,
stop with `stopPool`, and always await `shutdown()` in `finally`. `recoverPool` resets
a stopped crash-loop budget only after operator diagnosis. The repository milestone
`docs/milestones/0.3-I5.5` documents the protocol, example, ownership recovery and
mandatory I5.6 cross-UID/private-ingress/orphan-cleanup gates.
