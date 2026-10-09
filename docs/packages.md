# Native local packages — 0.2-P

Packages declare intent. Wydgine validates and applies it under host-approved
authority. Publisher identity is metadata; it does not approve a package or grant
SEAM permissions. No package JavaScript executes during installation or startup.

## Manifest

`manifest.json` uses the closed `wydgit-package/0.1` schema. See
[`examples/guestbook/manifest.json`](../examples/guestbook/manifest.json) for a complete
example. Required fields are `id` (publisher/name), `publisher`, semantic `version`,
`platform` range, `runtime` targets (server required), `resources`, `requires`,
`storage`, `permissions`, `bindings` and `installables`.

`resources` names one prototype JSON array, one canonical Section template, and a
map of named WydBASIC event sources. Prototypes may contain `behaviorSource`, which
compiles before registry construction. Stable qualified prototype IDs and fixed
instance IDs are preserved. Exactly one section-template installable and one
installation per package ID are supported. Placement belongs to the operator.
Resource paths are relative, nonhidden and bounded; traversal, absolute paths,
symlink resources/roots and JavaScript resources are rejected. Unlisted files are
never loaded. Local package paths are explicitly supplied by trusted operator code;
there is no package directory scan or automatic dependency installation.

`requires` is the existing `wydgit.requirements/0.1` library envelope. Libraries must
already be installed and host-enabled. `storage` declares `{name, fields}` logical
collections using WydStore field rules. It contains no provider, path, connection
string or credentials. `permissions` explicitly requests capabilities, traversal,
visible/editable object grants and logical `scopes.wydstore` resource names.

Bindings declare `owner`, `event`, named `source` and `kind`. For this milestone,
handlers are Page lifecycle events; actions are semantic events with `method:POST`
and a required `capability`. Each source declares exactly the bound EVENT. Existing
compiler, event registry and action validation remain authoritative. Server/Session
package lifecycle bindings and custom event definitions are deferred.

## Manifest, plan and receipt

The manifest describes reusable package intent. The plan resolves it against a
specific accepted App, catalog, host libraries, approvals, mapping and placement.
The receipt records the installation actually committed.

```js
import {planPackageInstall, applyPackageInstall} from '../wydgine/packages/index.js';
const plan = await planPackageInstall({
  root, packagePath,
  placement: {page: 'home', parent: 'home', slot: 'sections', index: 1},
  approvals, storageMappings, installationContext
});
// Inspect the frozen plan before committing under operator policy.
const receipt = await applyPackageInstall(plan);
```

`installPackage(options)` composes those two steps. Planning writes nothing and
never registers/provisions libraries. An original in-process plan is required for
apply; JSON plans are inspectable output, not executable authorization tokens.
`installationContext` must be a genuine host-issued ExecutionContext for the App,
with `object.instances.edit` and explicit visibility/edit grants for the parent,
existing slot occupants and every prospective template ID. It is independent of
the installed package's runtime grants. Attachment uses `runtime.edit().insertChild`
and canonical commit/hydration, including Form, object ID and containment rules.

Plans expose package/version/publisher, prototype IDs, instance/installable IDs,
placement, resource sizes/hashes, resolved libraries, requested/approved grants,
storage mappings, bindings and base/catalog fingerprints. Missing requested grants
fail closed; this first schema requires exact explicit approval rather than silently
activating a partially approved package. Extra grants are also rejected.

The trusted CLI `scripts/install-package.js PACKAGE --approval HOST-POLICY.json`
prints a plan. Add `--apply` to commit; optional `--root` selects a site root. Policy
JSON contains `placement`, `approvals`, `storageMappings` and the constructor data
for `installationContext`. This file is operator policy and must never be supplied
by package code. The CLI only constructs the host context and calls the real API.

## Catalog and accepted content

`content/installed-packages.json` is a single accepted-state document with schema
`wydgit-installed/0.1`, revision, base fingerprint, serialized canonical App and an
explicit `packages` array. Each entry records installed state, manifest, embedded
resource texts, approved grants, resolved libraries, logical mappings/scopes,
installed instance IDs, installable ID, placement and receipt. Source resources are
copied into this catalog; startup never revisits the local source package directory.
Core `prototypes/objects.json`, content source files and host config remain unchanged.

