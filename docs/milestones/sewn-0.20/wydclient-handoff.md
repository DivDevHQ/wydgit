# WydClient H3 execution handoff — 0.20 checkpoint

H2 alpha.4 remains unchanged. Successful source compilation is not browser
execution. New `PRESENTATION SERVER` declarations require server-only manifests;
client targets fail compilation/lowering. Composition outputs are canonical server
package templates, not WydSUB bootstrap manifests. No portable full Taskboard
artifact or H3 executable acceptance fixture exists yet. Server event/lifecycle
integration must also finish before this is a complete 0.20 handoff.

H3 must establish these enforcement points before enabling executable components:

1. Validate actual canonical class/procedure contracts before activation; retain
   independent signature/namespace approval and exact dependency pins.
2. Bind a live ExecutionContext and opaque references to one WydSUB root. JSON IDs,
   signed publishers, DOM containment and the trusted H2 host adapter are not authority.
3. Preserve original caller capabilities through declaring-class frames, method
   dispatch, libraries, child access, bindings and handlers. Recheck visibility,
   ownership, member access and lifetime on every invocation/mutation.
4. Use the shared SEWN executor, with one effective event/activation-chain ledger;
   do not create an executor inside the source compiler or reset limits per handler.
5. Implement the canonical server instance lifecycle controller contract after that
   contract is actually implemented and tested. Init-once, activation failure,
   repeated render, child-first teardown, hook exceptions and idempotent disposal
   need identical observable guarantees.
6. Authenticate declared custom emitters, typed payloads and source/recipient
   contracts. Preserve sequential registration order, no bubbling, cancellation,
   sanitized failures and bounded nested delivery. Page subscriptions need actual
   root-local host eligibility; Server/Session sources cannot be impersonated.
7. Add portable presentation/binding capability validation explicitly. Existing
   server templates are HTML-oriented and cannot silently become H2 literal content.
   H2 Markdown stays literal text until a separately validated Markdown feature.
8. Cancel and invalidate pending work/subscriptions before unmount/removal can expose
   stale callbacks. Late service results must not mutate or reactivate disposed
   instances; nested roots remain independent throughout rerender and cleanup.
9. Keep host() private to trusted embedding code. Do not add it to SEWN facades or
   use it as a substitute for object/context authorization.
10. Ship any changed browser behavior under a new immutable implementation filename,
    reproduce it and run actual Chrome fixtures. Keep alpha.1–alpha.4 bytes unchanged.

Existing reusable fixtures include `test/wbasic-classes.test.js` for class access,
methods/interfaces/authority and `test/wbasic-families.test.js` for generated
composition and independent JSON/SEWN presentation behavior. H3 must add executable
browser tests for methods, all hook transitions, event storms, handler teardown,
forged/cross-root references, restricted bindings and cancellation; the current
Chrome H2 fixtures do not establish these results.

App-wide class bindings have no established source integration in this checkpoint.
Actual host names remain Server.Start/Stop, Session.Start/Authenticated/Logout/
Timeout/End and Page.Start/Initialize/Load/Validate/PreRender/Unload. Instance hooks
are separate. Cleanup/termination events cannot guarantee delivery at process crash,
network loss or browser close. There is no durable exactly-once mechanism.
