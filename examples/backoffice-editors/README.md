# Reusable BackOffice editor and dashboard example

This ordinary server package stores workspace records with a title, a semantic
column-layout switch and bounded Markdown content. It contributes fixed WydStore
get/update/create/query actions. It contains no browser JavaScript, HTML, native
handle or privileged editor service. The same production controls also render
other installed packages' typed actions.

The trusted web adapter provides reusable typed property/content editing, explicit
load/save with optimistic revisions, and dashboard refresh/table presentation.
Long bounded strings use a multiline editor; content is interpreted as sanitized
Markdown only by canonical Page rendering. The package's portable preparation
handler maps its stored column switch into existing semantic section format and
its stored text into existing Markdown blocks. Presentation is never authority.

For a disposable installed demonstration, run:

```sh
node scripts/serve-backoffice-b6-review.js json
# or: node scripts/serve-backoffice-b6-review.js sqlite
```

Open the printed sign-in URL with the disposable credentials printed by the
operator harness. Open `/backoffice/pages/workspace`. Load the current state, edit
title/columns/body, confirm and save. Refresh the dashboard, then reload the Page
to inspect the persisted layout and sanitized content. Stop with Ctrl-C to remove
the temporary App. No production installation is accessed.

For another installation, independently provision a package-owned Store with the
manifest's schema and exact mapping `workspace`, BackOffice get/query policies
requiring `content.workspace.read`, and create/update policies requiring
`content.workspace.write`. Install this package and the existing membership
package through the normal lifecycle. Seed an initial `home` record through an
independently authorized create action. Neither installation nor reviewed adoption
assigns Gate permissions to users.

A native operator must explicitly review all four actions and an exact Page entry
with independent `content.pages.view` permission. The reproducible proposal in
[test-support/backoffice-b6.js](../../test-support/backoffice-b6.js) binds `preview`
(read preparation on the managed root), `load`/`save` (intents on
`workspace-editor`) to the same fixed store/collection/record `home`, and
`dashboard` (query intent on `workspace-dashboard`, fixed limit 10). Use the existing
stopped-App plan/review/apply workflow. Package placement or this README is not
approval. Replacements require fresh review; old references are never rebound.

The production presentation format `wydgit.backoffice-controls/1` is emitted only
by trusted canonical Page rendering. It groups already reviewed intent descriptors
by exact consumer ID, removes fixed top-level input keys from editable fields, and
includes the original closed Page binding. It adds no accepted package schema or
HTTP authority fields. The browser's operation labels and fixed-input metadata
choose presentation only. The server independently reconstructs the reviewed
binding and fixed inputs for every request, enforces all constraints and scopes,
and rechecks live Page/action/service access.

The reusable record editor recognizes compatible get/update pairs with identical
fixed targets, empty remaining get input, update input `{data,version}`, and matching
data/revision contracts. It initializes from an explicit successful load. Successful
save advances the displayed revision. A failed save preserves entered text and
requires loading current state before another save; uncertain writes never retry.
Unpaired intents use the same recursive typed form/result controls. This is bounded
site administration, without WydData, an arbitrary object-tree designer, rich HTML
editing, automatic background refresh or another administrative domain.