Receipts use `wydgit-install-receipt/0.1`: receipt ID, UTC installation time, revision,
package identity/version, resource hashes, placement/IDs, libraries, approved grants,
storage mappings, bindings and preceding state fingerprint. These establish durable
upgrade/uninstall/drift/troubleshooting evidence; those operations are not implemented.

Core and all cataloged package definitions compile into one candidate
PrototypeRegistry. Its existing duplicate, inheritance, public/private publisher,
override, cycle and abstract rules apply before attachment and on repository loading.

Apply uses an exclusive local installation lock, rechecks App/config/core/catalog
fingerprints, writes and fsyncs an exclusive temporary file, and atomically renames
it over the accepted state. All package resources, catalog and App publish together.
Handled failure removes temporary files and retains the prior accepted state.
A crash before rename leaves the old state; after rename the complete new state is
accepted. A stale lock after a crash needs operator inspection/removal once no writer
remains. This targets a private local filesystem, not distributed writers. File
fsync plus rename does not promise directory-entry survival through power loss.

Once installed, the catalog App snapshot is authoritative. Changes to base content,
core definitions, host config, requirements or skins fail with `PACKAGE.DRIFT`;
there is no automatic merge/reconciliation. Explicit operator reconciliation is
required before such edits can be accepted. This conservative restriction prevents
source edits from silently disappearing beneath a catalog snapshot. Plan/apply also
reject intervening changes. A running host rejects catalog changes until restarted.

## Storage and authority

Operators map logical names, for example
`{entries: {store: 'host-book', collection: 'host-entries'}}`. The enabled host
WydStore mapping must match the App/publisher/package ownership tuple and exact
field schema. Installer never enables a library or changes its provider/root/schema.
During activation Wydgine converts approved logical scopes into exact physical
WydStore pairs. Portable behavior uses the logical name for both `store` and
`collection`; the Page service facade resolves that pair before ordinary caller-bound
library dispatch. Undeclared logical resources fail closed. There is no source-string
rewriting, raw provider access or authority acquired by holding a mapping.

Normal `npm start` activates cataloged bindings/actions in the existing Page pipeline.
Wydgine constructs the context from separately approved grants and the actual request
Session identity. Roles, publisher, inheritance and installed status grant nothing.
Authenticated service calls retain the existing live Session authorization checks.

**Only one independently authorized active package principal per Page is supported.**
A second package on the same Page is rejected; grants are never unioned. The current
host also rejects mixing package activation with independently configured trusted
Page contexts/handlers/actions. Per-package dispatch isolation is future work.
Packages on different Pages receive separate contexts.

## Portable identity

WydBASIC `NewId()` takes no arguments and returns an opaque collision-resistant
String (`w` plus 32 hexadecimal UUID characters, 33 characters total). SEWN represents
it as `{op:'newId'}` in `sewn/0.3`. It uses the runtime's secure UUID facility without
exposing entropy selection, RNG objects, clocks or any host object. If that facility
is unavailable execution fails cleanly. It needs no capability because identity is
not authority. Existing WydStore create and NEW construction/edit checks still apply.
IDs are suitable for their explicit-ID inputs; attachment still requires a separately
approved exact or prefix object grant for the generated ID. It is not a credential or idempotency token.

Guestbook is server-authoritative and browser-POST-driven in the default web host.
Automatic WydClient bootstrap/transport remains deferred. Remote packages, signatures,
marketplace/discovery, uninstall, upgrade, migrations, provider provisioning,
automatic ID rewriting and multiple instances/principals are outside 0.2-P.


Only `permissions.visible` / `editable` and the operator installation context's
corresponding fields accept `exact-id` or `trailing-prefix-*`. For example,
`guestbook-entry-*` covers future entry IDs without enumerating a finite range.
Fixed IDs remain explicit; malformed patterns fail before authorization. Editable
patterns must be covered by visible grants, and requested patterns still require
separate exact operator approval. Package prefixes may cover future IDs but cannot
reach existing objects outside the installable. All other scopes remain exact.
Wildcards add no capabilities, traversal, service or package authority.
