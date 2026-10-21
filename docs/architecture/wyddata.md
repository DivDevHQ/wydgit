# WydData architecture

**Status:** Accepted design direction with proposed contract details; implementation deferred.

**Recorded:** 2026-10-20

**Scope:** Documentation only. No WydData implementation, new public API, wire schema or release commitment is established here.

## Design status and release boundary

The accepted direction separates persistence, access to data resources and reusable
presentation. It does not divide local and remote databases into different libraries.
The operation shapes, metadata and behavior below are proposals for review before a
separately scoped implementation.

| Category | Meaning in this document |
| --- | --- |
| Accepted direction | WydStore owns persistence; WydData offers a generic provider/resource model across Store-backed, REST and SEAM/computed sources; ordinary Wydgits provide reusable presentation. Existing SEAM, object identity and placement rules govern all three. |
| Existing foundation | WydStore implements JSON and SQLite, typed records, revisions, queries, count and read-only schema metadata. Declarative components, typed repetition, forms and the bounded BackOffice action UI supply reusable foundations, with their documented limits. |
| Proposed specifics | WydData resource descriptions, capability negotiation, query/page/result contracts, generic control behavior and remote operation handling in this document. Names are conceptual, not accepted language, manifest, service or endpoint syntax. |
| Deferred implementation | WydData providers and controls, MySQL/PostgreSQL Store engines, any open wire protocol and any CIR integration require separate design review, versioned contracts, implementation and qualification. None is delivered or scheduled by this document. |

The [current 0.3 release scope](../milestones/0.3-release-status.md) remains
unchanged. 0.3-J remains Platform/App Administration; managed hosting qualification
remains deferred under [Decision 0003](../decisions/0003-defer-managed-hosting-qualification-to-0.4.md).
[WYDGINE-0.3-HTTP-LIMIT](../milestones/0.3-reliability.md) remains open. WydData
is neither a correction nor a release waiver for committed-but-indeterminate HTTP
operations. This design adds no requirement to finish WydData in 0.3 or 0.4.

## Persistence, resources and presentation

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| WydStore | Persistence models: stores, collections, typed records, validation, original/current values, dirty tracking, record revisions/history, queries and provider-specific durability/transactions. | JSON and SQLite are implemented. Planned SQL engines, including MySQL and PostgreSQL, belong here even when reached over a network. Portable code never receives SQL, connections or paths. |
| WydData | A common provider/resource model for discovering supported operations and consuming records or computed values through a bounded contract. | A Store-backed provider delegates to WydStore; REST providers adapt approved external APIs; SEAM/computed providers call approved services or derive bounded results. A source need not be persistent or writable. |
| Reusable Wydgits | DataTable, DataPager, DetailForm and application-specific lists, cards and editors; field presentation, navigation, selection and edit state. | Ordinary prototypes compose data services and semantic presentation. Wydgine owns server execution/transport; WydClient owns client adaptation. Controls do not implement databases, transports or authorization. |

A Store-backed resource has two distinct adapter boundaries: WydData adapts the
resource contract to WydStore, and WydStore adapts persistence to its engine. Using
MySQL or PostgreSQL does not make WydStore into WydData. Conversely, adapting an
external REST resource does not require inventing a Store collection, local mirror,
record history or transaction guarantee that the source does not provide.

WydStore's typed record model is not the canonical Wydgit prototype graph. Persistence
does not own object identity or inheritance. Existing WydStore facades remain valid;
this direction does not require every Store caller to pass through WydData.

## Proposed provider and resource model

A **provider** is an approved implementation of the common data contract. A
**resource** is a named logical collection or bounded data view exposed by that
provider. Its binding identifies the exact App, owner/resource scope and lifecycle;
a matching friendly name on another App is not the same resource.

Proposed resource descriptions include a logical identity, contract version,
optional schema identity/version, stable record-key semantics where available,
supported operations and their limits. They omit credentials, native handles,
physical destinations and private provider settings. A record key is distinct from
a display label, Wydgit instance ID and revision token. Sources without stable keys
must say so and cannot promise durable selection or generic record editing.

Provider families have different guarantees:

- **Store-backed:** retain Store validation, exact ownership, current policy checks,
  revisions and qualified provider guarantees. Do not bypass the caller-bound facade.
