# Delegated dynamic Forms and hidden inputs

This patch adds server-rendered, package-scoped dynamic **Submit** actions. It does
not make arbitrary prototype methods or custom event names remotely callable.
Native Forms supply renderer-owned buttons, POST routing and CSRF metadata; cards
with several operations can contain separate sibling Forms, each using an approved
prototype/prefix contract. Forms must never contain other Forms.

## Declaration

A package-defined Form prototype explicitly exposes its action:

```json
{
  "id": "divdev/task-action",
  "publisher": "divdev",
  "extends": "wydgit.core/form",
  "actions": {"Submit": {"capability": "app.forms.submit"}},
  "properties": {
    "recordId": {"type": "string", "default": ""},
    "recordVersion": {"type": "number", "default": 0}
  },
  "slots": {}
}
```

Its package binding requests an approved prefix, prototype and installed root:

```json
{
  "owner": "task-action-*",
  "event": "Submit",
  "source": "mutate",
  "kind": "action",
  "method": "POST",
  "capability": "app.forms.submit",
  "delegation": {
    "type": "divdev/task-action",
    "root": "taskboard-root",
    "resolver": "resolve-action"
  }
}
```

The two source names map to ordinary resource paths in resources.sources.
Visibility must cover the prefix; editable grants must cover any edited instances,
fields and destination slot occupants. The delegated type must be declared by the
package and included in independently approved scopes.prototypes. The root is an
exact installed instance. Overlapping action owner patterns for the same event are
rejected. Prototype inheritance preserves action declarations and cannot change
an inherited action's capability. Routing adds no capabilities.

## Resolve before dispatch

`resolve-action` declares exactly `EVENT Page.Resolve`. This resolver is invoked
only for a matching delegated POST, after action capability, session and CSRF
checks, before ordinary Page lifecycle and native field binding. It receives
`Me` as the installed root and `REQUEST.Route.target` as the requested **untrusted**
exact ID. Form inputs are likewise untrusted at this point.

The resolver may call only WydStore get/query, using the normal caller-bound
service path and logical storage mappings. Other service calls, file access and
response output are unavailable. Normal workflow/event/construction bounds apply.
It may construct and attach request-local objects under existing edit/construction
and traversal grants. It must read authorized backing data, bind its identity to
the requested ID, and reconstruct the native Form below its installed root.
For example, verify target equals `"task-action-" & result.value.id` before
constructing a receiver from the returned record snapshot.

The kernel then checks actual prototype ancestry/action exposure, root containment,
Page membership, visibility and package/installation principal. A missing,
inaccessible, mismatched or ambiguous target cannot invoke the action. The target
is checked again before action dispatch. Native field allowlisting/validation and
live session authorization remain in effect. Store writes still need separately
approved write/delete capabilities and optimistic record versions.

The kernel verifies graph identity and containment; it cannot infer a package's
record ownership policy. Resolver/handler code must use the authorized service
results and verify record-specific permissions where the application's policy
requires them. Hidden browser fields are not evidence of ownership.

## Rendering and refresh

GET rendering remains the package's ordinary Page lifecycle. POST resolvers rebuild
only the requested receiver (and required surrounding structure), even if the
original object came from PreRender. Use deterministic exact IDs for reconstruction.
Do not run the same unconditional construction again in PreRender: duplicate IDs
are rejected, and removed IDs cannot be reused within the request. Reuse/update the
resolved receiver or build the read-only render tree with distinct IDs. There is no
automatic draft persistence or automatic record-to-object mapping.

`test/dynamic-actions.test.js` contains an executable install/HTTP example: a
storage-backed dynamic Form with a native hidden record ID resolves from WydStore,
performs versioned deletion, and survives restart without persisting rendered cards.

## Native hidden input

`wydgit.core/hidden-input` is a String-valued Field with optional maxLength. It
participates in native binding, validation, Form.Values/Bind/Clear and request
allowlisting like other Fields. Its web rendering is an escaped `<input type="hidden">`
without a visible label or wrapper. `enabled:false` renders disabled; `visible:false`
omits it entirely, as for other Fields. Required and maxLength remain server checks.

A hidden value is public, browser-readable and editable by the user. It is not a
secret, signed value, trusted record reference or new capability. Use it for input
transport, then validate record identity, permissions and versions on the server.
Reserved routing names cannot be authored as Field names under existing name rules.

The standalone WydClient adapter remains unchanged: this patch supplies server web
rendering and does not claim client-side dynamic action dispatch. Rebuild generated
client bundles with the checkout's configured client version after applying shared
kernel changes; this patch does not overwrite generated artifacts from other work.
