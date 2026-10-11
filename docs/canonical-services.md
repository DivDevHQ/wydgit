# Canonical service contracts — 0.3-A

The existing `wydgine/libraries` registry owns canonical service discovery,
registration, dependency order and dispatch. There is no second registry. A service
ID is the stable library ID (`wydstore`, `wydgate`, or future `wydsearch` and
`wydstream`); an operation is a declared manifest service name. Availability never
grants authority. Implementations load only from validated, explicit host npm
mappings, never from invocation arguments. Ordinary packages cannot import modules,
register handlers, construct ExecutionContexts or access raw registry handlers.

## Versions and compatibility

Three versions describe different things:

- Platform release version: root `package.json`, currently `0.3.0-alpha.1`.
  Existing canonical libraries and the Guestbook example explicitly accept the 0.3
  prerelease series while retaining their v0.2 compatibility. Their own package
  versions and service APIs remain unchanged. This bump creates no Git release.
- Library/package version: the implementation npm manifest and library `version`,
  checked against host approval and portable library requirements.
- Service API version: optional library manifest `apiVersion`, independent of both
  versions above. An exact, stable `major.minor.patch` string describes the operation
  contract. API prereleases and ranges are not accepted in this initial contract.

An implementation currently exposes one explicit API version. Invocation requires
an exact match; discovery returns that version in `registry.list()` / `get(id)`.
`registry.capabilities()` lists capability ownership. No implicit fallback or
highest-version selection occurs. Breaking contract changes require a new major
API version; additive and corrective changes follow semver, but callers still pin
an exact supported version. Simultaneous API versions and negotiation are deferred.

Existing manifests without `apiVersion` and `SERVICES.Call` preserve v0.2 dispatch.
Explicit-version implementations require `invoke` and reject legacy calls with
`SERVICE.VERSION_REQUIRED`. At the 0.3-A checkpoint, WydStore and WydGate were legacy
implementations with unchanged behavior, package versions and configuration. Adding
`apiVersion` to these libraries requires a deliberate compatibility decision in
subsequent iterations; it is not an automatic migration.

## Trusted registration

See [the non-production diagnostic fixture](../examples/canonical-diagnostic/index.js).
It is disabled in the normal host, creates no infrastructure, and returns only
`{status:'ok'}`. Tests install its private npm descriptor in disposable host roots
and exercise the real loader. It can be configured only by trusted bootstrap code.

```js
// Inside an explicitly host-approved library's register(api):
service('ping', () => ({status:'ok'}), {
  authorize: (_, caller) => caller.app === options.site &&
    caller.principal === options.principal &&
    caller.installation === options.installation,
  validate: input => input !== null && typeof input === 'object' &&
    !Array.isArray(input) && Object.keys(input).length === 0
});
```

The fixture manifest declares `apiVersion:'1.0.0'`, a `ping` operation and
`diagnostic.status.read`. Registration requires exactly the declared operations;
versioned operations must supply both `authorize` and `validate` functions.
Duplicate, undeclared, incomplete and late registration fail; caught registration
errors still poison startup. Only the loader supplies this registration facade.
The full registry and its existing raw `service` accessor are trusted host APIs;
bootstrap must pass only caller-bound facades across application boundaries.

## Invocation and grants

```basic
EVENT Page.Load
  DIM result AS Object = SERVICES.Invoke("wyddiagnostic", "1.0.0", "ping", {})
END EVENT
```

WydBASIC lowers this to `sewn/0.4`. Existing workflows retain their old schemas.
The new schema extends the object workflow grammar with `canonicalService`
statements and `canonicalServiceCall` expressions. All older wire grammars stay
closed. Literal IDs, versions and operation names are required in source.

```json
{
  "schema": "sewn/0.4",
  "procedures": {},
  "body": [{
    "op": "canonicalService",
    "library": "wyddiagnostic",
    "apiVersion": "1.0.0",
    "method": "ping",
    "input": {"op": "literal", "value": {}},
    "into": "result"
  }]
}
```

Trusted callers may use
`registry.bind(context).invoke(serviceId, apiVersion, operation, input)` directly.
The Page facade reauthorizes its Session before every invocation. The dispatcher
requires a branded, frozen host-issued ExecutionContext with a non-null App,
the operation's exact capability, and a successful resource authorization policy.
It then validates the argument contract and invokes the handler with the same
context. There is no invocation argument for replacing that context.

Capabilities retain the exact `domain.resource.action` grammar; service IDs do
not have to match capability domains (`wydstore` uses `store.records.read`). No
wildcards or role-based implicit grants exist. A package requests, for example,
`diagnostic.status.read` in `permissions.capabilities`, lists its already installed
library in `requires.libraries`, and receives only the operator-approved subset.
The existing installer already validates this against loaded library capabilities;
no new package permission schema or silent grants are necessary. The diagnostic
policy additionally restricts the site, principal and receipt identity under
host-owned options. A capability alone never approves another site's resources.

## Execution identity

Every versioned handler receives the existing trusted context, with these meanings:

| Field | Meaning and current source |
| --- | --- |
| `app` | Site/App immutable object ID from the hydrated runtime |
| `publisher`, `package` | Publisher and reusable package identity from accepted catalog |
| `template` | Package-local installable ID, interpreted together with package identity |
| `installation` | Existing accepted receipt `id`; never template or object instance ID |
| `principal` | Runtime authorization principal; currently the package ID under the one-installation policy |
| `self` | Current Page execution object ID |
| `identity` | Validated authenticated user/session metadata from trusted Session state, or null |
| `scopes`, `capabilities`, `limits` | Accepted host grants and execution limits |