- **REST:** translate approved endpoint contracts, field mappings, pagination,
  errors and conditional writes. Preserve upstream limitations rather than silently
  presenting every API as a fully transactional database.
- **SEAM/computed:** invoke approved bounded services under caller authority or
  derive values from authorized inputs. Read-only aggregates and transient results
  are valid resources. Explicitly identify any commands with side effects; rendering
  or querying a computed value must not secretly execute a mutation.

A provider's technical **operation capabilities** describe what it can do. They are
not SEAM grants. Effective availability is the intersection of contract support,
current caller authority, scope, policy and source availability. Discovery may be
filtered for the caller, but every operation independently reauthorizes at the
trusted boundary. There is no generic operation that accepts arbitrary service
names, URLs, host objects or executable expressions from an ordinary Wydgit.

### Capability-based operations

The following conceptual names describe the proposed common contract, not new
WydBASIC/SEWN syntax or changes to existing WydStore operation names.

| Operation | Proposed semantics | Required declaration |
| --- | --- | --- |
| Read | Fetch one authorized record by stable key. | Key format, missing/denied behavior and available revision metadata. |
| Create | Create a record from bounded validated fields. | Writable fields, key allocation, defaults and replay/idempotency support. |
| Update | Apply a declared replacement or patch to one record. | Exact update semantics, writable fields, revision/precondition support and conflict behavior. |
| Delete | Delete one record under the source's declared semantics. | Hard deletion versus tombstone behavior, preconditions and replay guarantees. |
| Query | Select a bounded page using supported filters and sort keys. | Query grammar/operators, field rules, limits, ordering and pagination mode. |
| Count | Count authorized matches independently of a page. | Exact versus estimated count, supported filters, freshness and any snapshot relation to query. |
| Schema | Read a safe resource/field description. | Types, required/default/read-only fields, constraints and schema version where available. No schema alteration is implied. |

Unsupported operations fail explicitly before side effects. A control must not
simulate unsupported update as delete-and-create, or count by unbounded traversal.
Transactions, history, bulk writes, joins, subscriptions and schema mutation are
optional future extensions, never inferred from CRUD support. Resource capability
and schema descriptions can change; stale bindings must fail or refresh explicitly
without silently repeating an operation.

### Filtering, sorting and pagination

The proposed query contract uses a bounded, declarative filter tree over declared
fields and operators, plus an ordered list of sort keys. Providers publish the
supported types, operators, null/missing behavior, comparison rules, limits and
stable tie-breaker. Unsupported semantics reject explicitly; no raw SQL, JavaScript,
callback or backend expression crosses the portable boundary. Providers may
translate or perform bounded local work only when it preserves the declared query
semantics. Filtering or sorting one fetched page cannot masquerade as a query over
the full resource.

Pagination declares offset/limit or opaque cursor support, maximum page size and
safe continuation information. A proposed page result contains records, applicable
record revisions, continuation state and optional count metadata with its accuracy
and consistency qualification. Unknown total is a valid result; end-of-data must
not be inferred from an invented total. Cursors bind to resource, query/sort,
caller scope and lifetime as appropriate, and are opaque data, not authority.

Stable ordering does not imply a stable snapshot. Query and count from separate
requests may observe different states. A provider may promise snapshot-consistent
pages/counts only with explicit snapshot identity, expiry and qualified source
support. Otherwise concurrent changes may cause moved, repeated or missing rows;
controls explain that boundary and allow refresh. Changing filters or sorting
resets pagination. Cursor expiry/staleness requires an explicit fresh query.

