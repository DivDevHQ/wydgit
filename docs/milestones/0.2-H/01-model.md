# 0.2-H event, context, and lifecycle model

“MUST” states a required milestone invariant. “Future” marks work outside this milestone.

## Founding rules

The Page is the root of the session-scoped request/render tree. Every server-rendered content Wydgit participating in a Page request MUST exist beneath that Page and execute within the owning Session context.

```text
App / Server runtime
  Session
    request-local Page
      content Wydgit tree
```

A Session MUST be resolved before Page execution, including anonymous requests. Anonymous identity is a valid Session state; authenticated identity is not required. Session identity, roles, groups, and permissions do not themselves grant SEAM capabilities. Code cannot substitute a different Session or cross App boundaries.

Each request gets an isolated Page tree based on canonical App/Page data. Property changes, slot edits, additions, removals, and replacements affect only that request by default. Deep mutable state MUST NOT alias canonical data or another request. Concurrent requests, including those in the same Session, MUST NOT share their mutable Page trees.

Persistent state changes require explicit operations through existing authorized persistence/session services. Validate, authorize, and commit there; never implicitly save the Page tree, add autosave, or treat transient mutation as durable storage. A failed or cancelled event does not automatically roll back a previously committed persistent operation. Handlers should perform validation before durable writes and use existing transaction semantics when needed.

## Handler syntax and contextual objects

Handlers declare no conventional parameters, including custom events:

```basic
PAGE EVENT Load
    IF REQUEST.IsPost THEN
        Me.AccountPanel.Visible = SESSION.Authenticated
    END IF
END EVENT

EVENT Quantity.Change
    IF EVENT.NewValue < 0 THEN
        EVENT.Cancel()
        RETURN
    END IF
END EVENT

EVENT Cart.ItemAdded
    DIM quantity = EVENT.Payload.Quantity
END EVENT
```

Do not introduce `(sender, args)`, `(request, response)`, or arbitrary custom signatures. Internal host functions may receive kernel context; that does not become a WydBASIC handler signature.

| Context | Availability and meaning |
|---|---|
| `ME` | Current handler owner; scoped Wydgit handle, never a host object |
| `EVENT` | Current dispatch only; safe event context |
| `PAGE` | Owning request-local Page during Page execution; client Page handle only where already supported |
| `SESSION` | Owning Session safe view in Session/Page execution |
| `REQUEST`, `RESPONSE` | Current server Page request only |
| `SERVER` | Safe App/server context where applicable, within granted authority |
| `CLIENT` | WydClient execution only |

Unavailable contexts MUST fail with a structured context error rather than expose globals or accidentally reuse another invocation's context. Session timeout/end and Server handlers have no implicit request, response, or Page. No new `APP` language global is required; App ownership remains in the execution context.

Nested dispatch MUST restore the outer contextual bindings. Async execution MUST preserve isolation between invocations. Scoped handles MUST reject stale, out-of-scope, or unauthorized use; serializing a handle never serializes native runtime references.

## Event context and envelope

Public baseline:

| Member | Contract |
|---|---|
| `Type` | Registered semantic/lifecycle type |
| `Source` | Original authorized origin handle; immutable during dispatch |
| `Target` | Current recipient handle; set by dispatcher |
| `Payload` | Validated, read-only, JSON-safe event data |
| `Cancelable` | Immutable event-definition flag |
| `Cancelled` | Read-only dispatch state, initially false |
| `Handled` | Boolean writable by an authorized current handler; initially false |
| `Cancel()` | Sets Cancelled when supported; otherwise structured invalid-operation error |
| `OldValue`, `NewValue` | Read-only Change payload aliases only, not universal members |

For the baseline direct semantic delivery, Source and Target are the originating Wydgit; ME is the declared handler owner and may be another authorized Wydgit with a named-source handler. Do not confuse the owner with the event recipient. Page traversal sets Target and ME to each participating Wydgit. Lifecycle Source is the owning lifecycle root. Neither source nor target selection conveys new authority.

The internal envelope includes type, runtime, source, target, app, session/page identifiers where applicable, schema/version, payload, cancelable, cancelled, and handled. Keep host execution authority separate from transport data. Envelopes contain safe structured values and scoped identifiers, never sockets, functions, DOM events, request/response objects, or filesystem paths. A client-supplied envelope cannot choose authoritative identity, App, Session, capabilities, or scopes.

Registered payload schemas MUST reject unsupported values, malformed fields, excessive depth/size, and invalid handles before invocation. Custom events also use EVENT.Payload and schemas; implement a minimal registry, not a new general-purpose declaration language. The envelope is a SEWN compatibility boundary, not a SEWN implementation.

## Server/App and Session lifecycle

`SERVER EVENT Start` runs once per App runtime activation; `Stop` once during graceful shutdown, not per request. Bind each to its App/server execution context. Server Error is future work; ordinary handler failures still produce structured errors.

Session baseline: `Start`, `Authenticated`, `Logout`, `Timeout`, `End`.

- Start runs once when the Session becomes active, before its first Page.
- Authenticated runs after an authorized identity transition is installed; it grants no capabilities of its own.
- Explicit logout revokes authentication/session usability before Logout, then End.
- Expiration makes the Session unusable before Timeout, then End.
- End runs once for a terminal Session, including other normal termination causes. Cleanup failures must not reactivate it or suppress terminal cleanup.

Terminal transitions MUST be serialized/idempotent so racing logout and timeout do not double-run End. New Page requests cannot use a terminated Session. Follow the repository's existing policy for in-flight requests and document it; recheck authority at privileged operations. Do not build new distributed session coordination for this milestone.

## Page pipeline

```text
Request → Start → Initialize → Load → Validate → Action → PreRender → Render → Unload
```

