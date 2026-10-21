# Operation BackOffice — foundation implementation and qualification

**Latest: B3 (2026-10-21)** — see the [ratification, preflight and validation report](backoffice-b3-migration-preflight.md).
DEC-01/DEC-02 are approved exactly as authorized by the Project owner; their
runtime enforcement and qualification remain pending. Read-only installed inventory
and pure candidate validators do not change the **59 implemented / 4 partial /
1 missing / 0 unverified** inventory or the **12 deferred** rows. Existing dispatch
remains receipt-wide and canonical BackOffice Page HTTP entry remains missing.
B1 and earlier implementation/test evidence below retains its historical status.

Recorded 2026-10-20. This is a bounded conformance increment, **not foundation
completion or release qualification**. The [matrix](backoffice-conformance-matrix.md)
retains stable IDs for the next session. No version, schema, dependency, Page deadline,
frozen client distribution or accepted example package artifact changes.

## Baseline and authority

- Repository `/home/brian/Projects/wydgit-platform`, branch `develop/0.3`.
- Starting HEAD and fetched `origin/develop/0.3`:
  `95e5f3ba23522518dd40e0f209953c722581d0e9` (Spike L). Zero divergence, clean tree.
- Read `AGENTS.md`, `docs/DEVELOPMENT.md`, the founding architecture and all sixteen
  requested architecture/status documents in full. Also inspected object-model,
  component, canonical dispatch, installed-package, provider and test fixture code.
- User explicitly authorizes ordinary commit/push to this branch; local instructions
  otherwise prohibit them without authorization. No reset, history rewrite,
  deployment, release, version bump or downstream-project change is included.
- Node `v24.21.0`. Baseline native BackOffice/context/scoped-policy selection:
  **112 passed**, zero failed/cancelled/skipped/todo.

All required source documents and their sections are indexed in the matrix. Principal
sources are the founding architecture; execution contexts and implemented foundation;
placement lifecycle; scoped policy and Store authorization; reviewed package policy;
actions; HTTP/UI; package lifecycle; SEAM; Gate membership; Store; current release
status/reliability; WydData and CIR. The latter two do **not** add 0.3 requirements.

## Inventory and precedence decisions

The initial matrix has **64 in-scope requirements**: 56 implemented with observable
regressions, four partial, one missing and three unverified. Twelve separate rows
cover explicitly deferred, proposed or reserved work. Counts are rows, not features,
API declarations or percentages. Final inventory: **59 fully implemented/verified, 3 partial, 1 missing, 1 unverified**.
The 12 deferred/proposed/reserved rows and two blocked decisions are unchanged.

Historical alpha.16/17 notes defer placement/policy/UI that alpha.18–23 explicitly
implement. Those later versioned contracts govern their exact supported subsets.
The general execution-domain matrix remains a target inventory. Full ADM-01 is not
satisfied by its backend, HTTP or generic action-shell subsets. Earlier package
lifecycle prose says manual retire/stage is unimplemented, but its final Manual
retirement section explicitly adopts the later stopped-App replacement contract.
These explicit amendments resolve historical wording without rewriting it.

The HTTP status table distinguishes authorization, validation and service failure;
its older generic-denial sentence obscured that distinction. The bounded correction
below follows the status table and changes no authority decision. WydData is accepted
direction with proposed details/deferred implementation; CIR is a proposal. Their
wire protocol, generic data controls, resolver and System execution remain excluded.

## End-to-end authority and lifecycle findings

The active programming model is Client/SUB and Server/FrontEnd or BackOffice.
`execution/placement.js` validates exact identifiers and inherited restrictions;
`seam/context.js` brands immutable bindings. Context labels, object inheritance,
containment, Gate role names, publisher identity and request fields cannot issue
capabilities. AccountAdmin/HostAdmin/System remain unavailable. Context errors and
lifetime guards are tested independently of service permissions.

An installation's host-approved receipt supplies capabilities and concrete scopes.
`packages/index.js` independently validates managed instance, App, receipt and
selected placement generation. The complete inherited tree and accepted artifacts
are validated. Upgrade preserves reconciled approval subsets; placement changes,
retirement, policy changes and retained reinstall fence obsolete authority. Metadata
checks include inode/size/nanosecond mtime/ctime and recovery barriers on every live
check; changed metadata triggers full validation. No polling grace period was added.

