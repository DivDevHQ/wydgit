# H5 platform consolidation review

Baseline: `e8af7577d5f4ff478081e593ab6fe04477a8c644`, `develop/0.3`.
The starting tree was clean and matched `origin/develop/0.3` after fetch.
This is an internal engineering review of implemented contracts, not an independent
security audit or a proof that no other defects exist. The independent audit remains
0.3-L. Verification and exact commands are in [verification.md](verification.md).

## Scope and method

Reviewed the founding architecture, development rules, current object/SEAM/SEWN,
component/event/service/package contracts, H0–H4 reports, WBasic/IR authoring paths,
workspace manifests and release history. Traced the production entry boundaries and
compared them with tests and current documentation. Executed the full repository
suite, standalone browser acceptance and public authoring workflow. No redesign,
new service, multi-App host or speculative cleanup is included.

A passing test is evidence for its assertions, not blanket certification of a
subsystem. Server adapter and hostile service tests use temporary providers and
local network fixtures. They are not proof of a live external S3 deployment,
real-world media codec validation or every browser/accessibility combination.

## Implemented inventory

I/V means implemented with reproduced suite evidence; I/L means implemented with
important documented limits. Paths name the authoritative implementation and contract,
not a claim that every line has received an independent adversarial audit.

| Subsystem / version axis | Interfaces and dependencies | Status, evidence and restrictions |
| --- | --- | --- |
| Canonical objects, JSON `wydgit/0.2` | `wydgine/object-model/{prototypes,schema,validation,members,interfaces}.js`; [canonical OOP](../../canonical-oop.md), [objects](../../object-model.md) | I/V: single inheritance, abstract/concrete classes, declaring owners, virtual overrides, interfaces/casts, public/private/protected/friend checks; verified publisher bindings. Cross-publisher inheritance is constrained, not general multiple inheritance. |
| Instance ownership/mutation | `construction.js`, `mutation.js`, `forms.js`, hydrated immutable snapshots and trusted edit sessions; [mutation contract](../../mutation-model.md) | I/V: complete candidate validation, named ordered slots, parent ownership, cycle/type/cardinality checks, consumed drafts, stale/foreign reference rejection. IDs identify data; bound references authenticate access. |
| SEWN through 0.18 execution grammar; 0.19/0.20 class/component metadata | `wydgine/sewn/{schema,validate,execute,types,operations,numeric,dates,regex}.js`; [SEWN](../../sewn.md) | I/V: closed schemas, typed procedures/methods, collections, conversions, DateTime, bounded RE2 regex, errors and static helpers. WBasic release numbering is not a new SEWN opcode grammar for every release. No JavaScript evaluator for publisher code. |
| SEAM/context/entry/ledger | `seam/context.js`, `sewn/entry.js`, `sewn/budget.js`, member adapters; [SEAM](../../seam.md) | I/V: branded frozen contexts, opaque WeakMap bindings, capability plus visibility/scope/traversal checks, caller authority. Roles, package signatures and serialized labels cannot mint authority. Host JavaScript remains trusted. |
| Wydgine/platform 0.3.0-alpha.8 | `app.js`, `wydgine/host.js`, `http/`, Hono adapter, repository/configuration; [transport](../../http-transport.md) | I/L: single-App server host, routing, forms, response/file/media adapters and explicit libraries. One installed package principal per Page; multi-App hosting is future I. |
| WydClient 0.1.0-alpha.8 / WydSUB 0.1 | `packages/wydclient/src/{runtime,registry,execution,packages,network,portable,controls}.js`; [client](../../../packages/wydclient/README.md) | I/L: classic browser script, document and embedded roots, staged loading, signed envelopes, native controls and shared canonical execution. No browser compiler/services/storage/general DOM. Root isolation assumes trusted same-realm host JavaScript. |
| Instance lifecycle / typed events | `execution/instances.js`, `events/runtime.js`, `object-model/component-contracts.js`; [components](../../components.md), [events](../../events.md) | I/V: Init once, repeatable Preload/Render, Unload/reactivation, child-first idempotent Dispose, nominal typed events, FIFO events/sequential registration order, lifetime-scoped subscriptions and shared budgets. Browser Page mapping is explicit; Server/Session and HTTP Page.Validate are unsupported there. |
| Presentation / controls | Shared `presentation-contract.js`, `controls.js`; server `components.js`, browser `portable.js`; [H4](../0.3-H4/README.md) | I/L: public scalar bindings and keyed repetition; CLIENT schema 0.2 native label/status/button/form/text/textarea/checkbox/select/submit/reset. Typed atomic input validation, drafts and controlled actions. Server schema 0.1 is richer; CLIENT controls are explicitly rejected by server presentation. Browser Markdown remains literal. |
| WBasic 0.20 / shared definition IR 0.19 and 0.20 | `wydbasic/{parse,compile,class,family}.js`, `definitions/`; [implemented guide](../../wydbasic.md), [reference](../../wbasic-language-ref.md) | I/V: one frontend/lowerer, SERVER default and explicit CLIENT build profile, dependency ordering and contextual diagnostics. The proposed 1.0 reference is not an assertion that all its syntax exists. Other language frontends remain planned. |
| Static libraries | `static-libraries/`, exact manifest dependencies and verified registry; [specification](../../wydgit-static-libraries-spec.md) | I/V: explicit version-pinned SEWN linking, private helper isolation, caller authority and shared accounting. Not arbitrary JavaScript or implicitly shared mutable state. |
| Package authoring/installation | `packages/`, `wydbasic/client-package.js`, `scripts/{install-package,build-client-package}.js`; [local installer](../../packages.md), [CLIENT build](../0.3-H4/README.md) | I/L: deterministic explicit source inventory, validated IR/canonical artifacts; staged local server install/rollback; browser SHA-256/Ed25519 verification with independently trusted keys/origins and exact execution approval. Server installer has no general remote signing, upgrade or uninstall. `.wydpkg` ZIP/registry architecture is a proposal, not this browser envelope. |
| WydStore 0.1.0-alpha.3 / API 1.0.0 | `packages/wydstore/src/`, canonical dispatch, JSON/SQLite providers; [contract](../../wydstore.md) | I/L: typed records, queries, history, optimistic concurrency and bounded transactions. Resource ownership and exact store/collection scopes are separate from capabilities. JSON local/cooperating-process durability differs from SQLite; history is not backup. |
| WydSearch 0.1.0-alpha.1 / API 1.0.0 | `packages/wydsearch/src/`, approved WydStore dependency; [contract](../../wydsearch.md) | I/L: bounded indexing/query, trusted destination resolver, server search components. Explicit indexing refresh; no background watcher or general external search engine. |
| WydFiles 0.1.0-alpha.1 / API 1.0.0 | `packages/wydfiles/src/{index,contract,operation,local,s3}.js`; [contract](../../wydfiles.md) | I/L: App/publisher/package/principal/installation/path/action checks, logical mounts, local and S3-compatible providers, bounded streams/retries/deadlines/quotas. Credentials and native streams stay host-side. OS calls cannot always be physically canceled; external namespace mutation/distributed writers limit quota guarantees. Requires Node >=24.21. |
| WydStream 0.1.0-alpha.1 / API 1.0.0; WydMedia integration | `packages/wydstream/src/`, WydStore + WydFiles or retained legacy local provider; [stream](../../wydstream.md), [media](../../wydmedia.md) | I/L: bounded upload tickets/metadata/binary delivery/recovery and installable UI. Publication is recoverable, not a transaction spanning all providers. Signature sniffing is not malware scanning/full codec validation. |
| WydGate 0.1.0-alpha.4 / API 1.0.0 | `packages/wydgate/src/{core,sessions,authorization,membership,passwords,transport}.js`, private approved WydStore binding; [membership](../../wydgate-membership.md) | I/L: Argon2id local credentials, revocable sessions, roles/groups, App memberships, browser forms, invitations/recovery and owner bootstrap. Identity facts never become SEAM grants. Bounded local directory; no OAuth/federation/distributed abuse limiter. |
| Configuration, diagnostics and errors | `wydgine/libraries/{contracts,index,dispatch,limits}.js`, HTTP transport and `WydgitError` | I/L: closed host configuration, explicit library loading, request/result JSON budgets, sanitized structured service/execution errors and injectable host logger. No general observability/secret-management service is implied. |
| Recovery and operations | Installer recovery files, SQLite journaling, JSON replace/locks, media reconciliation and Gate recovery | I/L: subsystem-specific recovery with documented crash/durability boundaries. No general scheduled backup/restore orchestration; operator backups remain necessary. |
| Tests/distribution/examples | `test/`, client tests, Chrome runners, `build.js`, `artifact-policy.js`, explicit sample sources | I/V: default process-isolated full suite, focused suites, actual current classic artifacts, deterministic builds/history guard. Test-library is non-production. Native dependencies, sockets, complete Git history and Chrome are environment requirements. |
| Planned / superseded surfaces | Founding vision and draft specs; old client distributions and milestone reports | Multi-App I, administration J, CMS K, independent audit/release hardening L, general registry/ZIP, persistence in WydClient, isolated embeds, Wython/Wuby/native adapters remain planned. H1/H2 execution deferrals and H3 control deferrals describe historical versions only. |

