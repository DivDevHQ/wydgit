# Two Apps in one trusted Wydgine process

From the repository root, with dependencies installed:

```sh
node examples/multi-app/run.js
```

Open the two printed loopback URLs. Each listener is explicitly selected by trusted
host code before any session/authentication, assets or Page execution. Both Apps
use the same local Page IDs, publisher/package names and logical resources, with
distinct canonical App IDs and confined local data directories. This is not hostname
routing. Different loopback ports do not provide browser cookie-origin isolation;
wrong-App authenticated cookies are rejected rather than treated as another App's
identity. Domain/HTTPS/proxy policy belongs to I1.

Ctrl+C stops both Apps and removes only this run's temporary directories. No source
or tracked installation is modified. The generated config enables local Store,
Gate (open registration for this disposable example), Files, Search and legacy local
Stream providers. This is explicit local development configuration, not a production
policy. No private credentials are shipped.

`setup.js` provisions the example through existing canonical library contracts.
The automated multi-App suite uses it plus the existing installer to prove the same
WBasic Taskboard package operates independently in two Apps. See the
[I0 contract](../../docs/milestones/0.3-I0/README.md) for authority, lifecycle and limits.