`packages/backoffice.js` reconstructs action registrations from active installed
BackOffice placements. Opaque session resolution supplies the initiating identity,
then each action reacquires receipt-bound execution, checks its independent capability,
approved required scopes, current Gate permission and trusted service preflight.
Exact references pin App/package/receipt/instance/action/generation/declaration-policy
revision. Closed contracts reject forged fields, malformed parameters and native
objects. Dispatch invokes one fixed canonical service, never a request-selected
handler or arbitrary package code. Output/lifetime/current policy checks precede
success. Native policy plan/review/apply remains outside the action service registry.

For Store actions, `packages/wydstore/src/core.js` checks App, publisher, package,
principal, optional installation, exact collection and operation capability before
provider access. `authorization.js` checks the trusted context/operation rule and
live Gate policy. Transactions validate/authorize all members before execution.
Private Gate directory identity remains `library:wydgate`; no universal BackOffice
Store handle exists. Cached facades do not cache allow decisions. Local unchanged
save and draft edits still perform no I/O. JSON and SQLite satisfy the same logical
contract; they retain different durability/locking limits and no OS containment claim.

`http/routing.js` selects the App before credentials; `http/backoffice.js` accepts
only the established cookie, exact origin, scoped CSRF and closed action envelope.
The shell is metadata-driven native web presentation. Authentication alone supplies
no action permission. Public Page selection remains FrontEnd and refuses BackOffice
placement. Unknown administrative routes and native lifecycle/policy operations
remain inaccessible. HTTPS cookie/CSP/origin rules and Firefox's same-origin
referrer correction remain intact.

The action ledger preserves the 1,000 ms execution ceiling, service-call reductions,
request deadline and disconnect guard. Maintenance leases remain until admitted
native work settles. Revocation freshness is per admission, not an atomic transaction
between Gate and another store; already admitted writes can finish. HTTP errors or
lost responses do not prove rollback. Neither this work nor an outcome header supplies
exactly-once delivery, durable idempotency or an automatic retry rule.

## Security-critical gaps and blocked decisions

No privilege-escalation vulnerability was demonstrated in this bounded audit. This
is not proof of absence or a hostile-native-code sandbox qualification. Missing
security-sensitive Page composition and scope semantics are explicitly recorded:

**DEC-01 — BLOCKED — ARCHITECTURAL DECISION REQUIRED** (BO-HTTP-09, BO-REU-05).
The target architecture describes reusable administrative Wydgits/Pages. The current
accepted HTTP contract exposes an authenticated generic action shell, not a canonical
BackOffice Page publication path. The generic Page executor/controller can accept
trusted BackOffice contexts, but public installed-Page acquisition deliberately
rejects them. No accepted route/descriptor specifies which installed Page a request
may select, its discovery/authorization rule, per-instance action binding, scope
attenuation or how Client/SUB events cross that boundary. Do not expose existing
Page slugs under `/backoffice` by inference or let public transfers select an elevated
context. Review the smallest explicit Page admission/composition contract first,
then implement through existing placement, Page, SEAM and HTTP mechanisms.

**DEC-02 — BLOCKED — ARCHITECTURAL DECISION REQUIRED** (BO-ACT-10).
Action `scopes` are documented as required resource subsets. Current authorization
preflights those resources; dispatch keeps the package's whole approved receipt
scope. Store independently checks the actual input resource, capability and live
policy. The contract does not explicitly say whether an action's scope subset is
also its maximum dispatch scope when a package owns several approved resources.
Do not silently narrow or expand it. Review whether to retain required-scope semantics
or define per-action attenuation, including transaction members and other canonical
libraries. Tests should use two same-package collections with distinct action
permissions and cover both discovery and invocation. No missing Store owner/policy
check or demonstrated cross-package bypass is claimed here.

Before this increment, direct installed HTTP Store CRUD/delete and action-specific
integrity denial lacked the added foundation fixtures. Those qualification gaps are
now covered. The independently open **WYDGINE-0.3-HTTP-LIMIT** is still a release
risk; preserved failure behavior is not a reliability correction.

## Implemented increments and tests

### 1. HTTP failure classification (BO-HTTP-07)

