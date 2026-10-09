# 0.2-H acceptance, versioning, and scope

## Required tests

Use the repository's test framework. Exercise real dispatcher/facade integration rather than tests that merely copy implementation logic. The following are acceptance scenarios, not a demand for a separate test file per row.

| Area | Required evidence |
|---|---|
| Handler language | Parameterless Page/Session/Server/Client/semantic/custom handlers compile and execute; conventional handler parameters are rejected; missing contexts produce structured errors |
| Page-in-Session | Anonymous and authenticated requests resolve Sessions first; handlers receive the correct owning Session; forged/cross-App/cross-Session handles are denied |
| State isolation | Two requests from one Session and two Sessions mutate independent Page trees; nested collections and slots do not alias canonical state; only explicit authorized writes persist |
| GET pipeline | Exact Start/Initialize/Load/Validate/PreRender/Render/Unload trace with root-only Start; GET produces no synthetic action |
| POST pipeline | Submitted values bind before Load; validation precedes Submit; failed form retains values/errors and suppresses default submit; successful authorized action can render a success view |
| Traversal | Stable slot/insertion/depth-first order; reverse initialized-participant cleanup; absent handlers do nothing; replayed inputs produce identical traces |
| Tree mutation | Add/remove during a phase obey snapshots; added subtrees initialize once; removed initialized nodes still unload; PreRender additions render without hidden Load/Validate/Action replay |
| EVENT | Source/Target/ME distinctions, payload schemas, Change aliases, immutable data, invalid Cancel, separate Handled/Cancelled/default behavior, stale handles |
| Dispatch limits | FIFO raised events, awaited handler order, restored contextual bindings, concurrent request isolation, queue/time/depth limits, bounded self-raising events |
| Session lifecycle | Start once, authenticated transition visible, Logout→End and Timeout→End, racing terminal transitions deliver End once; no privileges from identity alone |
| Server lifecycle | Start/Stop once per App activation/shutdown, never per Page; no ambient request/response in handlers |
| Client lifecycle | Mount→Ready, deterministic descendant ordering, remount cycle, reverse Unmount, listener cleanup, no client events from server-only rendering |
| Client semantics | Native inputs yield safe Activate/Change/Submit only; cancelled Change reconciles value; intercepted Submit does not double-fire; no native object leaks |
| SEAM | No grant union or impersonation through envelopes, payloads, handlers, Session metadata or client claims; runtime boundaries reauthorize |
| Input safety | Bounded maps, missing/repeated values documented, malformed encodings rejected, forbidden field/action binding rejected, anti-forgery behavior exercised |
| Response | Normal tree output or one explicit body; early response skips remaining normal phases but unloads; mutation after commit denied; denied operation leaves response Open; disconnect/stream failure cleans up |
| Markdown | Raw HTML, scripts, event attributes, javascript/data URL attacks and malformed Markdown cannot yield executable output |
| File output | Valid scoped file succeeds with trusted media type; missing file-read/output grant, traversal/path input, forged/stale handle, unsafe active type, oversized file and malicious filename fail safely |
| Headers | Allowed scoped headers work; case variants cannot bypass checks; CR/LF injection, framing headers, Set-Cookie, locked policy removal/weakening and content-type override fail |
| Cookies | Scoped preference read/write/delete works; invalid attributes/injection/name/path/domain rejected; reserved credentials never exposed; deletion respects scope; HttpOnly never reaches WydClient |
| Failure | Handler/render/init/cleanup failures yield sanitized structured errors and exactly-once cleanup; committed responses never get a second body |

Add representative integration fixtures with lifecycle traces and a minimal Page/Form example. Include denied-capability cases, not just happy paths. Browser tests should inspect the public facade and hydration payload as well as visible behavior. Preserve existing regression coverage and run the repository's required type/lint/build/test checks.

## Version and changelog

Discover authoritative manifests/version constants, existing milestone notation, changelog conventions, and generated-file policy. Record milestone **0.2-H** consistently in appropriate release/model documentation. Do not write an invalid package-manager version such as `0.2-H` into a SemVer-only field; map it to the repository's established scheme or leave the machine version unchanged with an explicit explanation. Do not guess a released version or publication date.

Add a truthful changelog entry covering event/lifecycle execution, safe contexts, request-local Page state, response/cookie safety, compatibility changes, and tests actually run. Update the language/model/API docs and examples affected by the final implementation. If conventional event parameters or raw host surfaces previously existed, document the migration and reject unsafe compatibility shims.

## Out of scope

- Full SEWN compiler, interpreter, distribution, replay engine, or transport protocol.
- Direct DOM access, raw HTML, raw HTTP request/response streams, arbitrary host filesystem access, native object payloads.
- Automatic canonical Page persistence, ViewState/postback machinery, session-to-capability conversion.
- Event capture/bubbling, broad event catalog, Focus/Blur/Navigate/Command, public Render/Request/Action handlers, Server Error event.
- New APP event namespace, general custom-event language syntax, new authentication framework, distributed session coordination.
- Redirect/Json response methods, arbitrary binary generation, uploads, caching, new renderer families, new media override authority unless already safely supported.
- Unrelated refactors, automatic commits, pushes, releases, publication, or deployment.

## Definition of done

All required in-scope behavior works through the real Wydgine/WydClient boundaries with SEAM checks, deterministic dispatch, safe payloads, and lifecycle cleanup. Required checks pass or failures are explained accurately with reproduction details. Docs/version/changelog match the implementation. No unimplemented feature is marked complete. Report any architecture conflict or unavailable integration clearly; scaffolding alone is not milestone completion. Leave changes uncommitted for review.
