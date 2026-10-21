# Execution context foundation — implemented contract

**B3 architecture ratification (2026-10-21):** the Project owner approved
[DEC-01 Page entry/bindings and DEC-02 action resource maxima](backoffice-page-and-action-contracts.md).
B3 adds read-only preflight/contract validation only. Historical implementation
checkpoints below retain their dates; production action dispatch remains receipt-wide
until reviewed migration and the later enforcing increment. No new Page HTTP entry
or caller/resource authority is activated by this ratification.

The [alpha.21 BackOffice HTTP/UI increment](backoffice-http-and-ui.md) adds a
site-scoped action shell; wider-domain and lifecycle limits below still apply.

The [reviewed package-policy foundation](reviewed-package-policy-reconciliation.md)
adds native stopped-App plan/review/apply with separate policy revisions and durable
host approval. Package requirements, execution placement, SEAM, Gate membership and
store ownership remain independent; direct policy-file edits still fail drift checks.

The [second increment](backoffice-placement-lifecycle.md) supersedes this historical
alpha.16 checkpoint’s placement/lifecycle deferrals; its remaining domain and
provider-cancellation limitations still apply.

Wydgine/platform **0.3.0-alpha.16**, WydClient **0.1.0-alpha.10**.
WydSUB remains 0.1; WBasic, SEWN wire versions and package runtime targets are
unchanged. This implements the first context increment of the
[architecture](execution-contexts-and-administrative-domains.md), not its complete
storage, administrative-domain or provisioning design.

## Declarations and trusted placement

One portable declaration is used for prototype restrictions and optional instance
selection:

```json
{"schema":"wydgit.execution/1","runat":"Server","context":"BackOffice"}
```

A prototype's optional `execution` declaration restricts its entire inheritance
chain. Omission is neutral. A declaration requires the exact schema and `runat`;
`context` may be omitted. A descendant can add a restriction, preserve one, or omit
its local restriction and retain its ancestor's. Changing runtime or selecting a
different inherited context rejects registration. No sets or policy language exist.
New packages that introduce execution declarations must release new artifact
versions and require platform `>=0.3.0-alpha.16` (within their reviewed upper bound),
so older engines cannot ignore the new prototype metadata. Do not retrofit accepted
resource bytes or receipts. Static libraries and interface declarations retain their existing closed contracts;
instance placement is not static-library or interface metadata.

Canonical `wydgit/0.3` envelopes allow the same optional `execution` field, alongside
the six existing envelope fields. An omitted declaration remains neutral. Hydration
checks declared selection against the resolved prototype restriction; it preserves
the declaration and original envelope version through copy, export and edits.
It does not execute code or establish host authority. `wydgit/0.2` remains readable
as neutral structural data and retains its closed six-field schema. It cannot
carry an execution declaration. No old schema creates server placement.

The existing host-only `ExecutionContext` constructor accepts case-sensitive
`runat` and `context`. Its server programming-model default is `runat: 'Server'`,
with **no context default**. Server construction requires `FrontEnd` or `BackOffice`.
`runat: 'Client'` resolves omitted context to `SUB`; explicit SUB is identical.
Unknown/case-variant identifiers, nulls, invalid pairs, AccountAdmin and HostAdmin
are unavailable and reject. A label grants no capabilities, membership or scopes.

Host code can supply `placement: parentContext` to derive matching concrete
placement from a live branded parent binding. Explicit selection must agree with
that binding, including owning App. A plain copy/JSON parent is rejected. Ordinary
containment is never consulted. The constructor remains trusted host infrastructure,
not a portable package API. An instance declaration alone never constructs it.
Host provisioning metadata must first be validated by its existing trusted adapter;
there is no new tenant-controlled provisioning or manifest field.

Instance controllers check the complete executable tree against the supplied
binding, both on initial registration and before accepting changed trees. Scope
acquisition, prototype method dispatch, construction drafts, lifecycle entry tokens,
HTTP transfer targets and legacy client adaptation enforce restrictions too.
Dispatchers reject mismatched client/server runtime bindings. The server library
loader refuses Client bindings. Public package planning, migration validation and
restart use the current public HTTP profile and reject BackOffice-only placement;
this increment does not add a BackOffice package installation interface.

## Authority and lifetime

`runat` and `context` are frozen attributes of SEAM's existing object, separate
from capabilities, exact ownership tuples, visibility, budgets and caller identity.
A receiver retains its caller's context; another object's independent grants are
never used. Existing member-adapter identity, same-caller service and budget checks
remain authoritative. No second authorization engine is introduced.

The host-only `endExecutionContext(context)` ends its placement lifetime. Trusted
derivations and spread-based limit reductions share an opaque process-local fence;
it is omitted from JSON and cannot be restored from portable data. Ended bindings
cannot issue derived contexts or use cached services, execution ledgers, edit
sessions or installer budgets. Existing controller/invocation/event guards still
apply. Ending a lifetime does not reverse an already committed native side effect
or forcibly cancel a provider call already in progress.

No live placement-change API is implemented. Hosts must end the old binding before
publishing a separately validated replacement and issue fresh authority. No package
setter, containment move or property named `context` changes the effective binding.
BackOffice is available to trusted server controllers with separately supplied
grants; it is not an administrative permission grant or a UI implementation.

## Development inventory and migration

