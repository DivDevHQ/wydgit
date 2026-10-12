# Declarative membership package

Install `manifest.json` through the existing package plan/apply or operator workflow
after a trusted host provisions WydGate and its private WydStore directory.
Approving installation grants no bootstrap or member-administration authority and
does not enable registration. Set trusted registration policy separately.

The package contains generic declarative login/register/logout/profile/password
forms, plus an administrator-controlled member-list prototype. It contains no
executable JavaScript, HTML or CSS in package resources. `demo.js` is trusted host
code, excluded from the manifest, and uses random disposable credentials.

Run `node examples/membership/demo.js json` or `node examples/membership/demo.js sqlite`.
Both install into a temporary App, bootstrap the owner, exercise actual HTTP forms,
CSRF/cookies/rotation/revocation and App isolation, then remove temporary storage.

See [the configuration, API, security and limitation contract](../../docs/wydgate-membership.md).