## Findings register

No critical or high-severity vulnerability was demonstrated by this review. This
is a statement about findings, not certification. No speculative feature absence
is counted as a security defect.

| ID / subsystem / severity | Description, evidence and impact | Remediation / final disposition | Regression evidence / remaining risk |
| --- | --- | --- | --- |
| H5-01 client profile — Low, contract defect | `portableComponent` recursively scanned `literal.value`, rejecting valid inert records with `op:service` or `op:context,name:SESSION`. A production runtime activation regression failed before correction. Canonical SEWN accepts these data records; the browser profile incorrectly treated them as instructions. False rejection, not privilege escalation. | Fixed by stopping capability scanning at validated literal expressions. Canonical validation still validates/bounds the complete literal. Allocated alpha.8 because the changed validator is in the browser closure; alpha.1–alpha.7 preserved. | New source/readable/minified execution regression successfully activates/invokes the method with nested operation-like data. Actual Server context and canonical service expressions still reject. This is not permission to execute an instruction stored in data. |
| H5-02 current documentation — Documentation | Root README still said 0.2, future client execution, no bootstrap/signatures; packages documentation did not qualify server-only deferrals. Current library READMEs gave Store alpha.2 and Gate alpha.3 despite manifests alpha.3/alpha.4. Package README had two “current” versions. These misdirect authors and obscure target boundaries. | Replaced root README with current-first architecture, tested WBasic quick start, authority model, actual capabilities/limits, links and roadmap. Scoped installer deferrals, marked historical client heading, corrected package versions and superseded media deferrals, distinguished implemented envelopes from proposed ZIP. | Public CLI/Chrome quick start, existing example regressions, local link-target scan, manifest/version/build tests. Historical milestone results and changelog entries retained. Draft specifications still contain proposals explicitly labeled as such. |
| H5-03 test cleanup — Low, test defect | First `client-authoring.test.js` case created `h4-client-*` via mkdtemp without removing it. Each run leaked generated package output. It did not demonstrate cross-test authority leakage or cause the old stalls. | Added test teardown for the unique temporary directory. No assertions or resource gates weakened. | Existing deterministic build assertions continue executing with teardown. No cleanup of unrelated historic temporary directories is attempted. |
| H5-04 test reliability — Low, fixture defect | Renderer HTTP test awaited only `listening`, without rejecting a bind error or registering teardown first. Restricted H5 left that worker pending; a stale H3 process had the same worker and baseline-log ownership. Unrestricted default baseline passed 771/771 in 22.5s. | Replaced the listening-only promise with Node `events.once`, which rejects server errors; registered cleanup before awaiting. Stopped only the identified stale repository test processes. Default isolation retained; not every old interrupted run is explained by this finding. | Restricted renderer reproducer now exits with explicit EPERM in 384ms (expected environment failure, not a pass), rather than hanging. Complete unrestricted tests verify real HTTP behavior. Native dependencies, sockets and deadline-sensitive operations still require appropriate environments. |
| H5-05 developer workflow evidence — Informational, test gap | The old root quick start started Wydgine but did not show current WBasic CLIENT authoring. Compiler-output assertions alone cannot prove native control execution. | Added a minimal tracked Hello component, explicit build manifest and separately trusted host policy. Chrome runner copies sources/config into a fresh temporary author directory and invokes the public CLI, then serves its generated registry and uses a native mouse action. | Actual alpha.8 Chrome state changes to “Hello from SEWN!”; Taskboard native mouse/keyboard, signed package and embedded roots remain acceptance gates. This is not cross-browser/screen-reader certification. |

