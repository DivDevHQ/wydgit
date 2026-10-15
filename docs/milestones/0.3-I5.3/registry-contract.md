# Provider registry contract

`wydhosting.registry/1` is closed JSON. This schema versions **all contained record
shapes**; unknown keys at every level and unknown schema revisions fail. No implicit
upgrade, fallback, code evaluation or publisher extension fields exist. The trusted
facade returns deeply frozen canonical JSON. Input is at most 4 MiB with bounded
JSON depth (existing engine cleaner); each collection has at most 1024 records.
Provider IDs are 1–128 ASCII letters/digits/underscore/hyphen excluding reserved
prototype keys. Canonical App IDs use Wydgine's existing `validId`, at most 128 chars.
Uniqueness comparisons are case-insensitive; references must match exact registered IDs.
Revisions and epochs are nonnegative safe integers (record revisions/epochs start at 1).

## Closed shapes

Every listed field is required, including explicit nulls where indicated.

| Record | Fields |
| --- | --- |
| Registry | `schema, providerId, revision, plans, customers, accounts, pools, apps, domains` |
| Plan | `planId, revision, tier, maxApps, maxPools, allowPerApp, resources, limits` |
| Customer | `customerId, state, planId, planRevision, accountId` |
| Linux assignment | `accountId, customerId, uid, gid, home, state` |
| Pool | `poolId, hostId, mode, customerId, accountId, base, capacity, generation, state, isolation, resources, limits, transport` |
| App | `appId, customerId, source, snapshot, approval, placement, state, role, resources, limits, namespaces` |
| Placement | `poolId, directory, deploymentId, epoch, state` |
| Domain | `hostname, appId, customerId, approval, evidence, state, epoch, revision` |
| Remote namespace reservation | `endpoint, bucket, namespace` |

States are `active/suspended/retired`, except account `state` is only `intended`.
`role` is `tenant/parking`. The only host is `local`. `transport` is exactly
`{mode:'local-http'}` or `{mode:'trusted-proxy',peers:[...]}`. Fixture proxy peers
are unique loopback IPs only; I1 remains authoritative for actual route validity.
There is no listener or edge configuration execution in this adapter.

Plan `(planId,revision)` records are immutable: register a new revision and explicitly
change the customer's pinned subscription. Customer `accountId` is null for free.
Paid/dedicated customers have exactly one account assignment matching customer ID.
Provider worker accounts have `customerId:null`; shared pools explicitly reference
one. Accounts require unique account ID, uid, gid and canonical home; numeric IDs are
1–2147483647. This records proposed ownership, not actual account existence, login
configuration or safe UID availability on a host. Matching names/numbers grant nothing.

Pool modes are `shared`, `dedicated-customer` and `dedicated-app`. Shared pools have
null customer ownership and a provider account; other pools require the owning
customer's account. Their `isolation` strings are `shared-process` or
`separate-process-uid-required`. These are requested profiles, never enforcement facts.

## Allocation policy

- Free: exactly one reserved App/customer; one-pool entitlement, shared placement,
  no customer Linux identity. Maximum combined admission 4, payload allowance at most
  16 MiB, explicit SEWN step reduction at most 1000. Provider may choose lower limits.
- Paid: configured App count, one dedicated customer pool by default and at most one
  pool in this tier. A separate intended account is required. Apps retain independent
  canonical service/SEAM ownership even when they belong to one customer.
- Dedicated: configured App/pool counts and optional `allowPerApp` for one App per
  dedicated-App pool. Accounts remain per customer; per-App process requirements are
  explicit. Further per-App UID policy belongs to future Linux qualification.

`resources` has exactly `maxPending,httpConcurrent,directConcurrent,payloadBytes` and
uses the existing Wydgine governance ceilings. `limits` uses existing execution-limit
reductions only. App values must satisfy both entitlement and pool reductions; omitted
required reduction keys are rejected. No policy grants SEAM capabilities. Capacity is
at most **16 total entries**, including parking, distinct from CPU/RAM/disk isolation.
Retired/suspended reservations still consume capacity and entitlement, intentionally
preventing reuse of old resource authority. No commercial prices or product branding.

