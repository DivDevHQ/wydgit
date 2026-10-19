# BackOffice member roster contribution

An ordinary server package that contributes one read-only `list-members` action
through [the BackOffice action framework](../../docs/backoffice-action-framework.md).
There is no graphical page or executable package JavaScript.

Use the normal native package installer with its declared requirements, exact
approved permissions, an existing provisioned WydGate service and trusted
`serverPlacement: {app: canonicalAppId, context: 'BackOffice'}`. Attach the section
to a separately approved administrative Page. The trusted host must provide normal
object-edit, lifecycle and placement authority; package declarations grant none.

Create the native action adapter with `createBackOfficeActions` from
`wydgine/trusted/packages`, discover using this site's opaque Gate session token,
then invoke the returned exact reference with `{offset:0,limit:20}`. The caller
needs an active owner/administrator membership, current `gate.members.manage`
permission and the package's independently approved capability and App scope.

Results contain only bounded member IDs, account IDs, membership status/role and
display names. Retirement, relocation, replacement and removal invalidate the old
reference. Rebuild adapters after stopped-App lifecycle changes.

The real installation, authorization, invocation and recovery demonstration runs
on JSON and SQLite in `test/backoffice-actions.test.js`.
