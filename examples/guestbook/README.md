# Guestbook declarative package — 0.2-P

Guestbook is server-authoritative and browser-POST-driven in the default web host.
It is an experimental alpha example, not installed in the base site. It installs
through Wydgine and activates under normal `npm start`. Use a disposable checkout
for experiments; uninstall and upgrade are not implemented.

Run the trusted installer, then follow its prompts:

```sh
node scripts/install-package.js examples/guestbook
npm start
```

The installer shows package requirements and requested authority for explicit
approval. It can enable the canonical WydStore already shipped with Wydgit, offer
compatible existing storage, or provision new JSON/SQLite storage under the
host-owned `.wydgit-data/` directory. Choose provider, approve provisioning, choose
Page/parent/slot/index from discovered destinations, review the complete plan, and
confirm applying it. Declining an approval writes nothing. No manual configuration,
data directory creation or policy JSON is needed for ordinary installation.
Open the chosen Page (http://127.0.0.1:3000/ for Home or `/contact/` for Contact)
and sign the Guestbook. Stop the host before installation and restart afterward.

For advanced non-interactive operation, the operator policy example lives **outside** the reusable package:
[`examples/guestbook-policy.example.json`](../guestbook-policy.example.json).
It provides explicit grants for Page `home` → `sections[1]` in the default App and
maps logical `entries` to host store `host-book`, collection `host-entries`.
Copy it to a private policy file, inspect the complete scopes, and adjust placement
and mapping for your App. Then run:

```sh
node scripts/install-package.js examples/guestbook --approval /path/policy.json
node scripts/install-package.js examples/guestbook --approval /path/policy.json --apply
npm start
```

The example policy references already-provisioned `host-book / host-entries`.
Automation can instead explicitly authorize infrastructure using the policy format
in [packages.md](../../docs/packages.md). Infrastructure approval is separate from
package permissions; no provider/path choice comes from the package.

Installation needs prospective visibility/edit authority over every template ID
(exact fixed IDs plus the approved `guestbook-entry-*` prefix),
plus the destination parent and existing direct slot occupants. Package runtime
grants are narrower and do not include Page-wide editing. See
[packages.md](../../docs/packages.md) for API, approval, atomic state and drift rules,
and [WydStore](../../docs/wydstore.md) for complete provider configuration.
Do not treat the supplied policy example as an automatic grant: operator review
is required before passing it to the trusted tool.

The package contains `manifest.json`, `prototypes.json`, `section.json`, `refresh.bas`
and `submit.bas`. Portable prototype methods create records using `NewId()`, query
entries, and construct up to 20 request-local entry Blocks using portable NEW and
Insert. The canonical entries Section is empty; rendering never persists App edits.
Construction requires the explicitly approved `object.instances.construct` capability
and exact `scopes.prototypes` grant for `divdev/guestbook-entry`. Dynamic object IDs
use `"guestbook-entry-" & NewId()` and the approved object wildcard. The Submit action runs only after normal
Form validation, clears on success, preserves invalid ordinary values, and shows
status. PasswordInput values, if added, follow normal platform redaction. Markdown
uses the existing safe renderer. Entries display in record-ID order; no pagination
or deletion UI is included. Each repeated valid POST creates a distinct record.

Fixed canonical instance IDs mean one installation only. Another install is rejected.
No privileged installation, host execution or server bootstrap file is needed.
Core prototypes are never rewritten. Host configuration changes only under the
operator-approved infrastructure plan.
Accepted App/catalog/resources publish in `content/installed-packages.json`.

The normal host supplies CSRF and Session checks. Automatic WydClient bootstrap and
client/server transport are outside this milestone. Only one active package principal
per Page is supported; independently approved grants are never combined.

`node --test test/guestbook-package.test.js` tests an uninstalled isolated site,
installation, ordinary host startup, CSRF, validation, repeated/concurrent submissions
and persistence across host restart. It does not require installing into this checkout. `test/hardening.test.js` repeats
interactive provisioning and real HTTP acceptance for JSON and SQLite on Contact,
then explicitly restores the disposable fixture and reloads all three base Pages.
