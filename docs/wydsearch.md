# WydSearch — 0.3-C

WydSearch `0.1.0-alpha.1` exposes canonical service API `1.0.0`. It uses the
existing SEAM dispatcher and a host-approved WydStore dependency, with identical
application behavior on JSON and SQLite. SQLite is recommended for production.
This is bounded site search, not an internet-scale search engine.

## API and authority

Call `SERVICES.Invoke("wydsearch", "1.0.0", operation, input)` from SEWN/WydBASIC,
or a caller-bound dispatch from trusted host code. Legacy `Call` is rejected.
Every input contains an `index` logical ID. Host configuration fixes its App and
physical WydStore resource.

All configured indexes must match the App of the approved WydStore dependency
binding. This initial library instance serves one host App; per-request inputs
cannot route to another site's storage.

Callers need an exact `scopes.wydsearch` index grant:

```json
{"wydsearch":[{"index":"site","resources":["getting-started","security"]}]}
```

Read operations need only the index grant. Maintenance also needs each resource
in `resources`, and matching trusted publisher/package/principal ownership from
the source resolver. Identity and roles never grant SEAM capabilities. Unknown
indexes and cross-App access fail `SEARCH.DENIED` without returning index data.

| Operation | Input in addition to index | Capability | Result |
| --- | --- | --- | --- |
| index | id | search.documents.index | changed: 0 or 1 |
| remove | id | search.documents.remove | changed: 0 or 1 |
| reindex | ids: bounded, distinct document IDs | search.index.rebuild | changed: count |
| search | query; optional type, category, offset, limit | search.documents.read | results, total |
| suggest | same query/options as search | search.documents.read | suggestions: title/url pairs |
| metadata | none | search.documents.read | apiVersion, schemaVersion, visibleDocuments |

`index` obtains document contents from the trusted resolver; it does not accept
caller-supplied ownership, visibility, text, or revision. `reindex` refreshes an
explicit batch of source IDs, including removing unpublished entries. It is not
an unrestricted collection scan or a command to erase other owners' documents.
`remove` retains the index record and its WydStore history. Missing indexed entries
are idempotent, but their source ownership must still be established. A deleted
source should return an owned unpublished tombstone until maintenance is complete.
An unknown source fails closed rather than accepting request-supplied authority.

Search results contain `id`, `title`, same-site `url`, `type`, plain-text `snippet`,
and `score`. Counts, suggestions and metadata include only currently authorized,
published, up-to-date indexed documents. No physical path, adapter, owner, protected
type/category enumeration, global document count, or index-storage size is exposed.
No stored body is returned. Empty queries return an empty result set.

## Trusted indexing interface and document schema

The canonical library owns Page source selection and bounded startup refresh in
`packages/wydsearch/src/page-source.js`. A trusted host can supply an alternate
resolver through `loadLibraries({adapters:{wydsearch:{source}}})` or
`createHostApp({libraryAdapters:{wydsearch:{source}}})`. The generic library
initialization hook delivers this adapter only to its approved implementation;
ordinary Wydgits cannot configure it or receive it.
The resolver's `resolve(index, documentId, caller)` must return current source
state or `null`. Its `list(index)` helper is host-only; WydSearch does not enumerate
it. The resolver must enforce its own bounded reads and current authorization.

```js
{
  app: 'example', resource: 'guide',
  publisher: 'example', package: 'example/docs', principal: 'example/docs',
  published: true, allowed: true, visibility: 'public', revision: 'content-hash',
  title: 'Getting started', body: 'Plain searchable text',
  url: '/guide/', summary: 'Optional plain summary', type: 'page',
  categories: ['documentation']
}
```

Required fields are shown above except summary/type/categories/allowed. Omitted
`allowed` always denies discovery. The persisted document adds stable `id`,
`owner`, and `schemaVersion: 1`; the index envelope also has schemaVersion 1.
Index location and App come from host policy. Source ownership and revisions
come from the trusted resolver. Unknown fields and unsupported visibility policies
are rejected. Title, body and summary are plain text, including literal angle
brackets and markup-like strings; the renderer escapes them as text. Destinations are bounded, canonical
same-site paths; schemes, query strings, fragments, backslashes, percent-encoded
delimiters and protocol-relative links are unsupported.

Supported visibility values are `public` and `authenticated`. Both additionally
require `published === true` and a fresh `allowed === true`. Authenticated discovery
also requires a nonexpired trusted identity. The resolver must revalidate session
revocation/current membership when using authenticated content; an old identity
snapshot alone is insufficient. HTTP rendering reauthorizes the current Session
before and after the service call. Roles/groups/permission-list policies are
explicitly unsupported in this milestone; no new WydGate feature is added.

The resolver is called on every query, including suggestions and metadata, before
content can contribute to results or counts. Current ownership, resource, revision,
visibility, and content must match the index. Permission revocation immediately
excludes a document. Changed/deleted/unpublished sources disappear immediately;
changed text is discoverable only after refresh. A resolver failure aborts the
operation with a generic error, never falling back to stale permissions.

