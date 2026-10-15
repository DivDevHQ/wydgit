# I1 verification

Baseline: **df273129b2cfeb2f017c28afd396b28ddb633342**, `develop/0.3`.
Fetch confirmed matching local/remote commits and a clean initial tree. Independently
reproduced baseline: **794/794**, ordinary default-isolation `npm test`, no skips or
cancellations, 22.0 seconds. The completing commit contains this report; resolve
its SHA with `git log -1 --format=%H -- docs/milestones/0.3-I1/verification.md`.
This is internal engineering verification, not an independent security audit.

## Implementation and versions

Platform/Wydgine **0.3.0-alpha.9 → 0.3.0-alpha.10**. Root manifest/lockfile, sample
revision, runtime/version assertions and current README are synchronized. WydClient
**0.1.0-alpha.8**, WydSUB **0.1**, canonical objects and SEWN schemas are unchanged.
No browser implementation or immutable artifact changes.

- `wydgine/http/routing.js`: closed bounded frozen registry, one authority parser,
  exact routes/parking zones, raw Host/target validation, actual proxy peer policy,
  immutable effective origins and same-origin submission checks.
- `wydgine/multi-app.js`: integrate routing into I0 staging, service-free parking
  profile, one shared native listener invoking existing App handlers, strictest
  HTTP limits, per-App response tracking and bounded disposal. No second controller.
- `app.js`, `http/transport/hono.js`, `http/pipeline.js`, `execution/lifecycle.js`,
  `http/credential-cookies.js`: existing App pipeline adaptation, host cookie policy,
  anonymous ephemeral parking views, explicit canonical variant selection, scoped
  asset ETags and lifecycle cleanup. No native objects enter portable execution.
- `test/hostname-{routing,host}.test.js`: parser/registry and production-path HTTP,
  installed WBasic, Gate, storage, concurrency, CSRF, proxy and failure acceptance.
- `examples/hostname-host/`: normal App roots, canonical parking pages, existing
  Taskboard family compiler/public installer, compiled form action and runnable CLI.
- `scripts/verify-hostname-browser.js`: real Chrome, disposable local TLS reverse
  proxy, native mouse/keyboard forms, cookies, parking and local HTTP profile.
- Current README, HTTP/SEAM/Gate guidance, changelog and I1 contract/report updated;
  historical I0/H reports retained.

## Acceptance and adversarial evidence

| Boundary | Observed result |
| --- | --- |
| Authority parsing | DNS case/final dot/IDNA, explicit decimal ports, canonical IPv4 and bracketed IPv6; malformed labels, credentials, controls, percent encoding, shortened/octal/hex IPs and invalid ports reject |
| Registry | Duplicate canonical aliases, wildcard/invalid mappings, unknown Apps/fields/schema/profile, unsafe short zones and mixed tenant/parking owners reject before activation |
| Raw HTTP entry | Actual duplicate Host and conflicting absolute-form target reject 400 before App adaptation; unrelated hosts 421, malformed/forwarded claims 400, unavailable targets 503 |
| Shared tenant execution | Same installed WBasic Taskboard package with independent receipts/principals executes compiled selection and typed events on alpha/beta hostnames through one native listener, returning distinct task lists |
| Actions/CSRF | Canonical form action executes compiled SEWN; exact Origin plus session CSRF required; foreign/null/missing origins, sibling-origin submission and another session's CSRF deny |
| Gate/storage | Same username independently registered/login in both real Gate directories; own credential succeeds, foreign App credential denies; same logical record ID has distinct stored values under exact App contexts |
| Cookies | Native browser confirms host-only domain, HttpOnly and Secure on validated HTTPS, separate values per hostname; explicit local HTTP uses unprefixed reserved names without Secure; issuance/deletion share policy serializer |
| Proxy | Actual loopback peer admitted only under exact configured IP; different loopback source peer denies; duplicate/conflicting Forwarded/X-Forwarded claims and missing HTTPS metadata reject |
| Parking | Known Coming Soon/Parked and approved unknown zone render ordinary canonical Pages with no cookies, including hostile supplied tenant credentials; no service/host execution integration allowed; POST rejects |
| Assets/cache | Identical paths select own App CSS; opaque ETag root discriminators prevent foreign-validator aliasing; traversal denies; existing range/HEAD/stream/media regressions retained |
| Routing authority | Query-like App/hostname metadata cannot replace the route; malicious suffixes cannot match approved zones; routing registry is absent from portable contexts |
| Lifecycle | Accepted paused requests drain; new stopped-App requests 503; sibling and parking stay live; forced drain disconnects only retired App response and late mutation rejects |
| Failure/concurrency | Concurrent sibling requests progress; partial startup failure has no tenant/parking fallback; unavailable parking returns 503; excess raw headers reject 431 under strictest App policy |

I0 tests additionally retain foreign object/event/context/service token denial,
configuration drift, mutable-provider aliasing, Search/Stream/Files ownership,
installation/recovery and nested-budget isolation. Those are executed as regressions,
not replaced by mocks of the routing rejection function. No DNS or live external
service is required by the I1 fixtures.

## Actual browser evidence

