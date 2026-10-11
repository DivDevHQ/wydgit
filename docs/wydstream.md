# WydStream — 0.3-D

WydStream is the host-approved canonical library `wydstream` implemented by
`@wydgit/stream@0.1.0-alpha.1`. Its service API is **1.0.0**. The separately
installable ordinary package **divdev/media@0.1.0** supplies Upload, Player and
Gallery Wydgits. Loading the library provides infrastructure; installing the
package provides UI. Neither action grants capabilities without SEAM approval.

## Canonical contract

Use the existing caller-bound `invoke('wydstream','1.0.0',operation,input)`.
Every input includes `resource`, a host-approved App-local media resource.
Operation names follow the existing lowercase hyphenated canonical convention.

| Operation | Additional input | Result / capability |
| --- | --- | --- |
| `create-upload` | optional metadata, maxBytes, categories | opaque id/token, byte ceiling, expiry / stream.media.upload |
| `complete-upload` | id, token; optional metadata | finalized metadata / stream.media.upload |
| `get` | id | authorized ready metadata / stream.media.read |
| `list` | optional type, offset, limit | items and authorized total / stream.media.read |
| `update` | id, revision, metadata | new metadata revision / stream.media.write |
| `delete` | id, revision | deleted:true / stream.media.delete |
| `get-delivery` | id | authorized metadata describing delivery / stream.media.read |
| `reconcile` | resource only | changed count / stream.media.repair |

`get-delivery` provides an opaque media reference, never a path or bearer download
URL. The generic renderer combines this reference with the installed component's
approved delivery binding. Direct URLs are checked on every request.

Canonical operations carry JSON metadata only. `create-upload` reserves quota and
issues a 256-bit upload token; only its hash is stored. Tokens bind the operation,
App, resource, package, installation, principal, user and authenticated session,
expiry, category policy and reserved size. `complete-upload` cannot finalize a
pending ticket: trusted transport must first stream and verify its bytes. This
iteration's Media form performs create, stream and complete as one controlled
submission. Third-party components may instead declare a `complete-upload`
submission binding with id/token input to consume an existing canonical ticket.
The same authority/CSRF/expiry/size checks apply. Resuming partial files is deferred.

Requests fail with sanitized `STREAM.DENIED`, `NOT_FOUND`, `INVALID_REQUEST`,
`UNSUPPORTED_MEDIA`, `INVALID_MEDIA`, `LIMIT`, `QUOTA`, `CONFLICT`, `STATE` or
`STORAGE` codes. Canonical dispatcher errors retain existing SERVICE/SEAM codes.
Update/delete require an exact current item revision. Effective service response
limits are checked before canonical metadata writes.

## Metadata and binary boundaries

Each App's WydStream implementation owns one WydStore `media-ledger` record with
`schemaVersion:1` and bounded `items`. The collection fields are exported as
`metadataFields` for trusted provisioning. All ledger reads/writes use WydStore
API 1.0.0 through an approved dependency binding. Transactions and optimistic
revision checks serialize quota reservations and concurrent metadata changes on
both JSON and SQLite; App-local mutation queues and five bounded attempts handle unrelated ledger conflicts.

Items include an immutable random `m-<32 hexadecimal characters>` ID, authoritative
App/resource, publisher/package/principal/installation ownership, authenticated
creator ID, type, verified MIME, size, SHA-256, displayName/title/description/tags,
visibility, timestamps, lifecycle state and item revision. Private upload fields
include a token hash, session ID, expiry, allowed categories and reserved bytes;
these are omitted from public results. Binary payloads never enter WydStore,
canonical JSON, SQLite BLOBs or search indexes.

Local binary storage is an independently provisioned private directory. Only
opaque server IDs form `.part` and `.bin` filenames; submitted filenames are
ignored. Absolute host roots are validated segment by segment against symlinks,
protected application/static roots are disallowed, files open with NOFOLLOW,
exclusive creation prevents overwrite, and delivery rejects nonregular files and
hard links. Finalization uses an exclusive hard link followed by staging unlink
on the same filesystem. Upload writes handle partial writes, sync the completed
file, and never execute, extract or import uploaded content.

The trusted provider boundary has `stage(id)`, `finalize(id)`, `read(id)`,
`remove(id,staging)` and bounded `objects(limit)` operations. The local provider's
handles remain entirely within trusted implementation code. A future object
provider may implement equivalent bounded writes/read streams and conditional
publication without local paths. Trusted host adapters may supply a provider;
ordinary packages cannot supply JavaScript providers or privileged service objects.
Host roots must be private to the runtime's OS account. Concurrent independent
hosts writing the same binary root are not supported; hostile OS-level mutation
of runtime-owned directories is outside the package sandbox boundary.

## Upload lifecycle and recovery