[http/backoffice.js](../../packages/wydgine/src/engine/http/backoffice.js) now normalizes
failure code before selecting both HTTP status and public response. Previously
`STORE.IO`, `STORE.BUSY`, `STORE.CORRUPT` and unrecognized service failures returned
400 with `ACTION.DENIED`; Store/SEAM denials also returned 400. Now:

| Failure | Public HTTP result |
| --- | --- |
| Store/SEAM/Gate denial | 403 `ACTION.DENIED` |
| Canonical request validation | 400 `ACTION.INVALID_REQUEST` |
| Store input/constraint failure | 400 `ACTION.INVALID_INPUT` |
| Store revision conflict | 409 `STORE.CONFLICT` |
| Unknown service failure, I/O/busy/corruption, unavailable/invalid service output | 503 `SERVICE.FAILED` |

Known framework codes retain their existing classification. Native action results
retain safe service codes. No provider details, new grants or retry logic cross HTTP;
credential deletion and the independent admission/outcome signal are unchanged.
The [normative amendment](../backoffice-http-and-ui.md#foundation-conformance-service-error-classification)
and `CHANGELOG.md` describe only this actual runtime change.

`BOFOUND-02` adds eleven injected service-error cases through the real HTTP/action
path after real service entry. They assert exact class, no host details, one call,
uncertain admission outcome and no cookie deletion. These are fault-injection tests,
not claims of real disk failure. All thirteen initial BOFOUND HTTP cases failed
against the prior implementation (two actual Store CRUD cases plus eleven errors),
then passed after correction.

### 2. Installed provider and lifecycle qualification (BO-HTTP-08)

[test-support/backoffice-store.js](../../test-support/backoffice-store.js) builds a
minimal actual installed package with independently approved fixed Store actions,
package-owned resources and protected operation rules. No application UI or new
runtime service is introduced. `BOFOUND-01` in
[backoffice-http.test.js](../../test/backoffice-http.test.js) runs the same contract
on JSON and SQLite: successful create/read/update/delete, required confirmation,
stale update/delete revision conflicts, denied private Gate/foreign collection,
revoked Store write permission with action permission retained, no unauthorized
mutation, filtered rediscovery, public FrontEnd Page denial, stale reference after
upgrade and empty action discovery after retirement. The records and tombstone
revisions come from genuine providers.

`BOFOUND-03` in [backoffice-actions.test.js](../../test/backoffice-actions.test.js)
adds both-provider checks that recovery lock, mirrored receipt drift, same-size
resource tampering with exactly restored mtime, and catalog symlink substitution
prevent contributed handler entry. Restored valid accepted state requires fresh
acquisition; it never substitutes another generation. Existing ACT/BOP/POL suites
retain genuine SIGKILL/restart recovery, replaced/retired handles, narrowed grants,
manifest integrity and committed-policy rollback barriers.

[scripts/verify-packed-packages.js](../../scripts/verify-packed-packages.js) now also
stages execution-context, scoped Gate/Store policy, policy lifecycle, reviewed
reconciliation and bounded body tests into installed consumers. Runtime import hooks
reject checkout runtime resolution; every consumer has exactly one installed engine.

### 3. Reusable composition qualification

[wbasic-taskboard.test.js](../../test/wbasic-taskboard.test.js) now runs its existing
full source-family controller case in both FrontEnd and BackOffice. The same neutral
prototypes, nested children, typed event navigation, per-instance state, bounded
keyed repetition, Init-once, render/unload and child disposal work through the shared
controller. This adds one test case without new application components or grants.
It is native controller evidence; existing installed Page/HTTP tests in that file
still qualify FrontEnd only, not DEC-01 or an administrative Page-to-action protocol.

## Reusable component prerequisites and next milestones

Existing foundations support single inheritance, typed properties, instance
configuration, ordered containment, derived relationships, bounded construction,
scoped events and state, and typed record repetition. Nothing added here hard-codes
an application type, store provider, model schema or BackOffice-only control base.
Server FrontEnd/BackOffice use the same controller; browser controls still run SUB.
Native DOM belongs only to trusted web adapters. Renderer-specific supported slots,
explicit service preparation, child lifetimes, inherited restrictions and SEAM
bounds remain relevant limits.

Before generic data-bound implementation, use these dependency-ordered milestones:

1. **P0/P1: decide DEC-01 and DEC-02** (design review, moderate complexity).
   Define canonical administrative Page admission and action/resource binding under
   existing exact site/package generations and current policy. Decide scope semantics
   with two-resource adversaries. No design can infer authority from `runat`.
2. **P1: implement one reusable administrative Page fixture** (moderate to substantial;
   depends on 1). Use existing Page execution, publication, semantic composition and
   action dispatcher. Prove positive rendering, unauthorized direct URL/transfer,
   FrontEnd denial, per-instance action identity, cross-site/package scope, revocation,
   stale upgrades, recovery, cancellation/deadline and uncertain native write behavior
   on both providers. Native operator policy/recovery remains separate.
3. **P0 release work: resolve the existing HTTP reliability blocker** (complexity
   uncertain; independent investigation). Preserve 1,000 ms and historical evidence;
   require demonstrated attribution/correction and focused/full qualification.
4. **P3: accessible reusable composition** (moderate; depends on 2). Qualify inherited
   configurable nested Pages, keyboard/focus/errors and human assistive technology.
   Generic shell form/table controls are useful but do not finish ADM-01.
5. **Separate reviewed WydData milestone** (substantial; depends on resource/query/
   revision/error contracts and relevant foundations above). Keep provider/resource
   capability distinct from SEAM grants; reuse Store persistence and semantic Wydgits.
   Do not require CIR. No DataBound/DataTable/DataPager/DetailForm, wire protocol or
   application-specific BackOffice Wydgits are delivered here.

AccountAdmin, HostAdmin, System/Headless/CIR, managed WydHosting 0.4, privileged
brokers, cross-domain provisioning/recovery/audit, distributed live cutover, forced
native cancellation, arbitrary scripting, universal privileged Store access, remote
idempotency and additional providers remain deferred/proposed/reserved as the matrix
specifies. Bounded Gate audit and reviewed policy history exist; no universal durable
action audit or new audit capability was implied by future cross-domain prose.

## Qualification and evidence

Structured retained results: [foundation evidence](../../test-support/backoffice-foundation-evidence-2026-10-20.json).
Raw temporary logs use `/tmp/backoffice-foundation-*`; installed evidence directory
is `/tmp/wyd-i54-packed-AAoktZ`. These paths are reproducibility aids, not durable
retention promises; structured results/hashes are retained in the repository.

- Baseline native focused selection: **112/112**.
- Failing-before HTTP regressions: **0 pass / 13 fail**; after implementation focused
  action/HTTP/body/module/protected-Store selection: **87/87**.
- Added integrity/recovery-barrier selection: **2/2**. Its first fixture attempt used
  absent source text; the fixture was corrected before qualification. No assertion
  or runtime integrity check was weakened.
- Composition/Page regression suite: **18/18**, including both controller contexts.
- Local-tarball engine integration: **514/514**; provider **35/35**; real independent
  supervised-process suite **20/20**; unprivileged Linux boundaries **25/25**.
  Service-free installed binary/HTTP/assets and one-engine/import-proof assertions pass.
- `npm test` (includes client/regex build): **1,785/1,785**, zero failures,
  cancellations, skips or todo. Repeated after final documentation/evidence edits
  before commit; final repetition is reported in the handoff.
- `npm run check`: **passed**, three complete pages, 42 internal links and unique
  anchors. Changed-document Markdown checks: **43 file links, 4 anchors**, zero missing.
  `git diff --check` passes.
- Independent frozen-client history verification: **31 immutable artifacts** pass.
  Generated client/regex build creates no tracked artifact difference.
- No manifests/lockfiles or version metadata changed. No release or deployment.

All listed passing test selections have zero failures, cancellations, skips or todo.
The initial restricted baseline reported six passing/two failing **test files**, not
112 individually reported cases; it is not counted as functional qualification. The
same selection with required local listener/subprocess access passed natively.

No real-browser rerun, human assistive-technology session, privileged Linux/systemd/
cgroup/VM experiment, power-loss test, production migration or managed-hosting
qualification was performed. Linux results describe the existing unprivileged
native/source/template/Unix boundary tests. Existing browser records retain only
their explicitly qualified subsets. Passing suites do not close HTTP-LIMIT.

## Release readiness and handoff

Additional BackOffice foundation work is required before claiming a reusable
canonical administrative Page/application foundation. Begin with DEC-01/02; the
code/test map above avoids repeating this audit. Generic data component design can
use these findings, but implementing the proposed framework or application-specific
administration now would bypass unresolved platform contracts. The bounded action
foundation is qualified for the tested installed site/action/Store subset only.

Changes are intended as one ordinary verified commit to `origin/develop/0.3`.
Commit identity, remote verification and final tree status are reported in the final
handoff; no commit hash is embedded into its own contents.


## B1 implementation and disposition

Baseline: expected `1928baa6ac1f1dd0814e9b581fede2f5cf58c359`, clean
`develop/0.3`, fetched origin with **0 ahead / 0 behind**. Reviewed the preceding
commit's runtime correction, tests, matrix and report, then the governing placement,
SEAM, scoped Store/Gate, action, HTTP, lifecycle and founding contracts. WydData's
accepted direction and CIR's proposal were reviewed only for compatibility.

This is a bounded B1 increment. Both DEC-01 and DEC-02 retain
**ARCHITECTURAL APPROVAL REQUIRED**. Existing contracts establish the necessary
security intersection and caller preservation, but do not define Page-entry policy,
Page-to-action composition, or a maximum action resource scope. Their alternatives,
security/compatibility implications and recommended resolutions are in the
[decision record](backoffice-page-admission-decisions.md). No new route, Page
permission, manifest syntax, delegation or attenuation mechanism was introduced.

### Retained correction and security proof

BO-HTTP-02/11: `http/backoffice.js` now deletes the matching reserved auth cookie
when final HTTP Session authorization detects `GATE.SESSION_INVALID`. Previously
this late path returned 401 without deletion, unlike initial authentication.
The policy object uses the same trusted transport scheme for initial and final
checks. HTTPS retains `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain;
explicit local HTTP retains its existing matching non-Secure cookie attributes.
No expiry, role, permission, identity, grant or successful response rule changes.

BOB1-01 deterministically revokes a genuine session after a real installed Store
create and the action's final policy check, before HTTP publication. Both providers
and both ingress schemes return sanitized 401, matching cookie deletion and
`uncertain`, with one create call. A fresh genuine session reads exactly revision 1
and the committed value; no mutation is replayed. Two initial provider regressions
failed against baseline specifically on absent cookie deletion; four final cases
qualify local HTTP and trusted HTTPS. Transient session-service failures retain
503 and the credential, as existing BOREL-06 tests require. The deadline and
committed-but-indeterminate response behavior are unchanged.

### Direct remaining-gap qualification

BOB1-02 (`test/backoffice-action-scope.test.js`) installs two same-package resources
with distinct action and protected Store permissions on JSON and SQLite. It proves
required-resource preflight, separately hidden archive action metadata, current
full-receipt actual-target dispatch, revoked actual-target denial, and required
resource revocation even with another resource authorized. Transaction members
retain independent policy: a denied archive member leaves the first records member
unwritten; explicitly authorized members both commit. Forged reference identities,
private Gate and unapproved resources deny. Current dispatch behavior is recorded
for DEC-02 review, not approved as a future action ceiling contract. BO-ACT-10
therefore stays Partial.

BOB1-03 (`test/backoffice-page-foundation.test.js`) installs the neutral Taskboard
family and packaged Page.PreRender behavior. Exact receipt acquisition and an
explicit native Page-root harness drive the same canonical Page executor, inherited
and nested components, typed navigation, repeated rows, cleanup and HTML publication
in FrontEnd and BackOffice. Receipt capabilities/resource scopes and lifetime are
preserved; trusted Page `self` additionally makes the App-owned root visible, as
in the public adapter. This is not a managed-instance grant in the receipt.
Public BackOffice acquisition, copied contexts, stale relocation/update generations
and retired acquisition deny. This directly advances BO-REU-05 from Unverified to
Partial. The harness's trusted Page-root adaptation is not production HTTP Page
admission, caller policy or a component action bridge; BO-HTTP-09 stays Missing.

The reusable **native composition fixture portions are now qualified**. Installed
HTTP scoped action CRUD/read/write, unauthorized caller/FrontEnd denial and lifecycle
cases remain separately qualified by BOFOUND-01 and the existing action/placement
suites. A single end-to-end reusable administrative HTTP Page fixture is still
blocked by DEC-01/02. Combining these portions through an invented bridge would
change the authority model.

BO-HTTP-12 remains Partial: human assistive-technology and the complete native
Firefox keyboard journey are not supplied by a new unit test. BO-REU-06 remains
Partial: broader property editors/content editors/dashboards and canonical Page
composition are incomplete, with unspecified feature contracts. No application
Wydgit, generic DataTable/DetailForm, WydData, CIR or wider domain was implemented.

### B1 conformance and next milestone

| Classification | B1 count | Change |
| --- | ---: | --- |
| In scope | 64 | Stable IDs |
| Implemented and verified | 59 | No promotion based on passing suite counts |
| Partial | 4 | BO-REU-05 gains direct installed native Page evidence |
| Missing | 1 | BO-HTTP-09 still needs approved HTTP admission semantics |
| Unverified | 0 | BO-REU-05 is now partially qualified |
| Deferred/proposed/reserved | 12 | Unchanged |
| Blocked decisions | 2 | DEC-01 and DEC-02 require architectural approval |

Shortest safe next increment: approve an exact installed Page/owner binding and
independent Page-entry permission, approve action required-versus-maximum resource
semantics, and specify explicit Client/SUB intent binding under the initiating
caller. Then extend existing trusted admission/execution/dispatch and qualify one
HTTP Page fixture on both providers. No privileged component base or delegation
registry is needed. Complete remaining accessibility qualification and broader
ADM-01 controls separately. Generic data-bound runtime implementation is not ready;
neutral semantic control design can proceed. HTTP-LIMIT remains OPEN.

### B1 qualification

Retained machine-readable results and log hashes:
[B1 evidence](../../test-support/backoffice-b1-evidence-2026-10-21.json).
Run commands, exact counts, skips and temporary evidence paths are recorded there.

- Failing before correction: **0 passed / 2 failed**, specifically cookie deletion;
  the restricted sandbox's one-file failure is not functional evidence.
- Focused action/HTTP/body/UI/placement/protected Store/composition and new fixture
  selection: **146/146 passed**, zero failures/cancellations/skips/todo.
- New qualification cases: **7 total** — four late-revocation provider/ingress cases,
  two two-resource/transaction provider cases, one installed native Page lifecycle case.
- Expanded local-tarball selection: **521/521 installed-engine**, **35/35 provider**,
  **20/20 real process-supervision**, **25/25 unprivileged Linux boundaries**, all
  with zero failures/cancellations/skips/todo. Checkout runtime imports reject and
  exactly one installed engine exists per consumer. Service-free binary/HTTP/assets pass.
- `npm test` including client/regex build: **1,792/1,792**, zero failures,
  cancellations/skips/todo. Final required checks follow completed documentation;
  the machine-readable evidence retains each complete run and its log hash.
- `npm run check`: **3 complete pages, 42 internal links and unique anchors**.
  Independent frozen-client history verification: **31 immutable artifacts**.
  Changed-document Markdown checks: **62 file links, 14 anchors**, zero missing;
  all **76 stable IDs** retain **64 in-scope / 12 deferred** inventory rows.
  `git diff --check` passes. No version metadata, manifests, lockfiles or frozen
  client artifacts change.

The first new-fixture combined run failed on null-prototype comparison, a stale
fixture request token after login, and attempting to declare the App-owned Page
wrapper as a managed object grant. Fixtures were corrected to retain closed grant
ownership and explicit native Page-root setup; no runtime authorization assertion
was weakened. Existing adversarial suites cover route/site/package/caller/context
forgery, unauthorized/stale references, scope/policy revocation, retired/replaced
installations, receipt and restored-mtime drift, symlinks, recovery barriers,
invalid input, concurrency, cancellation/deadlines and indeterminate native writes.
No new real-browser/human AT, privileged Linux/VM/cgroup, power-loss, distributed
cutover or production-data qualification is claimed. No HTTP retry or deadline
relaxation was introduced. Commit, remote HEAD and cleanliness are in the final
handoff; no commit hash is embedded into its own contents.