The existing [WydStore query contract](../wydstore.md#query-contract) remains
specific: bounded offset/limit, declared filter/sort rules and an ascending record-ID
tie-breaker, without a cross-request snapshot or cursor guarantee. A Store-backed
WydData provider must preserve those limits rather than relabel them as stronger
remote guarantees.

## Inheritance, specialization and repeated templates

Inheritance defines Wydgit identity and reusable behavior; dependencies provide
services. A shared data-view prototype can define selection, loading/error states,
query state and approved provider binding. Descendants can specialize columns,
labels, record templates or domain validation while preserving the base contract,
visibility, inherited restrictions and caller authority. Provider implementations
may share a base or implement the same interface independently. Neither inheritance
nor interface conformance grants resource access.

Reusable views compose a provider/resource dependency rather than inherit from a
database engine. A guestbook list and a BackOffice roster can reuse presentation
patterns while retaining separate bindings, policy and edit permissions. No new
multiple-inheritance or parallel object model is needed.

Repeated templates turn authorized bounded records into reusable row, card or
field presentations. Use the existing [component and typed repetition foundations](../components.md#source-authored-composition-and-typed-repetition-020),
with stable record keys where available, declared typed inputs, controlled child
lifetimes and normal construction/render budgets. A computed value without stable
identity can be displayed but must not acquire a fabricated persistent identity.
Reordering, page changes and removal must clean up old child bindings and edits.

Data remains data: source values cannot replace validated templates, contribute
executable markup or become provider callbacks. Provider/service calls happen at
explicit authorized preparation/action boundaries, not once per row during rendering.
Shared behavior does not imply that every existing renderer supports the same
repetition or client execution features.

### Proposed reusable controls

| Wydgit | Responsibility | Behavior when support is absent |
| --- | --- | --- |
| DataTable | Display a bounded page with declared columns and row templates; selection; explicitly supported filter/sort interactions. | Hide or disable unsupported operations; show loading, empty, denied, stale and error states without exposing private diagnostics. |
| DataPager | Consume page/continuation metadata and request explicit navigation through the view's query state. | Cursor-only sources get supported next/previous navigation, without invented page numbers, random access or totals; unknown total remains unknown. |
| DetailForm | Present one record, track original/draft values, validate declared fields and submit an explicitly supported create/update/delete action. | Use read-only presentation where writes are unavailable; refuse unsafe generic edits when required key, schema or concurrency guarantees are absent. |

DataPager and DataTable share one resource/query state so counts, filters and
selection cannot silently refer to different queries. DetailForm preserves drafts
on conflict, reports safe field errors and requires explicit conflict resolution or
refresh. It must not silently overwrite a newer record. Unknown schema may require
an explicitly authored form; discovery is not permission to expose every field.
Writes require intentional actions and applicable confirmation; a render or page
navigation cannot save a record. Keyboard, focus, labels and result announcements
belong in the renderer's qualification for these controls.

These names describe proposed ordinary reusable Wydgits. The current
[BackOffice shell](../backoffice-http-and-ui.md) already renders bounded action
forms/results and pagination metadata; that does not establish implemented
WydData, DataTable, DataPager or DetailForm contracts.

## Placement, authority and security

Use the existing [execution-context foundation](../execution-context-foundation.md).
Server execution requires trusted FrontEnd or BackOffice placement; Client resolves
to SUB. A browser showing BackOffice controls still executes Client/SUB, while the
server independently admits the BackOffice operation. Placement is not a grant.
Public FrontEnd views expose only authorized projections; BackOffice forms require
their own current identity, application permission, capability and resource checks.
FrontEnd and BackOffice may share their site's resources under different grants;
that does not open another site, account or provider domain.

At discovery, dispatch and each protected source operation, preserve caller SEAM,
exact App/publisher/package/installation ownership where applicable, approved scope,
current Gate policy and live session/placement/receipt generations. A provider
binding or privileged service dependency cannot lend its authority to a caller.
Revocation, package replacement and retired placement fence stale work; caches and
copied metadata cannot revive it. Long-running admitted effects retain truthful
completion status even when authority expires before publication.

Trusted adapters retain credentials and approved destination mappings. Outbound
requests require separately approved network/destination authority, bounded
redirect behavior, timeouts, bytes and concurrency; untrusted URLs must not create
server-side request forgery or credential forwarding. Client-side provider bindings
are suitable only where a qualified runtime can safely enforce the contract without
exposing server secrets. Browser origin, CORS, consent and cookie rules are additional
constraints, not substitutes for server authorization.

Validate closed inputs/results, field allowlists and schema versions; bound queries,
pages, nested values, rendering, queues and native work. Redact sensitive fields and
prevent record-existence leaks on denial. Authenticate remote peers and requests;
use TLS where credentials/private data cross networks, origin/CSRF protections for
cookie-authenticated browser mutations, safe text rendering and protected audit
records without credentials or raw private payloads. Use existing canonical services
and dispatch rather than creating parallel permission or transport escape hatches.

## Remote writes, revisions and uncertain completion

Proposed remote operation handling keeps three facts distinct: record revision,
operation identity and delivery outcome. A revision detects stale edits; an
idempotency key identifies an attempt; receiving an HTTP response proves only what
that response's qualified contract states.

- **Conditional changes:** submit the expected revision or qualified source
  precondition for update/delete. Conflicts preserve the draft and return a safe
  conflict result; they do not retry with a newer revision. Create must declare
  duplicate-key behavior. Providers lacking concurrency support disclose that limit
  and cannot advertise protected generic editing.
- **Idempotent submission:** where supported, use one durable operation identity
  for retransmission of the same intent. Bind it to principal/owner, resource,
  operation and canonical request digest, including preconditions. Reject key reuse
  with different input. Reauthorize access to any retained outcome; deduplication
  must not become a stale authorization grant or disclose foreign results.
- **Durable deduplication:** declare retention, expiry, concurrent-duplicate handling,
  restart recovery and the atomic relationship between recording the outcome and
  applying the effect. A server cannot claim replay safety if a crash can commit
  the effect but lose the only deduplication record. Upstream support or a qualified
  reconciliation strategy is necessary; a local cache alone is insufficient.
- **Truthful outcomes:** distinguish rejection before admission, known completion
  with a qualified result/revision, and indeterminate completion. Timeout, abort,
  disconnect, missing response or an error after admission may follow a committed
  write. Cancellation is a request to stop, not proof of rollback. Do not label
  an admitted failure as definitely uncommitted without evidence.
- **Reconciliation:** use an authorized bounded operation-status lookup or source
  read/inspection where available. Retransmission is safe only under an explicit
  supported idempotency contract, using the same identity and request. If outcome
  or retention is unknown, keep it indeterminate and require explicit resolution;
  a new key or provider switch can duplicate the effect. UI submission fencing is
  useful but is not durable deduplication or an exactly-once guarantee.

Current BackOffice
[action outcome headers](../backoffice-http-and-ui.md#alpha22-reliability-amendment)
are admission/publication signals, not provider commit receipts or a durable
idempotency protocol. Existing no-automatic-replay behavior remains authoritative.
This document does not add remote retries, operation-status endpoints or a new
transaction spanning Store, HTTP and external services.

## Optional open HTTP/JSON protocol

An open, versioned HTTP/JSON wire protocol could let WydData consume compatible
resources across independently implemented servers and clients. It is optional;
providers may adapt an existing API without the upstream server adopting Wydgit.
A compatible resource endpoint also need not run Wydgine, SEWN or WydStore.

Before implementation, specify and review resource/capability/schema discovery,
closed request/result envelopes, record keys and revisions, CRUD/query/count
mapping, filter/sort semantics, pagination and count accuracy, structured safe
errors, conditional requests, idempotency/status reconciliation, authentication,
origin/CSRF behavior, bounds and version negotiation. Protocol version is distinct
from schema version, record revision, provider implementation version and the
Wydgit object/SEWN protocols. Unsupported versions/features must reject explicitly.
Transport statuses alone cannot hide ambiguous commit outcomes.

This is a proposed interoperability direction, not an adopted standard or current
endpoint contract. No route, media type, capability name, credential scheme or
schema identifier is reserved here. It must not reinterpret the existing bounded
BackOffice action endpoints as a public generic CRUD/RPC API.

## CIR relationship and work before implementation

[Contextual Implementation Resolution](contextual-implementation-resolution.md)
remains proposed only. It could later select a qualified provider or presentation
adapter behind a compatible contract using trusted environment facts. WydData can
start with explicit approved bindings and does not require CIR. Neither selection
nor fallback grants authority, rewrites canonical prototype identity or permits
trying another provider after an uncertain write.

Before a separately authorized implementation, close the minimal versioned resource,
capability, schema/query/page and error contracts; select initial providers and
control boundaries; define lifecycle/revocation and revision/idempotency guarantees;
and qualify them against real source behavior. Conformance must cover read-only and
partially capable sources, both Store engines, unsupported query semantics, cursor
expiry, concurrent edits, hostile data, cross-App/owner denial, stale bindings and
crash/disconnect after commit. Remote idempotency needs concurrent and restart
failure evidence. Controls need renderer-specific accessibility and lifecycle
qualification. These are future acceptance requirements, not tests passed by this
documentation update.
