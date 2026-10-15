# WydHosting development adapter

Private repository workspace, platform `0.3.0-alpha.12`. Wydgine executes Apps;
WydHosting approves provider placement intent. This package is **not independently
installable**: its trusted imports still use the repository engine closure pending I5.4.

See [I5.3 contracts](../../docs/milestones/0.3-I5.3/README.md) for schemas, fixture
bootstrap, CLI commands, authorization, crash recovery and limitations.

`npm run wydhosting -- inspect --directory /absolute/private/state --fixture-root
/absolute/disposable/fixture` is read-only. There is no serve command, public
management listener, Linux provisioning, worker supervision or production-ready state.
