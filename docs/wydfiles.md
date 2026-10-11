# WydFiles — 0.3-E, API 1.0.0

`@wydgit/files` is a host-approved canonical server library. It uses the existing
registry, installer scope resolver, authoritative ExecutionContext and trusted
binary transfer dispatcher. It adds no public file URLs or HTTP routes. Ordinary
packages request library dependency and `files.storage.read`, `.write`, `.delete`
and `.list` capabilities; availability, roles and identity confer no authority.

## Host configuration

Add an enabled `wydfiles` / `@wydgit/files` mapping to `wydgit.host/0.1` with
version `^0.1.0-alpha.1`, publisher `wydgit.core`, trust `canonical` and options:

```json
{
  "schema": "wydfiles.host/1.0",
  "apps": [{
    "app": "app-a",
    "mounts": [{
      "path": "/", "provider": "local", "root": "/private/app-a/files",
      "permissions": ["read", "write", "delete", "list"]
    }],
    "grants": [{
      "publisher": "acme", "package": "acme/demo", "principal": "acme/demo",
      "installation": "receipt-a", "path": "/documents",
      "actions": ["read", "write", "list"]
    }]
  }]
}
```

Roots must already exist, be absolute canonical directories without symlinks,
and be privately writable by the host. Public/content/prototype/module roots are
rejected. Configure resources after receipt identity is known; package activation
cannot create grants. Installer `permissions.scopes.wydfiles` contains logical
path strings; they become context `{path}` scopes. Access requires BOTH an accepted
scope and a host grant matching App, publisher, package, principal and installation,
as well as operation capability and resolved mount permission. Packages cannot
configure providers, roots, limits, credentials, or grants. Missing identities deny.
Each activation currently accepts exactly one App; state is activation-local,
ready for separate registries in future multi-App hosting, without adding routing.
Operators must never reuse storage namespaces across separate App activations.

S3 mounts replace `root` with `endpoint` (HTTPS origin), `bucket`, `namespace`
(unique App/mount ID), `region`, and `credentials` containing `accessKeyId`,
`secretAccessKey`, and optional `sessionToken`. Credentials are host-only.
Path-style addressing and TLS unsigned-payload SigV4 use the small `aws4` signer;
`fast-xml-parser` parses bounded ListObjectsV2 responses with entity processing off.
Redirects are denied. Amazon S3, R2, B2 and other compatible endpoints require
operator verification of region, path-style addressing, unsigned-payload policy,
and ListObjectsV2 support. No live cloud compatibility is claimed.

## Paths and mounts

Paths are absolute, canonical, case-sensitive logical identifiers, never URLs.
Maximum UTF-8 length is 120 bytes. Segments start with ASCII alphanumeric, `_` or
`-`, followed by these characters or dots. Trailing dots, empty segments, trailing
slashes except `/`, percent encoding, Unicode, controls, backslashes, colon,
traversal and repeated separators are rejected, rather than decoded or aliased.
This conservative initial syntax avoids unsafe Unicode representations.
Longest prefix wins only at segment boundaries: `/media/a` uses `/media`, while
`/media-archive/a` does not. Nested logical mounts are deliberate, unambiguous
shadowing. Duplicate logical mounts and overlapping physical roots/namespaces are
rejected. Authorization occurs against the resolved mount. Listings exclude
shadowed backing objects and unauthorized entries, including metadata/existence.

## Canonical operations

Use `SERVICES.Invoke("wydfiles", "1.0.0", operation, input)`. Closed inputs reject
extra identity/provider fields. Results use existing `{ok,value}` / sanitized
`{ok:false,code,message,details:{}}` contracts.

| Operation | Input | Result / authority |
| --- | --- | --- |
| stat | path | path, size, opaque version; read |
| exists | path | exists; read, including absent paths |
| list | path, optional offset/limit | recursive authorized prefix items, nextOffset; list |
| read | path | binary transfer required; read |
| read-range | path, start, length | binary transfer required; read |
| write | path, size | binary transfer required; write |
| delete | path | deleted; delete |
| copy | path, destination | destination path, size, atomic:false; source read + destination write |
| move | path, destination | as copy plus source delete |
| mkdir | path | FILES.UNSUPPORTED; write |

Directories are logical prefixes, not POSIX directories. No empty-directory
persistence, recursive deletion, cross-object transactions, atomic rename, or
snapshot pagination is promised. Offset pagination may change under writes.
Copy replaces destination. Move publishes destination before deleting source;
`FILES.PARTIAL_MOVE` means destination exists and source deletion failed. No cleanup
removes an overwritten destination. Cross-mount copy/move default to denied and
require host `limits.crossMount:true`. They stream and never claim atomicity.

## Binary boundary

JSON invocations for read/read-range/write return `FILES.TRANSFER_REQUIRED`.
Trusted Wydgine integration calls existing `registry.transfer(context, 'wydfiles',
operation, input, port)`. Write uses POST with a raw binary body and exact declared
size; reads use GET/HEAD and return a bounded private attachment stream. Explicit
ranges use zero-based start and positive length entirely within the file. No
multipart WydMedia protocol changes are made. The existing HTTP dispatcher verifies
Page/session authority and POST CSRF when a declarative binding uses this operation.
There is no automatic public delivery or raw transfer handle in ordinary code.
`port.authorize` is trusted host reauthorization; `close` must be called on output
completion/disconnect as the existing transfer sender does. Empty files are allowed.

## Providers and capabilities

