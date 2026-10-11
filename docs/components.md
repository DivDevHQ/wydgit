# Generic declarative components — 0.3-C

An installed package can define a custom Block-derived prototype with a
`presentation` declaration. Its properties, template and canonical read binding
belong to the package. The runtime does not register package-specific type names,
component properties, query conventions, URLs or markup. Inheritance and normal
package/Page ownership rules continue to apply.

```json
{
  "id": "example/status",
  "publisher": "example",
  "extends": "wydgit.core/block",
  "properties": {
    "content": {"type":"object","default":{"type":"markdown","value":""}},
    "label": {"type":"string","default":"Status"}
  },
  "slots": {},
  "presentation": {
    "schema": "wydgit.presentation/0.1",
    "template": {
      "tag": "section",
      "attrs": {"id":{"get":"id"}},
      "children": [{"tag":"h2","text":{"get":"properties.label"}}]
    }
  }
}
```

`request` optionally declares `{library,apiVersion,operation,input}`. The provider
must appear in the package's `requires`. Input is a declarative JSON value tree;
for example `{index:{get:"properties.index"},query:{op:"query",name:"q"}}`.
The generic dispatcher uses the Page's trusted execution context and ordinary
canonical capability, scope, validation and byte/structural policies. A service
provider must additionally opt in with `service(...,{presentation:true,...})`.
This is a trusted declaration that the operation is appropriate for read-only
presentation; writes are never opted in by WydStore or WydSearch. This flag grants
no capability or resource access. Ordinary package manifests cannot set it.

`valid` optionally validates input, and `when` controls whether to request data.
Component data states are `empty`, `ready`, or `error`; a successful result is
available at `data.value`. Failures discard data and do not expose exception text.
Session authorization is refreshed before and after the service call. Invisible
instances cannot invoke their binding. Trusted `wydgit.config.json` runtime settings select the Page presentation budget:

```json
{"schema":"wydgit.host/0.1","runtime":{"componentRequests":4},"libraries":[]}
```

The default is 4; only integers 0 through 16 are accepted. Zero disables bindings.
The host snapshots this policy at startup; restart after changing it. Packages,
instance properties and request parameters cannot configure it. Trusted context
`limits.componentRequests` can only reduce the host policy. Normal installed
package Pages use the same host setting.

Each Page execution creates a private branded ledger bound to its Page and actual
execution context. Every eligible binding attempt consumes one slot before input
evaluation/session authorization/dispatch, including failures, without refunds.
The same ledger and expression budget apply across nesting and repeated preparation
attempts. Re-rendering prepared data makes no calls; an independent Page execution
gets a new ledger. Exhaustion yields `error` without result data or another service
invocation. Requests are sequential during normal preparation. There is no streaming, write binding, scheduler or new event bus.
Ordinary SEWN service-call budgets and canonical per-operation resource limits are
separate and unchanged; dependency calls and session authorization are not charged
as additional presentation bindings.

Preparation audits the renderer's supported `sections`, `blocks`, `children`, and
Form `fields` placements. A package-defined Field-derived prototype may explicitly
declare presentation, sharing the same ledger. It replaces that field's native
control markup, so the package author must design an appropriate component;
it does not add JavaScript or turn a field value/configuration into executable code.
An ordinary property named `presentation` is ignored by the renderer projection.
Only the validated prototype declaration selects a template or binding. Sensitive
field values retain the existing projection sanitization. Arbitrary custom slots
are not renderer placement extension points.

Templates use allowlisted `tag`, `attrs`, escaped `text`, `children`, optional
`if`, and optional `each:{in,as}`. Values are literals, objects/arrays, or expressions:

- `{get:"properties.label"}` reads an own data path. Other roots are `id`, `query`,
  `path`, `data`, and a named repeated item. Prototype/constructor paths are rejected.
- `concat`, `eq`, `and`, `or`, arithmetic and comparisons use `args`.
- `not` uses `value` (or one argument); `length` and `trim` use `value`.
- `if` uses `test`, `then`, `else` and evaluates only the selected branch.
- `query` and `queryValid` use `name`; ambiguous repeated parameters are invalid.
- `integer` uses `value`, optional default/min/max and bounded unsigned decimal input.
- `parameter` validates a query-parameter identifier.
- `url` uses a same-site `path` and `params` object or key/value pairs, encoded by
  URLSearchParams. No executable or external destination is accepted.

No raw HTML, script/style elements, event-handler attributes, functions, dynamic
imports, arbitrary JavaScript or authority fields exist in this format. All text
and attributes are escaped. Templates come from validated prototype metadata;
ordinary properties and service results cannot replace them. IDs are checked
against the Page's existing anchor set. Existing skin scopes/tokens apply to the
root element; generic form/result CSS utilities work with light/dark themes.

Bounds: 1,024 declaration value nodes, depth 32, data paths at most 256 characters
and 16 segments, 32,768 expression steps per Page preparation/render, 256 items per repeat,
2,048 rendered elements per Page, 64 KiB UTF-8 per displayed value, and 1 MiB cumulative
component render budget per Page. Expression strings are also bounded to 64 KiB before joining;
URL parameters have 128-pair / 8 KiB bounds. Parent markup contributes to the cumulative budget as well, so it
is conservative. Package resource/catalog and canonical-service budgets still
apply independently. This is a small presentation vocabulary, not a browser DOM,
general templating language, ORM or application programming language.

## Approved library host extensions

Existing host-approved Node library modules may export `initialize({root,options,
adapter})`, returning optional `context` and `start(registry)`. The loader passes
`context` as private `hostContext` to registration, then executes startup hooks
only after all services register. Hosts supply adapters keyed by library ID;
ordinary packages cannot supply them. Initialization failures are normalized to
`LIBRARY.INITIALIZATION_FAILED` and the registry is not published. These hooks
execute only already-approved library implementation code, not installable
Wydgit code. There is no module scan or arbitrary request-selected import.

A library may also export synchronous `resolvePackageScopes({options,app,scopes})`
to translate explicitly approved logical scope IDs into safe JSON grants. Planning
and activation verify this through the required approved provider; results are
stored in matching `libraryScopes` receipt/catalog metadata and rechecked at startup.
Provider code must validate site/resource policy. It cannot add capabilities or
change the Page's execution identity. Legacy WydStore ownership/mapping and
prototype construction scopes retain their existing rules.

WydSearch uses these hooks for its source resolver, public Page allowlist, refresh
and index scope policy. A future WydStream or third-party component can use the same
mechanisms without adding a type-specific runtime renderer or service adapter.