## Ownership and filesystem rules

Each App contains exactly one placement. No supplying pool can acquire an App by name.
Registration supplies canonical ID, explicit customer, approval reference, source,
execution-input snapshot digest and deployment/epoch. Changes require a typed provider
operation against an expected registry revision. No operation changes App customer
ownership. Customer-to-customer transfers are unsupported. Placement moves require
incremented epoch and remain unappliable until the stopped migration adapter exists.

App IDs, DNS names, folder names, Linux identities and Gate membership are independent.
Domains are unique provider-wide even after retirement. Hostnames must already be
normalized by the existing Wydgine authority parser, with no port. Each domain references
the exact App customer and placement epoch and has separate approval/evidence. The
approval labels are I1's operator/platform/local-development labels. They do not
prove DNS control. Changing a domain targets a same-customer App and increments its
own revision; retired domains cannot be reclaimed.

Pool bases are canonical absolute nonoverlapping paths. App sources and account homes
are separate from pool execution roots. Sources cannot overlap each other or another
customer/provider home. Home roots cannot overlap each other or any pool. Deployment
IDs are unique; relative placement directories have bounded safe segments and cannot
overlap within a pool. This fixture chooses the stricter separate-source/separate-pool
layout; I4's provider-controlled paid execution beneath a home is not enabled here.

All actual fixture path inspection additionally requires a trusted `fixtureRoot`
constructor/adapter option, never a registry field. Source/home/base declarations
must be its strict descendants; broad filesystem roots are refused as fixture roots.
Provider state must be disjoint from every declared protected root. Existing ancestors
are checked for symlinks; execution trees go through I0 hardlink/symlink/tree checks.
Missing staging paths are reported as pending, never replaced with a source path.
The fixture root/state ancestry must be protected from hostile OS writers. Node's
path checks do not provide descriptor-relative race-safe staging or OS ownership proof.

Remote reservations are explicit per-App namespace records. Exact normalized HTTP(S)
endpoint + bucket + namespace must not overlap equal or slash-descendant namespaces
anywhere in the registry, including different pools/retired Apps. Credentials in URLs
are rejected. Actual S3 configuration must match a registered reservation exactly;
existing I0 namespace restrictions also run. Different endpoint aliases for one real
service cannot be detected by string comparison; operators must approve one canonical
endpoint identity. Remote provisioning and fencing remain unsupported.

## Canonical inventory compilation

`compilePool(registry,poolId,{fixtureRoot})` inspects the entire registry, checks global
reservations and returns frozen **`wydgit.multi-host/0.1`** JSON. Roots are relative
approved placement directories under that pool's canonical base; arbitrary customer
home/source paths are never supplied to I0. Only active assignments enter the output;
the selected pool and their customers must be active. All reservations still count
against the sixteen-entry bound. Exact approved domains compile into existing I1
routing; parking remains anonymous/service-free as required by the engine.

Every fully staged pool is checked through the real `validateAppInventory`; explicit
compilation always requires its selected pool to be fully staged and pass validation.
This preserves canonical App IDs, catalog/receipts/recovery refusal, service ownership,
root confinement, routing/parking and resource policy. Missing staging can be reserved
as intent; it can never produce an executable inventory. No controller is created by
inspection/validation/planning/compilation.

`fingerprintApprovedApp(root)` binds the existing engine configuration/catalog fingerprint
plus sorted byte hashes of content, prototypes, public and config. It rejects links,
limits traversal to depth 32/8192 entries and input bytes to 16 MiB/file and 128 MiB
aggregate. Its digest is an integrity check, not publisher authentication or a complete
backup of mutable service data/node_modules. Approval references remain independent
trusted operator assertions. Any staging/ownership or real deployment must be separately
qualified before production use.