## Architectural and security conclusions

The inspected paths use one canonical object kernel and one SEWN executor.
`members.js` resolves access/declaring context; `entry.js` binds exact registry,
context and live handle; browser receiver tokens are root-local WeakMap entries.
Construction goes through canonical drafts/attachment and complete hydration.
No second browser object model or language interpreter was added to address H5-01.

Server and browser intentionally use different transport/presentation profiles.
Shared class/interface/type/static/event semantics have independent canonical
conformance fixtures, not solely compiler-output snapshots. Browser profiles reject
services, Server/Session, unsupported presentation and unapproved actions before
activation. Shared component lifecycle/keyed identity cleanup prevents stale IDs
from regaining a retired lifetime. Root membership is not inferred from DOM nesting.

Native controls capture trusted internal binding records. IDs, cloned nodes,
synthetic events and publisher labels supply no new grants. Host-approved method
allowlists and canonical member/capability checks remain in force; native event/DOM
objects do not enter SEWN. Form records are validated completely before dispatch;
this does not make later application mutations transactional. Async guards check
lifetime after awaited work. Same-realm malicious host JavaScript is outside this
boundary; isolated embedding is future work.

Canonical service dispatch checks branded context, capability, exact API version,
request/result shape/size and operation authorization before exposing copied results.
WydStore ownership/scope and WydFiles grant/path checks supplement generic dispatch.
Search/Gate/Stream dependency service calls retain explicit host-owned bindings;
Gate membership/permissions do not implicitly become runtime capabilities. Native
adapters/tooling use Node internally without exposing it to portable applications.
Service-specific sanitized failures hide native implementation errors. Tests exercise
wrong principals/scopes, malformed data, path escapes and provider failures.