## Tokenization and relevance

Text uses Unicode NFKC normalization and case folding via locale `und`; tokens
are runs of Unicode letters/numbers. Accents are preserved, so composed and
decomposed café match but cafe does not match café. Full-width compatibility
characters normalize. There is no stemming, accent stripping, language-specific
word segmentation or fuzzy matching. Punctuation separates tokens.

All distinct query terms must match title/body/categories. Quoted phrases also
must occur as normalized contiguous text in title/body; malformed quotes fail.
Title occurrences score 5, category occurrences 2, and body occurrences 1 (capped
at 10 per term). Each satisfied phrase adds 10. Scores use only the document's
text, with no corpus statistics: protected documents cannot influence ranking.
Results sort by descending score then lexical stable ID. Type/category filters
are exact matches. Pagination uses bounded offsets; it is deterministic for a
fixed index, not a cursor snapshot across updates.

Snippets are bounded normalized plain text around the first query term, using
summary when supplied. The renderer escapes every displayed value. Raw HTML
strings are never a component API, and no index content is passed to Markdown
rendering. Suggestions are bounded visible title/URL matches, not an autocomplete
dictionary derived from private tokens.

## Persistence, consistency and refresh

Each index is one WydStore record: `{schemaVersion:1, documents:[...]}`. A small
bounded scan avoids adapter-specific FTS or a speculative inverted-index system.
Maintenance validates the entire batch before writing and performs one WydStore
transaction. Revision compare-and-swap prevents lost updates; up to three retries
resolve competing maintenance, then `SEARCH.CONFLICT` is returned. Repeated refresh
of unchanged source state does not create a revision.

Search checks its actual effective service response budget before maintenance
commit. WydStore separately checks its dependency/store transaction response
policy before its own commit. No caller can raise either policy. A failure leaves
the previous complete index available. Interrupted reindex batches can be rerun;
there is no partial in-place rebuild, job queue, scheduler, event bus or migration.

Page extraction keeps Markdown rendering and sanitization, preserves block spacing,
and decodes the text-only sanitizer output exactly once with `entities.decodeHTML`.
Deliberately literal entity text (for example Markdown code `&amp;`) stays literal.
Extraction is bounded to 10,000 nodes, 65,536 UTF-8 bytes per Markdown input and
65,536 bytes of final decoded body including separators. Document byte/token
policies apply to decoded text. Existing indexes refresh through normal reindex
or approved startup refresh; changed bodies change the source revision and update
the stored document without a schema migration.

The index is authoritative search state, and WydStore retains prior snapshots in
history. JSON's whole-document budget includes those snapshots and can fill after
repeated large updates. There is no history compaction in 0.3-C. SQLite has its
configured capacity policy. Operators must monitor capacity; hitting a limit
fails atomically rather than pruning revisions or silently truncating the index.
JSON inherits its single-file/local-cooperating-process scope and power-loss
limitations. SQLite inherits native rollback-journal transactions and durability.

## Host resource policies

Set `options.limits` on the trusted WydSearch library mapping. Unknown keys, zero,
nonintegers and above-ceiling values fail startup. Requests and package manifests
cannot override these policies. Canonical request/response policies remain the
0.3-B generic defaults (64 KiB each, depth 32, 4,096 nodes); hosts may explicitly
configure `serviceLimits` within the existing hard ceilings. Byte measures are
UTF-8 serialized JSON for document/index values and UTF-8 text for strings.

| WydSearch limit | Default | Host ceiling |
| --- | ---: | ---: |
| queryBytes | 512 | 2,048 |
| documentBytes | 16,384 | 65,536 |
| batchDocuments | 32 | 64 |
| documentTokens | 2,048 | 8,192 |
| queryTokens | 16 | 32 |
| pageSize | 20 | 50 |
| resultCount | 256 | 1,024 |
| snippetBytes | 320 | 1,024 |
| indexBytes | 1 MiB | 4 MiB |
| indexDocuments | 256 | 1,024 |
| queryWork | 524,288 | 8,388,608 |

Query work counts authorized document tokens multiplied by query term count before
ranking. No query scans more than the configured indexDocuments; index size is
checked before copying/processing where possible. Documents have independent
4,096-node/depth-eight validation; envelopes have 262,144 nodes/depth 16. Store
and service budgets may impose smaller limits. Limit failures never return a
partial search with a misleading total. Reading the index and checking source
state is linear in bounded index size; Page source resolution rereads the repository
and is suitable for small sites, not large catalogs. Concurrent calls multiply
memory and I/O: this is not a process-wide admission controller or heap quota.

Expected errors include SEARCH.INVALID_REQUEST, SEARCH.INVALID_DOCUMENT,
SEARCH.INVALID_CONFIG, SEARCH.DENIED, SEARCH.UNSUPPORTED_POLICY, SEARCH.LIMIT,
SEARCH.SOURCE, SEARCH.STORAGE, SEARCH.CONFLICT and SEARCH.FAILED. Dispatcher-level
capability/version/budget errors retain their established codes. Errors do not
contain source text, records, SQL, filesystem paths, or native exceptions.

