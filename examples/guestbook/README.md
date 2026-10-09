# Guestbook declarative package — 0.2-P

Guestbook is server-authoritative and browser-POST-driven in the default web host.
It installs through Wydgine and activates under normal `npm start`.

1. Create a private existing data directory and enable the already installed
   WydStore library in `wydgit.config.json`. Preserve other stores/configuration.
2. Configure a store owned by App `boilerplate`, publisher `divdev`, package
   `divdev/guestbook`, with collection fields `name` and `message`, both required
   strings. Provider and root are operator choices; the package does not provision them.
3. Create a host approval JSON file with the four fields shown below. Review requested
   permissions in `manifest.json` and copy them into `approvals` only after approval.
4. Run `node scripts/install-package.js examples/guestbook --approval /path/policy.json`
   to inspect the plan. Add `--apply` to install.
5. Run `npm start`, open http://127.0.0.1:3000/, and sign the Guestbook.

The operator policy example lives **outside** the reusable package:
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

For the example policy, the enabled WydStore entry needs these `options` (replace
`/srv/wydgit-data` with your private existing directory):

```json
{
  "stores": [{
    "id": "host-book", "app": "boilerplate", "publisher": "divdev",
    "package": "divdev/guestbook", "provider": "json", "root": "/srv/wydgit-data",
    "collections": [{"id": "host-entries", "fields": {
      "name": {"type": "string", "required": true},
      "message": {"type": "string", "required": true}
    }}]
  }]
}
```

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
entries, and render up to 20 entry Blocks. The Submit action runs only after normal
Form validation, clears on success, preserves invalid ordinary values, and shows
status. PasswordInput values, if added, follow normal platform redaction. Markdown
uses the existing safe renderer. Entries display in record-ID order; no pagination
or deletion UI is included. Each repeated valid POST creates a distinct record.

Fixed canonical instance IDs mean one installation only. Another install is rejected.
No privileged installation, host execution or server bootstrap file is needed.
Core prototypes and host configuration are never rewritten by the installer.
Accepted App/catalog/resources publish in `content/installed-packages.json`.

The normal host supplies CSRF and Session checks. Automatic WydClient bootstrap and
client/server transport are outside this milestone. Only one active package principal
per Page is supported; independently approved grants are never combined.

`node --test test/guestbook-package.test.js` tests an uninstalled isolated site,
installation, ordinary host startup, CSRF, validation, repeated/concurrent submissions
and persistence across host restart. It does not require installing into this checkout.
