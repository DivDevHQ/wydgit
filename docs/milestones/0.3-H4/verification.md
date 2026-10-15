# H4 verification

Baseline: `0f939734c39b68eaabf57b6cda2015ca0599349a`, branch `develop/0.3`,
WydClient 0.1.0-alpha.6, WydSUB 0.1, server/platform 0.3.0-alpha.8.
The starting tree was clean. Implementation is the H4 commit containing this report;
a self-referential commit SHA is intentionally not embedded. This is implementation
verification, not the independent Barney audit. No release/tag/main merge/deployment
or downstream edit is included.

## Baselines and final matrix

- Baseline full repository: **755/755**, using H3's documented
  `npm test -- --test-isolation=none`; zero failures/skips/cancellations.
- Baseline actual Chrome: **16/16** unchanged alpha.6 fixtures.
- Baseline build/history guard and content checks passed; Brotli **83803 bytes**.
- Initial integrated full run: **763/763**, before the additional adversarial cases.
- Final repository: **771/771**, zero failures/skips/cancellations, same complete
  serial suite and isolation setting as the baseline.
- Final client suite: **89/89**, including all prior client/security/history tests.
- Focused new controls and authoring: **15/15**; one additional independent canonical
  control test executes readable/minified alpha.7 and verifies alpha.6 rejection.
- Actual final Chrome: **19/19** fixtures — retained compatibility/execution **16/16**
  plus native controls/local/signed/embedded **3/3**.
- `npm run check`: **3 complete pages, 42 internal links**, unique anchors.
- Client package and alpha.7 repeated builds reproduce exact bytes/hashes.
- Client workspace package dry run and final diff checks passed.

Required suites include WBasic/frontend/IR/family conformance, canonical OOP,
interfaces/visibility, SEWN, SEAM, static libraries, shared budgets, events/lifecycle,
Taskboard/Guestbook, installation/signatures, old client and immutable-history tests.
No test-isolation change was introduced to suppress an H4 failure. H3's interrupted
runs remain documented in its original report. Sandboxed socket/Git/cache failures
were rerun outside the sandbox; those attempts are not counted as successful runs.

The first new CDP runner attempt completed all interaction assertions but failed
cleanup with ENOTEMPTY while Chrome subprocesses finished writing their temporary
profile. Bounded removal retries fixed only test infrastructure; the successful
rerun completed assertions and cleanup with exit 0. An early nested-root test tried
to mount inside an owned runtime region, which H1b intentionally forbids. It now
mounts independently and then performs the supported trusted-host relocation; no
mounting or authority gate was relaxed.

## Actual Chrome acceptance

Chrome **155.0.8059.79** loads only the current immutable alpha.7 artifact.
`browser-controls.js` serves static files and drives Chrome through DevTools native
mouse/keyboard commands. It never implements Taskboard updates or invokes application
business methods through the host facade. Its host lifecycle calls exercise only
Unload/activation/unmount. Consuming pages need no Node/Wydgine/database at runtime.

| Fixture | Verified behavior |
| --- | --- |
| Local CLIENT Taskboard | Authored Next button executes compiled navigation and typed PageChanged wiring; native form validation; keyboard Enter submit; text/textarea/checkbox/select values; mouse submit; changed canonical list and feedback; retained draft/reset; Unload/reactivation |
| Signed CLIENT Taskboard | Same native behavior after SHA-256/Ed25519 verification, independently trusted ephemeral key and exact package/version approval; generated package bytes are served directly |
| Two embedded Taskboards | Independent drafts, controls, queues and instances; one root's navigation leaves the other unchanged; survivor submits after sibling unmount; remount starts fresh; old button has no authority; final teardown removes forms |

The signed fixture uses an ephemeral test key, never a committed private key or
production trust default. Both local and signed fixtures use the package produced
by the normal explicit CLIENT pipeline, not a special hand-extracted server fixture.
The independent canonical control fixture is separate from compiler output.

Observed diagnostic Chrome timings in an isolated run were about **80 ms** local
bootstrap and **17 ms** navigation, **51 ms / 14 ms** for signed bootstrap/navigation.
These are single-host observations including scheduling/protocol overhead, not
performance guarantees. Native control interaction/keyboard behavior was verified;
this does not claim a complete screen-reader, Firefox/Safari or mobile audit.

## Security and compatibility evidence

