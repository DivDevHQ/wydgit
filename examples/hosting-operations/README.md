# Local persistent multi-site operations

From the repository with Node >=22.12 and installed dependencies:

```sh
node examples/hosting-operations/run.js init /tmp/wyd-hosting-local
node examples/hosting-operations/run.js start /tmp/wyd-hosting-local
curl --resolve alpha.localhost:8080:127.0.0.1 http://alpha.localhost:8080/
curl --resolve beta.localhost:8080:127.0.0.1 http://beta.localhost:8080/
curl --resolve soon.localhost:8080:127.0.0.1 http://soon.localhost:8080/
```

Init requires a nonexistent directory and installs the existing WBasic Taskboard
independently in Alpha and Beta. Start retains state on disk, prints a sanitized
snapshot and binds one private listener. SIGINT/SIGTERM performs bounded cleanup;
repeat start for a new lifetime. It does not reinstall packages at restart. Default
root is ignored `.hosting-local`. This is a local development fixture with trusted
package provenance and a link to this checkout's dependencies, not a package
signature or production provisioning service. No live secrets are included.

Run the separate stopped local relocation demonstration:

```sh
node examples/hosting-operations/relocate.js
```

It creates disposable Host A/B roots, installs packages, stops Alpha, snapshots and
restores it, supplies destination dependencies, approves destination routing and
executes installed WBasic. The integration tests additionally prove persistent data
and continued sibling operation. It removes only its own disposable fixture.

See [operator guide](../../docs/hosting-operations.md) and
[I3 contract](../../docs/milestones/0.3-I3/README.md) for limits and API-driven relocation.
`Caddyfile` is an unexecuted reference with supplied certificate paths; do not run
it unchanged or expose the local-http backend publicly.