Linux, Node **24.21.0**, Google Chrome **155.0.8059.79**, complete Git history and
installed native/workspace dependencies. Browser checks use the actual versioned
alpha.8 distribution where applicable.

- Existing browser smoke: **16/16**.
- Existing native controls/signed package/embedded roots/public CLI: **4/4**.
- New routing browser fixtures: **5/5**: HTTPS alpha, HTTPS beta, HTTPS known/zone
  parking, unrelated hostname rejection, explicit local HTTP hostname cookies.
- **25/25 total real Chrome fixtures**. Alpha mouse and beta keyboard native form
  submissions execute compiled WBasic/SEWN on independent hosts. HTTPS credentials
  are separate host-only Secure/HttpOnly values, inaccessible through document.cookie;
  parking and unknown hosts receive none. Assets and absence of cross-host redirects
  are checked. Local HTTP credentials are independently verified in Chrome.

The HTTPS browser fixture performs **real TLS termination** at a local native HTTPS
proxy, strips visitor forwarding metadata and supplies single validated fields to
an exact loopback peer backend. It creates a disposable one-day self-signed local
certificate and uses a fresh Chrome profile with a certificate validation exception.
This tests HTTPS and Secure-cookie behavior, **not public CA trust, SNI fleet
configuration, certificate automation, ownership verification or production TLS**.
Separate unit/raw HTTP forwarded-header cases are not claimed as TLS tests.

## Complete verification matrix

| Check | Result |
| --- | --- |
| Repository, default process isolation | **808/808**, no failures/skips/cancellations, 24.1 seconds |
| Client unit regressions | **90/90**, existing client runner isolation unchanged |
| Chrome compatibility + new routing | **25/25**, as detailed above |
| Content checks | `npm run check`: **3 pages, 42 internal links**, unique anchors |
| Browser history guard | **22 versioned files** protected; guard stays fail-closed |
| Distribution comparison | **All 23 distribution files**, including current size pointer, byte-identical to I0 |
| Reproducibility | Standard pretest and client-test rebuild reproduce pinned alpha.8; no new browser version |
| Package dry runs | **7/7 workspace packages**, no publishing |
| Public documented example | Unmodified `node examples/hostname-host/run.js`; all five printed hosts return expected 200 content; SIGINT exits 0 with disposable-root cleanup |
| Final diff | Source/security/new files, version synchronization, docs and `git diff --check` reviewed |

The first complete integration run was **806/807**: the new forced-drain fixture
correctly asserted terminal cleanup failure but its teardown then treated the same
expected error as unexpected. The fixture now explicitly expects that cleanup
failure while retaining disconnect, retirement and late-mutation assertions.
A subsequent default-isolation run passed **807/807**. Final coverage also adds
strict raw-header-count rejection and explicit null routing-policy rejection.
No tests were removed, skipped, or moved to weaker repository isolation.

Early focused/browser runs caught IDNA conversion expanding shortened IPv4, parking
example home/route mismatches, a test fixture syntax error, and Chrome native POST
Origin:null under no-referrer. These were corrected; null Origin was not allowed
as a workaround. Routed documents use same-origin referrer policy with exact-origin
and existing CSRF checks. A temporary CLI probe initially looked for a cosmetic
Taskboard title that is not rendered; it now verifies the actual compiled task
content. A sandbox subprocess attempt and one automatic approval-review timeout
were rerun successfully with the authorized local test environment; neither is
reported as passing evidence.

Browser sizes are unchanged: **505495 readable / 312395 minified / 100332 gzip /
86775 Brotli bytes**. No extra runtime dependency, frontend framework or compiler
was introduced into WydClient.

## Remaining limitations and I2 handoff

- Public domains/zones are operator assertions. No automated DNS ownership proof,
  maintained public-suffix database, tenant registration or dynamic reassignment.
  Operators must not configure someone else's domain or public suffix as their zone.
- One exact-peer, sanitized X-Forwarded-Host/Proto HTTPS model; no Forwarded chains,
  CIDR trust, arbitrary client-IP claims, native HTTP/2, native TLS or ACME.
  Backend networking/firewalls and production proxy sanitation remain operational
  responsibilities. Local HTTP is restricted to development names/loopback.
- No host-derived redirects, wildcard credentialed CORS, cross-App SSO or grants.
  Programmatic POST clients must provide exact Origin plus normal CSRF credentials.
- Parking supports four approved canonical Page variants, not per-tenant script,
  remote metadata, an editor or CMS. Parking has no enabled services/host execution.
- The routing-test form displays validated input/compiled action feedback in its
  response. It is not durable Taskboard editing or a new persistence feature.
- Existing I0 shared-process CPU/heap/event-loop limitations remain. Shutdown is
  bounded logical retirement/drain, not durable exactly-once cleanup or process
  isolation. Accepted external writes are not rolled back by retirement.

I1 establishes the routing/origin boundary for later scoped I2 hosting work.
Administration, automated provisioning/verification, certificate infrastructure,
hard tenant quotas, billing, federation, CMS and independent L audit remain later
milestones. No production-readiness or independent-audit claim is made.