| Boundary | Coverage |
| --- | --- |
| Control metadata | Unknown fields/attributes, malformed action, duplicate identities, private action, missing approval and incompatible signatures reject staging |
| Input record | Required/length constraints, exact fields, invalid select, Integer overflow/fractional or malformed numeric text, malformed UTF-16, unsafe keys/prototype pollution and native Event objects reject before method invocation |
| DOM identity | Cloned/forged IDs do not acquire listeners; transplanted/detached elements fail ownership; synthetic events can invoke only already approved actions |
| Lifetime | Old controls after rerender/key retirement, repeated Unload/reactivation, duplicate listener prevention, pending root unmount and direct form removal cancel future work |
| Root isolation | Independent inputs/actions, nested foreign form event does not bubble into parent application dispatch, survivor after teardown, stale remount references |
| Execution resources | Field preparation shares the method/event/hook/render ledger; recursive typed event storm terminates; busy state clears on failure; overlapping submissions do not start fresh concurrent chains |
| Publisher/packages | Wrong/missing exact package version, bad signature, package self-approval attempts, unverified publisher and untrusted static library rejection; no grant union |
| Compiler/target | Unsupported contexts/renderer/target, private/mismatched method signatures, unavailable/mispinned helpers and forbidden capabilities retain source diagnostics |
| Injection | Author values use text nodes/fixed attributes; independent artifact fixture displays script-like text without creating elements; no DOM/Event/host facade enters SEWN |

The existing server semantic Field validation and canonical conversion are reused.
Input validation is atomic before dispatch; application SEWN mutations retain H3's
established partial-progress behavior after later errors. Action methods retain their
ordinary canonical signatures for other authorized SEWN/host calls; the native form
record contract is enforced at the interaction adapter, not as a new Object type.

Independent canonical numeric/string/Boolean/collection/DateTime/interface/static
and event-ordering evidence runs in Wydgine and both alpha.7 bundle forms, with
alpha.6 compatibility retained. Control metadata/type validation is shared, but
schema 0.2 is explicitly CLIENT-targeted. Server component/renderer entry rejects it;
no equivalence between native events and HTTP forms is claimed. Existing SERVER
family/package behavior and H1–H3 browser fixtures remain passing.

## Builds, package and distribution

`build-client-package.js` consumes the checked-in explicit six-file CLIENT source
inventory. Reordering the source map reproduces the package and registry; the generated
example matches normal build output. Static helper imports retain exact manifest pins
and independently verified availability. Ed25519 signing is deterministic for the
same reviewed bytes/key; integrity and identity use the existing browser envelope.
Permissions and signing never supply execution approval.

WydClient package, lockfile, runtime version, current examples and versioned size
reports agree on **0.1.0-alpha.7**. WydSUB remains **0.1**. The source compiler,
IR lowerer, package builder/signer, HTTP machinery, server renderer and storage
adapters remain outside the standalone classic browser bundle. No UI dependency
or framework was added.

| Bytes | Alpha.6 | Alpha.7 | Growth |
| --- | ---: | ---: | ---: |
| Readable | 485308 | 505469 | 20161 |
| Minified | 300278 | 312377 | 12099 |
| Gzip | 96505 | 100323 | 3818 |
| Brotli | 83803 | 86636 | 2833 |

The increase is shared semantic validation, native interaction/draft/accessibility
machinery and the lifetime guard. Historical alpha.1–alpha.6 files and versioned
reports are byte-identical. The Git-history guard remains enabled, including its
missing-history failure path. Repeated alpha.7 builds compare exact hashes before
and after the final build. Client packaging is a dry run; nothing is published.

## Deliberate limits and next work

All required H4 controls and acceptance paths are implemented within the documented
closed profile. No general browser-service/storage/network capability is enabled.
The sample stores at most three additional in-memory tasks. Notes are feedback only;
reload loses local records. Numeric input uses explicit bounded text conversion;
there are no numeric spin buttons/range controls, file/password fields or rich text.
Only declared public method actions are supported; no arbitrary event reflection,
property-write binding or raw browser-event payload exists.

Native maxlength can be stricter than canonical Unicode character counts. Validation
feedback is accessible but intentionally general. Focus/caret restoration is best
effort for native controls that expose those APIs. There is no arbitrary DOM-element
identity stability across renders. Drafts survive Unload but not Dispose/unmount.
Normal SUB completion is the success/reset boundary; business rejection can be
reported through application state, but there is no new transactional return protocol.
The current WBasic syntax uses default success reset; canonical manual reset remains
available to independently authored metadata.

Same-realm host JavaScript is trusted. Mounting directly inside owned runtime regions
remains forbidden; independently mounted roots can be relocated by the host without
obtaining another root's authority. Server rendering of CLIENT controls is unsupported.
General .wydpkg unification, production deployment, persistence, API/OAuth adapters,
cross-origin isolation and the independent security audit remain excluded.

Recommended next milestone: focused accessibility/cross-browser review and reviewed
semantic service profiles, with persistence and isolated embedding scoped separately.