Request, Action, and Render are platform phases, not public Page events.

| Phase | Required behavior |
|---|---|
| Request | Resolve App, route, Session, Page, authorized execution context, and bounded safe input |
| Start | Establish safe contextual surfaces; execute the Page root handler before full descendant initialization |
| Initialize | Hydrate prototypes/properties/slots/IDs and safe handles; complete tree construction, then dispatch Initialize |
| Load | Bind permitted submitted values to semantic fields, then dispatch Load; never bind arbitrary properties or authority metadata |
| Validate | Produce semantic Valid/Errors/Warnings, then dispatch Validate; keep presentation out of validation data |
| Action | Dispatch the validated relevant Activate/Change/Submit action; normal GET needs none |
| PreRender | Dispatch final request-local changes before renderer ownership |
| Render | Freeze ordinary tree mutation and render through Wydgine |
| Unload | Cleanup initialized participants in reverse order, discard transient tree and invalidate request handles |

Start is root-only because descendants do not yet exist in the guaranteed initialized tree. This explicitly resolves the conversation's tension between early Start and tree-wide lifecycle traversal. Initialize, Load, Validate, and PreRender traverse the available tree. A handler runs only if declared; absence is a no-op.

Invalid Submit still reaches its handler with validation state, so it can present errors, but the platform MUST suppress its registered default submission operation. Validity does not authorize persistence. A success view requires an explicit success flag/result from the authorized action, not merely `Form.Valid`.

Unload MUST run once for initialized participants after normal rendering, explicit response, or failure, using finally-style cleanup. Track initialized participants even if later removed. A construction failure cleans up only successfully initialized participants. No output writes or late tree changes in Unload; it is cleanup, not a second response phase. Preserve the primary error while recording cleanup failures.

## Semantic events and WydClient

Baseline semantic types:

| Event | Payload/default behavior | Cancelable |
|---|---|---|
| Activate | Optional schema-defined command intent; registered activation behavior | Yes |
| Change | OldValue/NewValue; validated proposed semantic value | Yes |
| Submit | Scoped form/submission metadata; validated submission behavior | Yes |

For Change, handlers observe OldValue as the committed value and NewValue as the proposal; apply the registered default value update only after dispatch succeeds without cancellation. Load binding is a pipeline operation and does not implicitly fire Change events. Host input adapters must restore/reconcile the displayed value if a Change is cancelled.

`Cancel()` suppresses the declared default operation and stops remaining handlers for that semantic dispatch. `Handled = TRUE` stops remaining handlers but does not cancel the default operation. Lifecycle events are noncancelable; Handled MUST NOT stop structural lifecycle traversal. Cancellation is an outcome, not necessarily a handler failure.

Semantic handlers run in stable declaration/registration order. Baseline delivery is direct; no automatic bubbling, capture, or ancestor propagation. A future propagation model must preserve Source while updating Target explicitly.

WydClient maps native host events to semantic events; ordinary code receives only Wydgit handles and safe payloads. Browser click/input/submit are adapter inputs, not public event names. Prevent native submission when WydClient owns Submit to avoid duplicate browser/server actions.

Client baseline: Mount after attaching an instance to the renderer; Ready once per mount after that instance and its initial descendants are ready; Unmount once per mounted instance before teardown. Mount and Ready run parent-first; Unmount runs reverse order. Remount starts a new cycle. Runtime teardown or adapter errors must still release listeners and handles. Server rendering alone does not fire client lifecycle events.

WydClient may use the DOM. Wydgits may not. Do not expose document, window, HTMLElement, querySelector, innerHTML, addEventListener, MutationObserver, native events, or browser cookie primitives. Hybrid client-server Wydgits retain separate authority on each side. A client-to-server action crosses an explicit authenticated service/request boundary and is revalidated server-side.

## SEAM and deterministic dispatch

Dispatch carries authority; it never manufactures it. Execute each handler within the existing caller/owner/platform restrictions using the established SEAM model. Where restrictions intersect, use the restrictive result; never union grants. Revalidate source, recipient, owner, payload handles, visibility, edit scope, runtime, App, Session, and Page as applicable. Payload data, event registration, Session roles, or client claims cannot widen capabilities.

Use depth-first parent-before-child traversal in declared slot order, then child insertion order within each slot. Never depend on hash iteration, native event timing, or unordered registration. Unload uses the exact reverse initialization ledger, giving child-before-parent cleanup with deterministic sibling order.

Snapshot eligible recipients at each lifecycle phase entry. Additions/removals do not rewrite that snapshot: removed recipients are skipped for normal phase delivery; newly added recipients participate in the next phase after initialization. Initialize new subtrees through a bounded explicit initialization queue before further use; each instance initializes once. Changes from PreRender must be initialized before rendering, without replaying earlier Load/Validate/Action phases. Newly created fields needing those phases require a fresh request or explicit supported service behavior; do not silently invent catch-up events.

Queue handler-raised semantic events FIFO after the current dispatch, including its default operation. Await one handler at a time. Bound queue length, total dispatches, depth, payload size, and execution time using existing runtime limits. No uncontrolled recursive dispatch or parallel mutation of a Page tree. Reject stale queued handles deterministically. Document stable limits and error behavior.

Given the same tree, registration order, request, Session snapshot, execution context, and service outcomes, dispatch order and default-operation outcomes MUST be identical. This does not promise determinism of external services or wall-clock data.

Errors use existing structured platform errors with stable categories corresponding to EVENT.INVALID, EVENT.DENIED, EVENT.HANDLER_FAILED, and EVENT.LIMIT. Do not leak native exception details. Before commitment, fail closed with a safe error response; after commitment, terminate safely without sending a second response. Errors cannot skip required cleanup or increase authority.