`sewn/budget.js` binds a terminal shared ledger to the exact context. Methods,
hooks, custom handlers, construction and rendering consume the same chain ledger.
Exhaustion closes further work; nested events do not obtain a fresh allowance.
Separate user interactions legitimately begin new bounded operations, while the
native adapter permits one pending interaction per root. File retries/stream reads
share a monotonic operation deadline. Service JSON byte/node limits and native
provider limits remain separate enforcement layers, not interchangeable units.

## Server/browser contract reconciliation

| Contract | Wydgine | WydClient | Evidence / disposition |
| --- | --- | --- | --- |
| Typed scalar/collection/DateTime operations | Shared executor | Shared executor | Independent canonical conformance fixture, readable/minified alpha.6/alpha.7/current |
| Member visibility, interfaces, virtual dispatch | Shared kernel | Shared kernel | OOP, class/interface, client execution and forged-owner regressions |
| Static helper calls | Explicit exact links under caller authority | Same, portable operations only | Static-library suite, client authoring pins/trust and canonical conformance |
| Construction / identity | Canonical drafts/slots/ownership | Same kernel, narrower placement/profile | Construction/mutation, consumed draft and stale/foreign receiver tests |
| Lifecycle / typed events / subscriptions | Shared controller and FIFO dispatcher | Same, root-local | Instance/lifecycle/event/failure/teardown tests; native interaction Chrome |
| Execution and event-chain budgets | Shared terminal ledger | Same ledger through native actions and presentation | Shared-budget and recursive event-storm regressions |
| Cancellation / disposal | Lifetime guards and child-first cleanup | Same plus native control/root lifetime guard | Awaited work, removed keyed items, unmount/remount and stale-control tests |
| Page / Server / Session | HTTP Page plus server/session transitions | Explicit browser Page mapping; Server/Session/HTTP Validate unsupported | Profile rejection and Page.Unload-failure tests; not equivalent context emulation |
| Presentation / repetition | Richer server schema 0.1, bounded typed keyed templates | Closed structural/scalar profile and CLIENT controls schema 0.2 | Taskboard/server tests and native Chrome keyed/state updates; richer server rendering unsupported in client |
| Native controls and services | HTTP forms and approved server services | Native typed forms; general service calls unsupported | Independent controls fixture, signed package Chrome, malformed input and target rejection |

## Test quality and reliability

Production fixtures include independently authored canonical JSON, actual classic
readable/minified artifacts and real Chrome mouse/keyboard actions. Happy DOM is
unit/integration evidence, not the browser acceptance result. Signed Chrome packages
use generated bytes plus an ephemeral Ed25519 key and independent exact approval.
The host harness initiates native input or lifecycle operations, not Taskboard business
logic. Existing hostile package, cross-root/App, stale reference, lifecycle failure,
shared event-budget and Guestbook persistence regressions remain intact.

Reviewed fixture use of mkdtemp, ephemeral port 0, shutdown/teardown and browser
subprocess cleanup. Found/fixed one temporary build leak and one listening-only wait that hung on
restricted bind failures. The ordinary unrestricted suite reproduced success with
default isolation. The stale H3 worker corroborates that particular environment
failure, but other historical stalls were not independently reproduced. It would be
unjustified to attribute all of them to either finding or change runner isolation.
The restricted attempt demonstrates why environment failures must be separated from
runtime defects. Content checking validates three rendered sample pages; it is not a
repository-wide Markdown or external link checker. A separate local link-target scan
covers current overview/specification/workspace README targets in this review.

## Retained limitations and readiness

No confirmed critical/high defect is being deferred. This bounded internal review
cannot replace hostile independent testing in L. Browser same-realm trust, no general
backup orchestration, local-provider durability, service capacity limits, external
S3 deployment coverage and incomplete cross-browser/accessibility evidence remain
explicit risks. Exact source diagnostics are useful but not uniformly perfect for
every family-level metadata failure; that is a tooling limitation, not an authority bypass.

The current single-App and one-package-principal-per-Page contracts must be treated
as constraints during I, not silently relaxed by combining contexts or grants.
0.3-I can begin from this tested baseline with explicit per-App configuration,
service ownership, session isolation, routing and resource-isolation acceptance tests.
No multi-App implementation or independent-audit claim is part of H5.