`pending → uploading → staged → committing → ready` records reservation, streaming,
verified bytes, intent to publish, and completed publication. Safe failure before
commit removes the temporary object and reservation. A failure during publication
leaves committing intent for repair; it does not make metadata visible. Delete
first marks `deleting`, denies all reads, removes bytes, then removes ledger state.
If deletion fails, it remains denied and repair retries. Missing ready files become
`missing`; reads and listing exclude them. Failed metadata access leaves the last
committed state available for recovery, without guessing at a rollback.

A trusted caller with `stream.media.repair`, the resource scope, and principal
`host:media-repair` may invoke idempotent `reconcile`. It scans only this App's
bounded ledger and provider namespace, retires expired pending operations, retries
deletions, validates committing content size/hash before publication, marks missing
files, and removes orphaned opaque objects. Active in-process uploads are skipped.
Run it after interrupted operations and periodically for abandoned tickets. No
background scheduler, migrations, package lifecycle manager or cross-App sweep is
implemented. Persistent provider corruption fails closed for operator repair.
File/store transactions are intentionally separate; this is recoverable publication,
not a distributed transaction or a promise of power-loss atomicity.

## Upload validation and authority

Uploads require explicit `stream.media.upload`, an exact App resource scope, and
an active WydGate identity. The optional host `uploadPermission` additionally
requires the current user's application permission; that permission grants no SEAM
capability. Gate session authority is checked before streaming and before final
publication. Revoked, expired and cross-App sessions are rejected. Authenticated
ownership includes package/installation, principal and creator, preventing another
package or user from changing private metadata.

Busboy handles bounded streaming multipart parsing in trusted generic transport.
One file and optional title/description fields are accepted. Size, total envelope,
field count, field size, parser headers and elapsed upload time are bounded.
Client Content-Type, filename and extension do not determine MIME. `file-type`
detects the first bounded 8 KiB; only the following allowlist is accepted: PNG,
JPEG, GIF, WebP; MPEG audio, WAV, Ogg/Opus, FLAC; MP4, WebM; PDF and ZIP downloads.
Host categories further reduce this list. Unknown formats, HTML, SVG, executables
and scripts are rejected. Identification is signature detection, not full codec
validation, malware scanning or sanitization. PDF/ZIP always use attachment
semantics, nosniff and the host CSP; ZIP containers are classified from their bounded signature and never passed to
the detector's archive inflation logic. Archives are never extracted.

Cookie-authenticated forms use a kernel-generated HMAC derived from the existing
session CSRF secret and bound to App, Page, component, library, API and operation.
It is verified before reading bytes; a component receives only its own token,
never the session secret. POST form actions must use their approved endpoint. The host sends Referrer-Policy:no-referrer.
The no-JavaScript form works, with accessible success feedback and a return link.
Programmatic submissions receive bounded JSON. Upload progress and richer client
interaction remain deferred to 0.3-F; login/admin UI remains deferred to 0.3-E.
No new authentication system is introduced.

## Delivery

The generic endpoint is
`/_transfer/<library>/<operation>/<page-id>/<component-id>?media=<opaque-id>`.
It resolves the Page, its installed package authority, the visible component and
its declared binding before invoking the library transport. It cannot call
arbitrary services or package-defined routes. Direct URL, HEAD, range and ETag
requests all resolve current Gate session authority and current metadata policy
before opening bytes; policy is checked again after opening.

GET streams with backpressure and disconnect cleanup. HEAD returns identical
metadata without a body. Content-Length, detected Content-Type, Accept-Ranges,
strong content-hash ETag and opaque safe Content-Disposition are supplied. Single
closed, open-ended and suffix byte ranges return 206 and Content-Range. Invalid,
unsatisfiable and multiple ranges return 416 with `bytes */<size>`. If-Range uses
an exact strong ETag; unmatched validators result in a complete response. Exact
If-None-Match may return 304 after authorization. Date validators and multipart
ranges are not implemented. Full audio/video files are never buffered.

`private` is the default and requires the owning package/installation/principal
and creator. `authenticated` requires any currently authenticated user with the
App's read capability and resource scope. `public` permits anonymous reads through
an approved component/read scope. Public responses use `public, max-age=0,
must-revalidate` (responses issuing a new Session cookie instead use no-store); protected responses use `private, no-store`. Public cached bytes
already distributed cannot be revoked retrospectively. Private failure responses
provide no size, ETag, range metadata or storage paths.

## Resource policies

All values are trusted host options, not package grants. App/package/context
limits can reduce host allowances, never increase them. Configuration exceeding a
ceiling fails startup. Quota reservations include a pending upload's complete
allowed byte ceiling, preventing simultaneous uploads from overcommitting storage.
Metadata history is bounded separately by existing WydStore resource policies.

