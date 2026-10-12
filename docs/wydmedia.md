# WydMedia integration — 0.3-F

WydMedia remains the media subsystem of canonical `wydstream` / `@wydgit/stream`
API **1.0.0**. Names, capabilities and existing clients are preserved. WydStore
owns structured metadata; WydFiles owns all new physical media storage. There is
no media provider, media route or Gallery renderer built into Wydgine.

## Contract compatibility and storage selection

The previous media provider exposes stage/finalize/read/remove/objects and writes
unknown-size multipart bodies. WydFiles deliberately exposes exact-size binary
transfers and has no atomic multi-object publication contract. These contracts
are incompatible without coordination. The trusted bridge uses an exact-size
WydFiles write and publishes only by changing the media ledger to `ready`.
It never copies WydFiles provider code or passes roots or credentials to packages.

New installer provisioning configures `storagePath:"/media"`, a private local
WydFiles mount and a host binding. Existing `root` configurations keep their
legacy `.part`/`.bin` provider without reinterpretation or deletion. Exactly one
of `root` and `storagePath` is required. A host may explicitly provision legacy
storage with operator infrastructure `legacyStorage:true`; this is compatibility
support, not the default. WydFiles is an optional **host-bound** library dependency
so old hosts need not enable it. A storagePath configuration requires that binding;
absence fails activation.

## Host authority and mounts

The installer grants only this service identity WydFiles read/write/delete/list:

```json
{"publisher":"wydgit.core","package":"library:wydstream",
 "principal":"library:wydstream","installation":"library:wydstream",
 "path":"/media/assets","actions":["read","write","delete","list"]}
```

Its dependency binding includes `library:"wydfiles"`, the owning App,
`installation:"library:wydstream"`, capabilities `files.storage.*` for those four
operations and scope `{"wydfiles":[{"path":"/media/assets"}]}`. Identity cannot be
selected by upload callers. Package identities retain their own installation,
principal and SEAM capabilities; media checks ownership before invoking storage.
Public delivery permits one asset through an installed, approved delivery binding;
it grants no WydFiles access and does not make logical paths public URLs.

Each registry activates one App. Independent App installations require independent
registries and exclusive local roots or S3 namespaces. Host operators must not
reuse these namespaces. Multi-App hostname routing remains deferred.

## Versioned metadata and lifecycle

The WydStore `media-ledger` record retains schemaVersion **1** and optimistic
record versions, consistently on JSON and SQLite. Each bounded item contains:
opaque `m-<32 hex>` identity; App, publisher, package, principal, installation and
creator; type, detected MIME, sanitized Unicode display filename; size, SHA-256;
title/description/tags; visibility; revision; creation/update timestamps; lifecycle
state. New records additionally persist `storageBackend:"wydfiles"` and
`logicalPath:"/media/assets/<id>"`. These additive internal fields and ticket/session
secrets are excluded from public metadata. Neither paths nor identity derive from
submitted filenames. Paths stay stable when the mount's physical provider changes.

The existing API operations are:

| Operation | Input beyond resource | Behavior |
| --- | --- | --- |
| create-upload | optional metadata/maxBytes/categories | reserve bounded pending identity and session-bound ticket |
| complete-upload | id/token, optional metadata | finalize staged metadata or transfer bytes for that ticket |
| get / get-delivery | id | authorized ready metadata / approved transfer |
| list | optional type/offset/limit | authorized ready items, newest first then ID, total |
| update | id/revision/metadata | owner-only descriptive update with conflict checks |
| delete | id/revision | owner-only retire content and metadata |
| reconcile | resource | host:media-repair principal and stream.media.repair capability |

Lifecycle: `pending → uploading → staged → committing → ready`; deletion first
sets `deleting`. Pending, failed, deleting, committing and missing assets never
appear in listings or delivery. Private ownership requires exact App/package/
principal/installation/current user; authenticated visibility requires a current
App session. Public visibility still requires an approved media read context.
New-backend absent and inaccessible metadata both return STREAM.DENIED.

No cross-provider atomic transaction is claimed. Successful bytes followed by a
metadata outage remain associated with durable pending intent. Expired pending/
uploading/staged items are deleted by bounded host reconciliation. Committing items
are re-read, size/hash verified and safely finalized. Deletion failures remain
hidden and are retried by reconciliation. Unknown opaque objects are removed only
within the private approved media prefix, bounded by the item ceiling. Cleanup
failures surface to the operator; repeat reconciliation after restoring storage.
The returned changed count is auditable; record host invocation/results in the
operator's existing logs. No scheduler or background-job framework is added.
Operators should reconcile before resuming traffic after a crash. Upload retries
use a fresh ticket after cleanup; committing intent must be reconciled first.