| Inventory | Finding and bounded change |
| --- | --- |
| `prototypes/objects.json`, WBasic and example prototypes | Shared semantic definitions remain context-neutral; no public behavior needs an inherited privileged restriction. Existing source/SEWN stays unchanged. |
| `content/app.json`, pages and navigation | Repository sample is public HTTP content. Neutral envelopes receive explicit FrontEnd from the public HTTP adapter. Only displayed platform revision changes. |
| HTTP/package adapters and App lifecycle | Existing adapters serve public Pages or their application lifecycle; explicitly issue FrontEnd. They never inspect request/manifest context fields. |
| Canonical dependency bindings | Existing private implementation services retain their owner tuple and grants; the trusted loader explicitly binds their server FrontEnd placement. |
| WydSearch startup maintenance | Trusted public site indexing explicitly binds FrontEnd. Search implementation becomes alpha.2. |
| Stream peer compatibility | Stream becomes alpha.2 for the new exact engine peer compatibility; API 1.0.0 unchanged. |
| Standalone/hosting development fixtures | Five-library fixture uses updated exact library pins. WydHosting follows its exact engine dependency to alpha.16; no hosting operations added. |
| Operator policies and examples | Public Guestbook installation, interactive policy generation, Search/Media/hostname examples explicitly bind FrontEnd. Persisted operator policies require review/addition of concrete context before use. |
| Test host contexts | Server request/service/compiler fixtures explicitly bind FrontEnd. Client-only fixtures use Client/SUB, including fixtures shared with server tests through a trusted test helper. |
| Package manifests and receipts | Existing runtime targets and closed schemas unchanged. No portable authority field added; accepted resource hashes, receipt identity, recovery locks and source revisions remain checked. |
| Existing generated client distributions | Every committed historical version is preserved. New alpha.10 bundles include the shared validator/runtime changes; current HTML examples select alpha.10. Signed historical prototype-package artifacts remain unchanged. |
| Persisted development state | Repository inventory found no installed catalog, context-bearing database or pending effects journal to convert. WydStore bodies and owner/history schemas need no change. New context-bearing canonical data round-trips as canonical JSON text on JSON and SQLite. |

This is not a bulk data converter. Old server host policies lacking context fail
with `EXECUTION.CONTEXT`; review public/administrative intent and issue an explicit
trusted binding. Old envelopes containing unsupported context fields fail closed.
Do not label unknown external installations FrontEnd or edit accepted receipts in
place. Use versioned package artifacts and existing stopped-App migration/recovery
mechanisms, with full backup and exact source checks. External/live data was not
inspected or migrated. Account/host domain migration and an operator conversion
utility remain deferred. Existing stale-plan, interrupted-effects and private
checkpoint barriers are preserved, rather than replaced with context inference.

## Qualification

`test/execution-contexts.test.js` directly exercises CTX-01–CTX-06 and CLI-01:
active pairs, implicit/explicit SUB, case/unknown/reserved denial, neutral reuse,
multilevel restrictions, conflicting branded parent placement, immutable labels,
expired derived bindings, cached-service denial, stale installer plan denial and
retained edit/budget fencing. JSON and SQLite tests preserve record identity,
revision and full history across restart without converting declarations to grants.
Existing SEAM/OOP tests cover caller authority borrowing, capability/scopes,
visibility, resource limits and foreign handles.

CTX-06 is qualified for explicit host lifetime termination and existing guards;
no automatic re-placement operation is claimed. MIG-01/MIG-02 are partial: repository
host fixtures and new context-bearing persistence are covered, along with existing
package lifecycle crash/stale-plan regressions. No general conversion utility,
production migration, account/host ownership transition or OS isolation is qualified.

The baseline checkpoint is `1714331`. Sandbox runs expose Git subprocess and
loopback-listener EPERM; qualification uses authorized unrestricted local execution.
A disposable archive with its own workspace links reproduces the baseline:
1,327 tests, 1,324 passing, three HTTP 500 failures (Contact JSON, hosting operational
startup, hostname Taskboard). Contact diagnostics record `SEWN.LIMIT`; the existing
[HTTP reliability issue](milestones/0.3-reliability.md) remains open. The initial
archive linked the complete node_modules tree and was discarded as invalid evidence
because realpath assertions detected original-workspace links.

Qualification on 2026-10-18 (Node 24.21.0):

- `npm test`: 1,337 tests passed, zero failures. Includes package lifecycle,
  JSON/SQLite crash/recovery, WydStore, WydGate, SEAM, real HTTP, supervised-process
  and historical/new client artifact checks.
- `npm run check`: passed; three complete pages, 42 internal links and unique anchors.
- `node --test --test-isolation=none test/execution-contexts.test.js test/mutation.test.js test/object-model.test.js test/forms.test.js test/client-events.test.js`:
  55 passed, including ten dedicated context tests.
- Targeted client interpreter/collections/date/loop/regex/static/interface/object
  suite: 82 passed. A full run also caught a malformed-envelope error-order
  regression; implementation was corrected without weakening the regression test.
- `git diff --check`: passed. Historical versioned client bytes remain unchanged;
  alpha.10 is a new distribution, not an overwrite.

These passes do not close the pre-existing HTTP reliability release issue, nor
qualify WydStore account/host isolation, BackOffice administration or WydHosting 0.4.

Next increment: define the trusted per-instance installation placement interface
for BackOffice and its replacement lifecycle, using the existing receipt/recovery
barriers. Then implement separately scoped Gate policy and context-aware site-store
checks. Keep membership UI, wider domains and privileged provisioning in their
assigned phases.
