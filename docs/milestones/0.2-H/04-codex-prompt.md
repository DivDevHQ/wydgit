# Codex implementation prompt — Wydgit milestone 0.2-H

Implement Wydgit milestone 0.2-H in the actual Wydgit repository using all documents in this bundle as the behavioral contract. Read README.md, 01-model.md, 02-request-response.md, and 03-acceptance.md before editing. This is a major integrated milestone, not a documentation-only change or isolated event-emitter prototype.

Preserve Wydgit terminology and KISS/KICK philosophy. Wydgine owns server execution/transport; WydClient owns client adaptation; SEAM owns authority. Preserve future SEWN compatibility through safe schema-defined envelopes and renderer-independent semantics, without implementing SEWN. Do not invent acronym expansions, parallel permission systems, raw host escape hatches, or framework ceremony.

## First inspect the repository

Read applicable AGENTS.md and architecture/language/security/testing docs. Locate the current version/milestone and changelog, WydBASIC parser/compiler/runtime, ExecutionContext/SEAM enforcement, App/Session/Page/prototype/slot model, Wydgine pipeline, WydClient renderer, WydFiles/FileSys, safe handles, request transport, and existing tests. Determine actual syntax, supported API spellings, authority rules, and test commands. Preserve local user changes and read-only reference files.

Implement with existing abstractions. Example API spellings in this bundle are illustrative where the repository differs; public semantics are required. Record a brief repository mapping and any concrete incompatibility with baseline decisions. Resolve routine integration choices autonomously. Ask only if a material unresolved design conflict prevents a safe coherent implementation, while completing unaffected work. Do not silently reinterpret required behavior or claim unavailable code exists.

## Implement the complete vertical path

1. Add the event registry/envelope, safe EVENT context, payload schemas, structured failures, bounded FIFO dispatch, stable handler ordering, cancellation/default-operation semantics, and context isolation. WydBASIC handlers take no conventional parameters, including custom events.
2. Integrate App/server Start/Stop and Session Start/Authenticated/Logout/Timeout/End with actual runtime transitions. Ensure terminal idempotence and no implicit request/Page in non-request handlers.
3. Implement session-owned request-local Page trees and the Request→Start→Initialize→Load→Validate→Action→PreRender→Render→Unload pipeline. Apply deterministic traversal, mutation snapshots, initialization ledgers, early-response termination, exactly-once cleanup, and explicit persistence boundaries.
4. Expose bounded safe REQUEST and RESPONSE facades. Implement sanitized Markdown, authorized file streaming with trusted typing, scoped headers/cookies, commitment rules, and input/action/anti-forgery validation. Reuse trusted renderer/file/security services.
5. Integrate WydClient Mount/Ready/Unmount and Activate/Change/Submit adapters with safe handles/payloads and client cookie reads. Prevent duplicate native submissions and direct DOM/native-event access. Client cookie writes are optional only as specified in the HTTP contract.
6. Exercise a real GET, invalid POST, successful authorized POST, Markdown endpoint, and file endpoint. A cancelled or denied action must not gain authority or perform its default operation. Demonstrate that changing a Page affects only the current request.

Every facade operation and dispatch boundary must enforce existing SEAM restrictions. Client data cannot supply server authority. Session identity cannot grant capabilities. No raw request/response, DOM, cookie jar, native event, filesystem path, or arbitrary runtime reference may leak into ordinary Wydgit code.

## Validate and finish

Implement the acceptance scenarios in 03-acceptance.md with meaningful unit/integration/browser tests appropriate to the existing framework. Run required repository checks and regressions. Fix failures caused by this work. Record exact checks and outcomes; distinguish a test not run from a passing test. Do not stop after creating stubs or passing only emitter tests.

Update model/language/API docs, working examples, changelog, and authoritative versions using repository conventions. Identify compatibility changes and the migration away from conventional handler parameters or unsafe host access if applicable. Respect SemVer constraints; document milestone 0.2-H without inventing a released machine version.

Keep out-of-scope work deferred as listed in 03-acceptance.md. Do not commit automatically, push, publish, release, or deploy. Leave a reviewable working tree. Final report must state the implemented behavior, files/areas changed, tests/checks with results, version/changelog changes, any remaining limitations or blockers, and that changes remain uncommitted. Only call the milestone complete when required integrated behavior and acceptance criteria are satisfied.
