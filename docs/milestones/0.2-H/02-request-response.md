# 0.2-H safe request and response contract

WydBASIC controls the meaning of the response. Wydgine controls the transport. These objects are capability-checked facades, not wrappers that expose native Node/Express objects.

## REQUEST

Read-only per-request baseline: Method, Path, Route, Query, Form, Cookies, IsPost. IsPost is true exactly for normalized POST; it is not authentication, a postback marker, or proof of trusted input. Route contains matched route parameters, not router internals.

Query/Form use bounded safe maps with explicit missing-value and repeated-value behavior. Reuse existing map syntax and document Get/GetAll or their equivalent; do not silently collapse ambiguous repeated inputs. Treat values as untrusted. Parse/validate before binding to approved semantic fields; reject malformed encoding, oversized inputs, forbidden fields, and ambiguous action identifiers. No raw body stream, socket, arbitrary header bag, upload stream, or host object. REQUEST.Cookies.Get(name) uses parsed cookies and name-scoped authority; it cannot expose the raw Cookie header as a bypass.

Wydgine validates action origin, active Session, route/Page ownership, permitted source instance, payload schema, and existing anti-forgery policy before Action. Cookie presence and a client-supplied source ID do not establish authority. Browser cookie-authenticated state-changing requests require the host's anti-forgery protection; use the existing facility or implement the minimal protection needed for the new transport, not a new authentication framework.

## RESPONSE

Baseline: Status, Headers.Set/Remove, Cookies.Set/Delete, WriteMarkdown(text), SendFile(fileHandle, options). The host owns transport, streaming, encodings, and final completion.

```text
Open → Committed → Complete
```

Status, permitted headers, and cookies are mutable only while Open. Validate the status against the host's supported response codes; ordinary code cannot choose protocol-switching behavior.

Normal Page rendering is the initial output mode. WriteMarkdown or SendFile validates all inputs and permissions while Open, then commits a terminal explicit response. An authorized call skips remaining normal Page phases and rendering, but always runs Unload. Calls are awaited and complete or fail in a structured way; return from the handler after a terminal call. Any later status/header/cookie/body mutation fails cleanly. A denied or invalid call MUST NOT partially commit metadata or body. Only one body producer may win; no Markdown/file/tree mixing and no duplicate response.

On post-commit stream failure, terminate the transport safely and clean up. Do not replace already-sent bytes with another body. No response writes in Unload.

### Markdown

```basic
PAGE EVENT Load
    IF REQUEST.Query.Get("summary") = "1" THEN
        RESPONSE.WriteMarkdown("# Summary")
        RETURN
    END IF
END EVENT
```

Use Wydgine's approved Markdown renderer followed by sanitization of the rendered result. Disable/escape raw HTML and active embedded content, enforce safe link/media protocols, and respect host policy for remote resources. Markdown input MUST NOT yield script execution, event-handler attributes, unsafe URLs, or unsanitized HTML. The rendered response is HTML with a trusted media type. No raw HTML or raw stream escape hatch.

### Binary/file output

```basic
DIM report = FILESYS.Get("reports/latest.pdf")
RESPONSE.SendFile(report)
```

Use the repository's existing WydFiles/FileSys handle API; the spelling above is illustrative. Require both authorized file read and authorized response-file output. Recheck handle scope and ownership at the streaming boundary. Reject host paths, traversal, forged/stale handles, and arbitrary native streams. The binary stays in the trusted file/transport layer; do not marshal it through WydBASIC byte arrays.

Derive or validate media type from trusted metadata and supported type policy; never trust a filename alone for active content. Unknown types default to a safe binary attachment or are rejected by policy. Set trusted content type and nosniff behavior. Active HTML/SVG or similar content must follow explicit host policy and cannot become a same-origin execution bypass. Media-type overrides are optional and require a separate scoped grant; omit overrides if the repository has no such mechanism.

Optional Disposition is limited to inline/attachment; Filename is a validated display name, not a path. Encode it safely and reject controls/CR/LF. Bound file size/stream resources and release file handles on disconnect or error. Do not expose arbitrary Content-Disposition text.

### Headers

```basic
RESPONSE.Headers.Set("Cache-Control", "no-store")
```

Normalize names case-insensitively and validate names/values against HTTP serialization rules, including rejection of CR/LF and forbidden controls. Authorize Set and Remove by header scope. Reject platform-owned Connection, Content-Length, Transfer-Encoding, Set-Cookie and other framing/hop-by-hop headers. Content-Type is owned by the chosen body producer. Cookies go through the cookie API.

Applications may add response policy within granted scope; they cannot weaken host-enforced policy. Locked security headers cannot be replaced or removed. Use host policy merging where already supported, otherwise deny the conflicting operation. General header access cannot bypass file typing, cookie ownership, redirects, or security policy.

### Server cookies

```basic
RESPONSE.Cookies.Set("theme", "dark", {
    "MaxAge": 2592000,
    "Secure": TRUE,
    "SameSite": "Lax"
})
RESPONSE.Cookies.Delete("theme")
```

Authorize cookie names plus allowed path/domain/options. Validate and encode names and values, bound sizes/counts, reject control characters and injection, and enforce valid SameSite/Secure combinations and reserved cookie-prefix rules. MaxAge is in seconds. Reuse host secure defaults and do not broaden Domain/Path beyond granted ownership. Deletion uses the same authorized Path/Domain as creation; it cannot erase another owner's cookie by choosing a broader scope.

Platform authentication/session cookies, including WydGate cookies when present, are reserved. Neither ordinary WydBASIC nor WydClient may read or overwrite their credentials. They use host-controlled HttpOnly, Secure, and SameSite policy. The internal session resolver may use them without publishing their raw values through REQUEST.Cookies.

## CLIENT.Cookies

Required client baseline: Cookies.Get(name). Set/Delete are included only if a safe existing client-write capability is available; otherwise reject writes explicitly and document the read-only baseline. Do not add unrestricted browser cookie writes to satisfy an example.

Client access uses name-scoped SEAM authority and browser visibility. HttpOnly cookies remain invisible; the server must never mirror them into hydration data or a client-readable proxy. Platform-owned credentials remain excluded even if accidentally configured without HttpOnly. Browser restrictions are an upper bound, not an extra grant.

WydClient may use browser cookie functions internally. Ordinary code never receives document.cookie, a cookie jar, document, or window. Client cookies are untrusted preferences/input, never proof of identity or authorization. Future approved writes must enforce the same name/path/domain/default policies applicable on the client and cannot set HttpOnly.

Conceptual capabilities include request.cookies.read, response.markdown.write, response.files.send, response.headers.write, response.cookies.write, client.cookies.read, and optional client.cookies.write, plus existing file-read authority. These names are proposals to map onto the repository's SEAM vocabulary, not permission to create parallel authorization machinery. Missing grants deny access. Checks apply at every public facade operation.

Redirect and Json are future response methods. Do not emulate them by allowing arbitrary Location headers or raw JSON/HTML bodies in this milestone. General request headers, uploaded files, locale/content-type helpers, caches, and direct binary generation are also deferred.
