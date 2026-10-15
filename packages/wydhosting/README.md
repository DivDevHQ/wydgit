# WydHosting

Private local development package 0.3.0-alpha.13, requiring exactly Wydgine
0.3.0-alpha.13 and Node >=24.21.0. Wydgine runs Apps; WydHosting operates hosting
infrastructure. No public npm publication is claimed.

```sh
npm install /verified/path/wydgine-0.3.0-alpha.13.tgz /verified/path/wydhosting-0.3.0-alpha.13.tgz
./node_modules/.bin/wydhosting inspect --directory /absolute/private/state --fixture-root /absolute/disposable/fixture
```

The root export provides the existing trusted registry/planning facade; `./contracts`
provides closed provider record validation, and `./package.json` exposes metadata.
Registry bootstrap is explicit through `createRegistry(...).initialize(...)`.
The CLI supports inspect, validate, plan, apply and reconcile. Applying requires
exact operation/digest approval from an already trusted local operator.

This version preserves registry/journal/replay and canonical Wydgine inventory
validation. Its local fixture adapter records provider intent and cannot provision
Linux, supervise workers, serve Apps, stage deployments or certify production safety.
There is no provider setup wizard. Use private disposable state and fixture roots.

MPL-2.0; see LICENSE. `npm install wydhosting` is a future public-registry command,
subject to separate publication qualification and authorization.