## Upload and HTTP delivery

An approved multipart POST contains one `file`, optional title/description and an
exact byte count in `X-Wydgit-File-Size`. Generic WydClient upload adaptation sends
the browser File.size and reports progress/success/failure. Non-JavaScript clients
may supply the `size` multipart field **before** the file instead. Declared size is
untrusted: WydFiles rejects both short and excess input, and independently enforces
mount permissions, quotas and effective context limits. MIME classification uses
a bounded content sample, not Content-Type or filename. Supported signatures are
PNG/JPEG/GIF/WebP, MP3/WAV/Ogg/FLAC, MP4/WebM, PDF and opaque ZIP attachments, further
restricted by host category policy. Detection is classification, not full media
validation, malware scanning, codec validation or transcoding.

Use existing bound `/_transfer/wydstream/...` URLs produced by the runtime, never
construct WydFiles URLs. Upload requires a current session, upload capability,
App/resource scope, optional host upload permission and binding-scoped CSRF.
Bytes are streamed with backpressure and bounded sampling; metadata commits only
after storage succeeds, byte count is exact and classification is approved.

Delivery authorizes before opening storage and rechecks current metadata before
returning content. GET and HEAD support single explicit/open-ended/suffix ranges,
206, Content-Range/Length, Accept-Ranges, ETag conditionals and 416 with `bytes */size`.
Protected media defaults to private/no-store; public media uses revalidation.
MIME and disposition come from trusted metadata; host nosniff/CSP remain locked.
WydFiles validates upstream Range headers, total size and actual streamed count,
not merely status. Errors after response output destroy the HTTP response; no
successful completion is emitted. Cancellation closes upstream streams and releases
both file and media capacity. HEAD and invalid ranges do not open a body stream.

## Installation and portable presentation

Install `examples/media` using the existing operator installer. It attaches the
Upload, Player and Gallery Wydgits to a chosen Page; provisioning and grants precede
activation, and installer rollback removes new private roots and restores state.
The operator approval includes WydStream/WydStore/WydFiles provisioning. The package
has only media upload/read authority, no raw file/store/repair grants.

Portable package JSON uses existing generic file selection, image, native audio/
video controls, download links, lists and forms. No executable JS, HTML source or
CSS is packaged. Generic Node transport and browser multipart/progress adaptation
are trusted runtime implementations; future clients can implement the same media
API and semantic controls without Node objects or cloud credentials. Seek requests
use the same authorized range delivery. No thumbnails or codec conversions occur.

## Limits and providers

Existing media defaults/ceilings remain explicit in `docs/wydstream.md`: 8/64 MiB
per file, 64 MiB/1 GiB total bytes, 2/8 uploads, 8/32 deliveries, 60/300 seconds per
transfer, 20/40 listing page size, 128/256 items and 15/60 minute ticket retention.
WydFiles defaults can further constrain these (notably 2 simultaneous transfers).
Host options can raise defaults only within ceilings; context limits can only lower
limits. Media duration is also propagated as a lower WydFiles duration. Upload
reservations and physical inventory quotas are enforced independently. Larger
videos than 64 MiB are currently unsupported; multipart cloud uploads are deferred.

Local storage is the default. For S3 replace the `/media` mount's local root with
an approved HTTPS endpoint, bucket, exclusive namespace, region and host-only
credentials as documented in `docs/wydfiles.md`. Do not commit credentials.
A mount change **does not migrate bytes**. Stop writes and deliveries, back up
metadata and objects, copy every ready logical object through trusted authorized
WydFiles operations to the new mount, verify exact sizes and SHA-256 hashes against
the ledger, and retain the old provider for rollback before switching configuration.
For legacy root migration, map each verified `<id>.bin` to `/media/assets/<id>`,
resolve all partial intents first, and add the new internal backend/path fields
under WydStore revision checks while offline. There is no automatic package/data
migration framework. Never enable the new backend against unmigrated legacy data.

Run `node examples/media/demo.js` from the repository root for a disposable App
installation, image/audio upload, Gallery/Player render, range seek and private
access denial over real local HTTP. The demo reuses controlled fixture provisioning,
requires local listen permission, and cleans its temporary App. Run
`node --test test/wydmedia-files.test.js test/wydstream-http.test.js test/wydfiles.test.js`
for local and signed simulated-S3 integration. Simulated S3 is a test double, not
verified AWS S3/R2/B2 interoperability; each requires separate live testing.

Live ingest, broadcasting, HLS, transcoding, thumbnails, CDN, additional cloud
providers and background jobs remain outside 0.3-F. Future live ingest may coordinate
media lifecycle over WydFiles capabilities, but must define separate bounded ingest
and delivery contracts rather than treating this finalized-asset API as live media.