Core Pages and legacy host contexts may have null package/template/installation/
principal identities. Missing receipt IDs remain null; no identity is invented.
Services needing installation-scoped resources must deny null installation IDs.
The constructor defaults `principal` to `package` only to preserve the current
single-package principal model; this is not an installation identity. Incoming
arguments named site, package, installation, user or session are ordinary data and
cannot modify these fields or grants. Roles/groups/application permissions never
become SEAM capabilities. The fixture rejects all such extra fields.

## Boundaries and failures

Arguments and results must be plain JSON: no accessors, symbols, native objects,
functions, cycles, sparse arrays or reserved pollution keys (`__proto__`,
`constructor`, `prototype`). Versioned boundaries enforce separate UTF-8 serialized request/response byte
budgets and structural depth/node limits before copying. Generic defaults are
64 KiB for each direction, 32 levels and 4,096 value nodes. WydStore has a
loader-owned profile of 17 MiB request, 33 MiB response, depth 64 and 262,144
nodes so its canonical and legacy interfaces support the same large records. Successful results
are copied/frozen `{ok:true,value}`. Failures use
`{ok:false,code,message,details:{}}`; internal exceptions and async rejections
return `SERVICE.FAILED` without implementation messages, stacks or paths. Trusted
libraries can throw the registration facade's `failure('DOMAIN.CODE')` for stable,
sanitized public codes. Invalid codes normalize to `SERVICE.FAILED`.

Resolution codes are `SERVICE.UNAVAILABLE`, `SERVICE.VERSION_UNSUPPORTED`,
`SERVICE.OPERATION_UNKNOWN`, `SERVICE.VERSION_REQUIRED`, and
`SERVICE.INVALID_REQUEST`. Capability/resource denial returns `SEAM.DENIED`;
unsafe results return `SERVICE.INVALID_RESULT`. Availability and versions are
public discovery metadata. SEWN retains its step, service-call, value and deadline
bounds; Page events retain their existing deadline and closed/stale facade guards.
An elapsed deadline cannot undo a trusted service operation already started, and
this contract adds no hard cancellation of native work.

## Library ownership and subsequent work

Host config owns provider options, resource mapping, infrastructure and secrets.
Package manifests express intent only. Each implementation must authorize resource
ownership against trusted `app`, publisher, package, principal and (where required)
installation identity and exact scopes, never caller-provided owner fields.
Resource keys should include site and installation identity for new installation-
scoped resources. No service can access another library's private storage.

Existing dependency requirements, acyclic startup order and explicit host bindings
remain the only inter-library mechanism. `dependency(id).invoke(version, op, input)`
uses the separate host-approved library context; it does not inherit or elevate the
application caller's authority. Legacy `.call` remains available only for legacy
providers. Libraries must expose public operation contracts, handle structured
failures, and declare dependency package ranges independently of API versions.
No new imports between canonical libraries or circular dependencies are introduced;
independent publishing remains possible without monorepo restructuring.

0.3-B must decide WydStore's explicit API version and compatibility strategy before
changing its manifest. Preserve logical resource mapping and v0.2 ownership checks;
this milestone does not expose new Store operations through the versioned path.
Future event handlers or background workers must bind a freshly host-issued context
with explicit grants and limits using this same dispatcher. No scheduler, event bus
or automatic propagation of authority is provided here.

Reserved for v0.4: multiple installations of one package, installation-specific
runtime principals, multiple principals per Page, revised resource mappings and
migration/receipt policy. Current catalog uniqueness, fixed template object IDs and
one-principal-per-Page enforcement remain intact. WydClient has no canonical server
service transport; no client bootstrap or identity federation is added. Concurrent
API versions, API-range requirement declarations and independent npm publication
are also deferred. External packages and host-approved libraries must explicitly
declare v0.3 prerelease compatibility; existing v0.2-only ranges are not bypassed.

## 0.3-B update

WydStore now exposes API 1.0.0. An optional validated manifest
`legacyOperations` array explicitly permits listed operations on `.call`; other
versioned libraries still require `.invoke`. WydStore lists only its original six
operations. Count, metadata and transactions require an exact version. Both paths
retain SEAM/resource checks; the versioned path retains bounded argument/results
and mandatory validation. See [WydStore](wydstore.md#03-b-foundation-current).


## 0.3-B resource policy update

The trusted host library entry may set `serviceLimits` with requestBytes,
responseBytes, maxDepth and maxNodes. Hard ceilings are 33 MiB, 65 MiB, 64 levels
and 1,048,576 nodes. Limits count serialized UTF-8 JSON including syntax and escapes,
not JavaScript string characters; responses measure the value, excluding the fixed
result envelope. Unicode and many-small-value payloads are independently bounded.
The change from 0.3-A character counting is deliberate: a multibyte payload can now
hit a byte limit sooner. Requests and responses have separate policies/tests.

Manifests cannot declare these overrides. The loader validates and freezes host
policies, then passes the actual effective request/response policy as the third
argument to trusted authorize/validate/handler callbacks. Existing callbacks ignore
the additional argument. Context serviceRequestBytes, serviceResponseBytes,
serviceNodes and serviceDepth may only reduce limits; spoofed contexts still fail.
The registration API exposes host-only `checkJson(value,budget)` so WydStore can
inspect its private state without copying it or importing runtime implementation
modules. Neither policy objects nor validators cross into ordinary Wydgit code.

WydStore checks writes and incremental batch results inside its atomic boundary,
using the minimum of store and effective dispatcher policy, before commit. Other
trusted services remain responsible for their own transactional semantics; a
post-handler generic response failure cannot undo an arbitrary side effect.
Other legacy providers retain their previous limits unless serviceLimits is
explicitly configured, in which case the host policy applies to both paths.
See [WydStore resource policies](wydstore.md#resource-policies) for defaults,
capacity guarantees, structural compatibility and memory/concurrency limitations.
