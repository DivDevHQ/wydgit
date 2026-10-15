# Local shared-host example

Requires the repository's Node version and installed dependencies (`npm ci`).
From the repository root:

```sh
node examples/hostname-host/run.js
```

Open the printed `alpha.localhost` and `beta.localhost` URLs on the **same port**.
Each App has its own installed WBasic Taskboard, selected page, services and
Session owner. The small routing form executes compiled SEWN and displays its
submitted value for that response; this is not durable Taskboard editing.
Open `soon.localhost`, `parked.localhost`, or `new.sites.example.localhost` for the
ordinary canonical parking App. An unrelated hostname is rejected. Modern Chrome
resolves `.localhost` to loopback; no public DNS is needed. Ctrl+C disposes all
Apps and removes the example's temporary roots.

`setup.js` explicitly provisions the three roots and validated host inventory.
`taskboards.js` uses the existing WBasic family compiler and package plan/apply
installer with independent host approvals. There is no package JavaScript behavior,
automatic directory discovery, production key, TLS provisioning or deployment.

For actual Chrome plus a disposable local HTTPS proxy test:

```sh
node scripts/verify-hostname-browser.js
```

This requires Chrome and OpenSSL. It creates a one-day self-signed test certificate
in a temporary directory and starts a fresh headless browser with a certificate
validation exception. TLS traffic and Secure-cookie behavior are real; public CA
trust, DNS ownership and production certificate management are not tested.
See the [I1 contract](../../docs/milestones/0.3-I1/README.md) for proxy sanitation,
exact peer trust, host-only credentials, CSRF and public deployment responsibilities.

## Resource-governance demonstration

```sh
node examples/hostname-host/governance.js
```

This disposable scenario assigns limited and standard technical resource profiles
to the same installed WBasic Taskboard family. It holds a real canonical Files call,
verifies overload and sibling survival, releases capacity, exhausts an exact outbound
payload allowance, prints sanitized host snapshots, then stops and cleans up.
It exits automatically and requires no external services. It is not a pricing plan,
durable usage ledger or CPU/bandwidth benchmark. See the
[I2 contract](../../docs/milestones/0.3-I2/README.md) for exact accounting semantics.
