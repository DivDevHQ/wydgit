# HTTP transport — 0.2-I

Hono is Wydgine’s default HTTP host adapter, not part of the Wydgit application
programming model. No Hono Context, Request implementation detail, middleware
object, or runtime-specific primitive is exposed to ordinary Wydgit code.

The implemented host is Node.js:

```text
Wydgine Page/Session pipeline
  → internal request data / output port
  → wydgine/http/transport/hono.js
  → Hono + @hono/node-server
  → Node HTTP
```

`app.js` composes the renderer, pipeline and adapter. `createHostApp` validates
libraries and portable requirements before a listener can open. `server.js` owns
host configuration and process signals. Only the transport adapter imports Hono.
It uses the node-server direct-response bridge so the existing bounded file
streaming, backpressure, disconnect handling and RESPONSE completion/cleanup
remain intact. It does not buffer file responses into a Hono body.

## Internal boundary

The adapter passes only `method`, `path`, raw query text, collected form text and
cookie text to the kernel pipeline. The pipeline owns safe map/cookie parsing,
Session resolution, action extraction, CSRF, SEAM and Page execution. Neither the
Hono context nor its request crosses this boundary. The kernel-only output port
provides status, header, completion, chunk, disconnect and backpressure operations;
it wraps the native response without exposing the native object. REQUEST,
RESPONSE and EVENT remain the existing scoped facades.

RESPONSE still owns `Open → Committed → Complete`, authorized metadata, Markdown
sanitization, approved file handles and terminal body selection. Host CSP and
nosniff policy remain locked. Application cookies cannot overwrite reserved
session/authentication cookies; multiple Set-Cookie values survive the bridge.
The adapter suppresses bodies for every HEAD response, including errors/assets.

## Bodies and assets

URL-encoded bodies are collected incrementally with a 32,768-byte decoded-body
limit, including chunked requests and gzip/deflate/Brotli inflation. Unsupported
encodings/charsets and invalid character sequences fail closed. Safe form maps
retain their existing 32 KB, field-count, repeated-value and malformed-percent
encoding checks. Parser/collection failures retain the previous host's sanitized
500 response; malformed semantic input remains 400 and forged CSRF remains 403.
Strict character decoding additionally rejects invalid encoded byte sequences.
No upload or unrestricted body API is added.

`/css/skins.css` remains generated CSS with `Cache-Control: no-cache`.
`/css/*` serves only regular nonhidden files under the approved `public/css` root;
symlink escapes and encoded traversal are denied. Existing CSS typing, no-cache
freshness (`public, max-age=0`), Last-Modified, weak ETags, conditional requests and
single byte ranges are retained. Runtime modules retain their existing URLs,
JavaScript content type and the six-module explicit allowlist rooted in the
platform repository. Other source files are unavailable. Directory indexes and
symlink aliases are deliberately not served.

## Listening and replacement

The trusted host wrapper retains `listen(...)` and `locals.lifecycle` /
`locals.libraries` for host composition and existing TCP tests. It is no longer
an Express application; Express middleware/router APIs are removed. Hono itself
is not exposed through this wrapper. Global Request/Response constructors are
not replaced by node-server.

`shutdown(server)` awaits listener closure (including in-flight requests) and the
single async Server Stop operation. Direct listener closure also starts Stop;
startup listener errors stop the activation. SIGINT/SIGTERM share one shutdown
operation. Server Start, Session transitions, Page cleanup and request-local
isolation retain their 0.2-H contracts.

A replacement adapter must accept the same plain input and implement the same
kernel output operations, host policy, asset roots, body bounds and lifecycle
bridge, then pass the existing acceptance and real TCP transport tests. Hono is
replaceable and is not an architectural permanence requirement. No alternate
adapter, Bun/Deno/Cloudflare host, WebSocket or HTTP/2 support is implemented here.
Workspace package contracts/versions and their minimum platform compatibility
ranges remain unchanged; the host platform is `0.2.0-alpha.14`.

Verification includes the full `npm test` suite and `npm run check`. Focused real
TCP tests exercise asset/cache policy, malformed/oversized/chunked/compressed
forms, safe cookies, Change payloads, explicit Markdown/files, HEAD, concurrent
Page isolation, startup errors, in-flight shutdown and both process signals.
Manual browser verification remains unavailable when no browser surface is
connected; HTTP integration tests do not claim visual browser verification.