Providers expose `capabilities`, `stat(key)`, `inventory(limit)`, `read(key,start,end)`,
`write(key,stream,exactSize)`, and `delete(key)` to trusted library code only.
Keys encode canonical virtual paths in hex, independently of physical location.
Inventory returns bounded key/size/version records; opened reads supply stream and
close. Providers must throw safe FILES errors and have private exclusive namespaces.

| Capability | Local | S3 |
| --- | --- | --- |
| rangeRead / streamRead / streamWrite | yes | yes |
| atomicReplace | same-filesystem rename | false (no stronger guarantee advertised) |
| serverSideCopy / directorySemantics / multipartUpload | false | false |
| maxObjectSize | 64 MiB | 64 MiB platform ceiling |

Unsupported streaming/range requests explicitly fail; S3 refusing a Range request
fails instead of returning the entire object. No silent destructive downgrade.
Local storage uses flat encoded filenames, O_NOFOLLOW/nonblocking regular-file
opens, single-link checks, private exclusive temporary files, fsync and rename.
Root ancestors are checked before access. This prevents package-controlled nested
symlink traversal; Node lacks portable descriptor-relative directory operations,
so a hostile local process able to rename root ancestors can still race checks.
Hosting must protect roots/ancestors against such processes. Temp files from
interrupted operations are removed; crash leftovers require offline operator
cleanup. Replacement is atomic on supporting filesystems; directory fsync/power-loss
durability is not guaranteed. External writers and multiple host processes are
unsupported for hard quota guarantees.

S3 uses HEAD/GET/range GET/PUT/DELETE/ListObjectsV2. Uploads have exact Content-Length
and stream under TLS. GET/HEAD retries only; uploads/deletes are not retried because
commit outcome can be uncertain. A failed or timed-out PUT may have committed;
inspect stat before retry. No multipart or atomic multi-object semantics.

## Resource limits and quota

Host `limits` sets the following policy; App and mount `quotaBytes` can only lower
its quota. Context numeric `filesFileBytes`, `filesQuotaBytes`, `filesChunkBytes`,
`filesPageSize`, `filesObjects`, `filesTransfers`, `filesDurationMs` and
`filesRetries` may further lower numeric limits. Packages cannot raise limits.

| Policy | Default | Ceiling |
| --- | --- | --- |
| fileBytes | 8 MiB | 64 MiB |
| quotaBytes | 64 MiB | 1 GiB |
| chunkBytes | 64 KiB | 1 MiB |
| pageSize | 20 | 100 |
| objects per mount / listing result | 256 | 4096 |
| transfers per App | 2 | 8 |
| durationMs | 60000 | 300000 |
| retries (read requests only) | 2 | 5 |

Transfers use backpressure and chunk splitting; declared size and elapsed duration
are enforced. S3 response XML is bounded to 1 MiB and inventory pagination to
objects+1 requests, with duplicate token/key rejection. Metadata JSON retains the
registry's default 64 KiB budgets; large listings can fail its response budget.
Copies and writes serialize per App. Before publication a fresh bounded inventory
checks replacement-adjusted exact byte totals and object ceilings, across every
mount, without cached counters. Failed inventory denies writes. Hard enforcement
requires exclusive single-host writers and a provider with consistent listing;
eventually consistent providers cannot supply hard quotas under this policy.
Local temporary storage is at most one file ceiling per App while writes serialize,
in addition to persisted quota. Crash leftovers are bounded only by operator
cleanup before restart. Provider capacity is represented by exact bounded inventory,
not a promise of underlying free disk/bucket capacity. Native in-progress calls
cannot always be force-cancelled; S3 request timeout and stalled stream timeout are
bounded, while a stalled native filesystem call remains an OS limitation.

## Errors and extensions

Stable codes: FILES.INVALID_REQUEST, INVALID_PATH, INVALID_CONFIG, DENIED,
NOT_FOUND, CONFLICT, RANGE, LIMIT, QUOTA, STORAGE, PROVIDER, TIMEOUT, INTERRUPTED,
UNSUPPORTED, TRANSFER_REQUIRED, CROSS_MOUNT_DENIED, PARTIAL_MOVE (all FILES-prefixed).
The dispatcher also returns SEAM.DENIED for capability/context failures. Internal
exceptions, paths, keys and credentials are sanitized. Existence checks authorize
before storage access. Provider versions are opaque metadata, not CAS guarantees.

Caching is deferred. A future host-wrapped provider may cache reads behind this
same interface, after authorization, keyed by App, mount, provider identity, key
and object version, in private bounded storage; it must invalidate on writes.
Drive/OneDrive/Dropbox adapters are deferred. They need logical-key to provider
file-ID mapping, revision-aware reads, rate-limit-aware retries, and host-controlled
OAuth authority; unsupported capabilities must stay explicit. They need not supply
POSIX paths, atomic rename, or strongly consistent inventory quotas.

WydMedia currently uses `packages/wydstream/src/local-provider.js` methods stage,
finalize, read, remove, objects and private opaque media IDs, with its WydStore
ledger driving repair/publication. The smallest later migration is a trusted
adapter mapping staged/ready IDs to private WydFiles logical paths, preserving
ledger state transitions, hash checks, delivery authorization and API. This requires
an explicit inter-library host binding and completion/repair semantics; WydFiles
is not substituted into the media provider in 0.3-E. No media code is changed.

Run `node examples/wydfiles/index.js` for a disposable standalone mount demo.
`test/wydfiles.test.js` shares local/simulated-S3 conformance checks and exercises
the real canonical loader, isolation, mounts, quotas, streaming and failures.
Simulated S3 verifies signed requests and common behavior, not live AWS/R2/B2.