| WydStream option | Default | Ceiling |
| --- | ---: | ---: |
| fileBytes | 8 MiB | 64 MiB |
| quotaBytes | 64 MiB | 1 GiB |
| stagingBytes | 16 MiB | 128 MiB |
| uploads | 2 | 8 |
| deliveries | 8 | 32 |
| durationMs | 60,000 | 300,000 |
| retentionMs | 900,000 | 3,600,000 |
| pageSize | 20 | 40 |
| items | 128 | 256 |
| metadataBytes | 2,048 | 4,096 |

Context reductions use mediaFileBytes, mediaQuotaBytes, mediaStagingBytes,
mediaUploads, mediaDeliveries, mediaDurationMs, mediaPageSize and mediaItems.
`runtime.http` controls generic transport: headerBytes defaults to 8,192 (ceiling
16,384), headerCount to 64 (128), requestMs to 120,000 (300,000). Header timeout is
at most 15 seconds. Multipart envelope allowance is 8 KiB beyond fileBytes; text
fields are at most 1 KiB each. Delivery streams use Node's bounded stream buffers.
Very large allowed listing metadata may hit the canonical JSON response budget;
use a smaller page size. Binaries do not use the 64 KiB canonical JSON budget.

## Host configuration and installation

The normal operator installer supports the Media package:

```sh
node scripts/install-package.js examples/media --root /absolute/app/root --apply
```

It asks for exact permissions, an existing Page, metadata provider and category
policy, then proposes separate `.wydgit-data/media-metadata` and
`.wydgit-data/media-binary` directories. Operator-approved provisioning enables
WydStore/WydStream, creates the library-owned metadata collection, supplies the
scoped WydStore dependency binding and publishes ordinary installation receipts
last. Failure restores host configuration/catalog and removes only newly created
roots. Reuse of an already approved App media resource needs no new provisioning.
No automatic npm installation, upgrade or uninstall is performed.

A manually provisioned host supplies `options.apps:[{app,resource,store,collection,
root,categories,uploadPermission?}]`, optional `options.limits`, and one WydStore
binding `{library:'wydstore',app,capabilities:['store.records.read',
'store.records.create','store.records.write'],scopes:{wydstore:[{store,collection}]}}`.
The metadata store is owned by `wydgit.core` / `library:wydstream`, not divdev/media.
Only the UI's stream read/upload grants cross into the installed package.

The existing HTTP session integration requires the trusted host's
`createHostApp({root, execution:{gateContext}})` option. `gateContext` is a
host-issued ExecutionContext for the same App with only `gate.sessions.use` and
`scopes:{wydgate:[app]}`. It stays inside the session resolver; it does not grant
Gate or Store capabilities to media packages. Enabling/installing Media alone does
not create accounts, sign in users, or configure this host authority. Deployments
use their existing Gate bootstrap/login integration. The bare demo server has no
login integration; a login/admin interface is reserved for 0.3-E.

The installer currently permits one package principal per Page. Choose an existing
Page without another installed package principal; this inherited limitation is not
expanded into a runtime authority redesign in 0.3-D.

## Search and forward compatibility

The trusted `mediaSearchSource` adapter reads metadata through a supplied
caller-bound canonical dispatcher and implements WydSearch's existing source
contract. Both search and media grants remain required. It exposes only public or
authenticated metadata with current policy checks; private media is excluded.
Indexable fields are title, description, tags and type. The caller's existing
source ownership/resource grants still govern indexing. Supply the adapter through
WydSearch's approved source initialization hook; no WydSearch private storage or
contract modification is needed. Automatic indexing, OCR/transcription and binary
analysis are absent. Source refresh is explicit and bounded; list returns only its
first authorized page, while indexing uses explicit IDs.

Configuration/state are keyed by authoritative App identity, independently of the
process. Every media lookup checks App/resource. The current dependency-binding
contract supports one App per library activation; each future App may receive its
own activation and private `apps/<app-id>/media/` root without changing public
operations. No single process-global binary directory, mutable provider singleton,
hostname routing or 0.3-G hosting implementation is introduced.

Automated tests cover JSON/SQLite, ordinary installation/rollback, real TCP uploads,
playback references, ranges/HEAD/conditions, persistence/revocation, negative
security cases and failure repair. No manual browser or decoder acceptance is
claimed. Transcoding, external thumbnail processors, adaptive streaming, CDNs,
scanning infrastructure and all other excluded later milestones remain deferred.

Media search destinations use the shared bounded same-site destination contract.
Configure a Media Player Page path or an approved delivery binding; both existing
media presentations consume the `media` query field and translate it to the
canonical `id` input. Existing validated query fields are preserved, an existing
`media` field is replaced, and the raw media ID is encoded once. Invalid configured
destinations fail rather than falling back. JSON/SQLite integration fixtures upload,
index, render and follow Player/delivery links; these are automated HTTP checks,
not manual browser verification.
