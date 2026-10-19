# Read-only operational notices

An ordinary installed administrative Wydgit, independent of the member-roster
package. It contributes **operations → Operational notices** through manifest data
and the existing fixed WydStore `query` operation. No shell registration code,
package JavaScript, native package-manager export or new service facade is needed.
Package inventory is not offered: no suitable canonical read-only package-status
service exists, and native lifecycle APIs remain separately trusted.

The package requests only `store.records.read` on logical `notices`. It requires
live `operations.notices.read`, independently approved SEAM grants, exact accepted
installation/generation and this site's package-owned Store mapping. The separate
member roster uses `gate.members.manage`; neither permission grants the other.
Inputs cannot choose another site's identity, a native service or host policy.

## Reproducible disposable qualification

From the checkout on Node 24.21.0:

```sh
node --test test/backoffice-modules.test.js
node scripts/verify-backoffice-browser.js
```

The first command runs JSON and SQLite installation, independent revocation,
removal/reinstall, Store ownership and cross-site tests. The second builds a new
private JSON App, installs both administrative modules and the existing membership
login package, and drives real Chrome login/roster/notices/logout through loopback.
It explicitly provisions disposable test memberships and independently approves
both packages in trusted fixtures. Passwords are randomly generated in memory,
never printed or committed. Native fixture seeding temporarily assigns a separate
`operations.notices.write` permission and independently supplies a Store-create
capability to trusted test code. That permission is removed after seeding; the
ordinary installed package never receives create/write authority.

The harness deletes the browser profile, App, identities and Store data on exit.
Only sanitized measurements and screenshots remain in its printed temporary
artifact directory. Delete that exact directory after reviewing evidence. No
privileged Linux changes, production data or public listener is involved.

## Existing locally provisioned development App

Use a disposable App and its existing trusted Gate provisioning procedure; no
administrator account or password is supplied by this package.

1. Before accepting packages, configure the canonical Gate/Store libraries and the
   existing membership login package using
   [documented local provisioning](../../docs/wydgate-membership.md#installation-bootstrap-and-demonstration).
   Configure a separate Store owned by this exact App, publisher `divdev`, package
   `divdev/backoffice-notices`, store `operations`, collection `notices`, with the
   manifest's exact fields. The native `noticeStore({app,root,provider})` factory in
   `configuration.js` provides the complete sample definition for JSON or SQLite;
   `root` is a separate private test-data directory chosen by the operator. Its
   query rule requires BackOffice and `operations.notices.read`; its create rule
   separately requires BackOffice and `operations.notices.write`. Missing operations
   deny. The sample is package-owned storage under current platform conventions;
   it does not turn the store into a host inventory database.
2. For an already accepted App, stop/drain and use the existing reviewed native
   configuration/package-policy workflow. Do not edit accepted files to bypass
   `PACKAGE.DRIFT`, silently migrate data or change physical mappings in place.
   Review all effective ownership, scopes and provider paths before installation.
3. Inspect `manifest.json`, `prototypes.json` and `section.json`. Independently review
   and save the manifest's `permissions` object as `REVIEWED_NOTICES_GRANTS.json`.
   Review and save the resource mapping as a separate JSON file:
   `{"notices":{"store":"operations","collection":"notices"}}`.
4. With the App stopped, run:
   `node examples/backoffice-notices/install.js APP_ROOT REVIEWED_NOTICES_GRANTS.json REVIEWED_MAPPINGS.json`.
   Install the separate member-roster package with its own reviewed approval file:
   `node examples/backoffice-members/install.js APP_ROOT REVIEWED_MEMBER_GRANTS.json`.
   These are native checkout tools, not package-executable resources. They install
   accepted ordinary packages into dedicated trusted BackOffice placements and
   never configure accounts, approve policy expansion or issue Gate permissions.
5. Through the documented independently authorized local operator procedure, give
   an intended existing active administrator membership its explicit
   `gate.members.manage` and `operations.notices.read` permissions. Identity/role
   alone grants neither SEAM capability. Any test notice creation separately needs
   exact Store ownership, a native create capability and the current write permission;
   no write action or editor is contributed here. Empty notices are a valid result.
6. Launch only on loopback with the existing native host:
   `node examples/backoffice-members/serve.js APP_ROOT 3100`.
   Open the existing membership login page on `http://localhost:3100`, authenticate
   normally, then open `/backoffice`. Both categories should appear through discovery.
7. Invoke Site members with an optional limit. Select Operational notices and enter
   `store=operations`, `collection=notices`, `limit=5`. Optionally include `sort`,
   add an item with `field=title`, `direction=asc`, and run. Results are bounded
   record ID/version/data snapshots, not live host health or package inventory.
   Unsupported fields/directions fail the canonical Store validator. No automatic
   next page or mutation retry is performed.
8. Revoke only one permission through the trusted operator procedure and Refresh:
   the other module remains available. For removal, stop/drain and use the existing
   native package lifecycle uninstall operation for just that package; restart the
   host. Retention keeps package-owned data, not execution authority. Reinstall
   produces a fresh reference; old references must fail.
9. Stop the listener and close registries before cleanup. Uninstalling retains data
   under normal lifecycle rules; use separately authorized purge only when desired.
   Delete only a deliberately disposable App/test-data directory after stopping it.

The example has no AccountAdmin, HostAdmin, native RPC, filesystem handle, SQL,
package-policy approval, credential-management action or automatic administrator
grant. See [browser qualification](../../docs/backoffice-browser-qualification.md)
and [UI contracts](../../docs/backoffice-ui-usability.md). ADM-01 remains partial.