## Search Bar and Search Results Wydgits

Package prototypes `divdev/search-bar` and `divdev/search-results` extend the
generic Block prototype and declare their properties and presentation templates
in `examples/search/prototypes.json`. Wydgine does not recognize search types
or render search-specific markup. The generic
[presentation mechanism](components.md) binds canonical read services under SEAM
and renders validated, escaped element trees.

Search Bar properties: `destination` (default `/search/`), `placeholder` (default
“Search this site”), `label` (default “Search”), plus inherited skin/presentation
properties. It renders an accessible labeled search input and submit button in a
GET form with configurable `queryParameter` (default `q`). `submitLabel` controls
the button text. Browsers encode Unicode and reserved characters normally;
keyboard submission works without JavaScript. It can be a Block in a Section,
nested Section, or Block child. Place its Section at `position: "header"` for a
Page header. Navigation contains link items only; the global App header has no
widget slot. This milestone does not add one or pretend that Page-header placement
is a global navigation/header installation.

Search Results properties: `index` (required), `pageSize` (default 10, bounded by
host policy), `queryParameter`, `showType`, `showSnippet`, `emptyMessage`,
`noResultsMessage`, and inherited skin. The request adapter validates singular `q` and
`offset` query parameters and invokes API 1.0.0 under the Page's existing context.
It renders safe linked titles, snippets/types, Previous/Next links preserving q,
and meaningful empty-query/no-results/unavailable states. Results are request DTOs,
not persisted properties that ordinary package code can inject as HTML. Without
the search capability and exact index scope the component shows unavailable.
It uses existing light/dark tokens and WydClient requires no enhancement; basic
GET navigation and rendering require no WydSUB/client scripting.
The generic component adapter defaults to four presentation binding attempts per
Page execution. Trusted host `runtime.componentRequests` accepts 0 through 16;
trusted context `limits.componentRequests` can only reduce the host policy. Additional
Results instances show unavailable instead of multiplying query work without bound.

## Adding search to a site

Install the local declarative package into an existing site:

```sh
node scripts/install-package.js examples/search --root /path/to/site --apply
```

The normal installer verifies compatibility, presents `search.documents.read` and
exact `site` index permissions, asks for an existing Results Page or a new Page,
query parameter, page size, explicit public source Pages, JSON/SQLite provisioning
or compatible existing infrastructure, optional independent Page-header Bars and
an optional navigation link. Review and approve the resulting plan. It retains
unrelated content and emits the ordinary installation receipt. No source copying
or application/server route code is required. The canonical libraries must be
installed and resolvable in the host; the installer approves their enablement.

See [the reusable package](../examples/search/README.md). Its two public
prototypes are `divdev/search-bar` and `divdev/search-results`. Trusted operator
approval JSON can configure initial `additions` independently, select a new empty
`page`, override template `properties`, and append `navigation`; these operations
use the same authorized object mutation and staged installer rollback path.
There is still one installation per package ID and one package principal per Page.

The installer stores its explicit public Page allowlist in trusted host
`wydsearch.options.pageSource`, separate from package grants. Startup refreshes
these sources in bounded batches; unpublished, stale and deleted content is
excluded at query time. Source Pages need not be manually marked searchable when
explicitly selected by the owner. Legacy `content/search.json` integration retains
its `searchable:true` requirement. Approved content changes need a bounded trusted
refresh or host restart. Installed sites retain the existing catalog drift checks;
editing base files behind the accepted installation snapshot fails closed.
There is no background watcher, upgrade or uninstall mechanism.

Run the disposable acceptance site from the repository:

```sh
node examples/testsearch/run.js
# SQLite uses exactly the same application logic:
WYDSEARCH_ADAPTER=sqlite node examples/testsearch/run.js
```

Open `http://127.0.0.1:3001/search/?q=Wydgit`. It includes Markdown Pages, a Page-header
Search Bar, ranked two-result pages, and an excluded draft. The fixture exports
`refreshSearch(libraries)` for bounded trusted content refresh. It creates a
temporary demo site rather than rewriting existing project content. The HTTP tests
exercise submission, pagination, safe rendering, stale suppression and refresh
against both adapters.

## Deferred work and 0.3-D requirements

No automated migration, package upgrade/uninstall, cross-adapter migration,
multiple Page principals, index compaction or asynchronous indexing is implemented.
Schema compatibility remains explicit; future migrations must preserve source
ownership and index versions. Role/membership policies need an explicit, fresh
trusted authorization interface before adoption. A larger index can eventually
use bounded portable inverted structures, but that is not necessary for this scope.

WydStream should provide canonical safe destinations, stable source IDs/revisions,
bounded plain-text metadata and a current authorization resolver if media metadata
is indexed. Search must never index binary payloads, signed/private media URLs,
credentials or session state. No WydStream or WydGate implementation was changed.
