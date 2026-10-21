# BackOffice B4b — live runtime enforcement

2026-10-21; `develop/0.3`; starting HEAD
`1f243a7c97d6fb6bc9295118a382cdc344f26c20` (clean, exact requested baseline).
[DEC-01/DEC-02](backoffice-b2-decision-package.md) remain approved without amendment.
[B4a](backoffice-b4a-reviewed-adoption.md) supplies durable reviewed evidence;
[B3](backoffice-b3-migration-preflight.md) supplies observational analysis.
This increment consumes that evidence in the enforcing runtime. No version,
manifest, lockfile, provider format, frozen client, deadline or archived hash changes.

## Startup and migration

`admitBackOffice` in
[backoffice-enforcement.js](../../packages/wydgine/src/engine/packages/backoffice-enforcement.js)
inventories the trusted installed catalog. The HTTP pipeline runs it before
`lifecycle.start()`; native `createBackOfficeActions` runs it before publishing a
registry. Every declared action in every active BackOffice installation must have
current complete reviewed adoption. Unrelated FrontEnd/dormant/retired installations
have no new migration requirement. An informational Page requires no synthetic
action; placement alone never publishes it.

Admission validates the loaded model against current accepted state, recovery and
pending-review barriers, receipt/policy checksums, exact adoption binding, complete
action declarations, operation/API/capability/effect, logical required resources,
concrete maxima, owner and static policy requirements. Page evidence additionally
validates the actual accepted Page tree, complete ancestor constraints and exact
reviewed same-installation action references. Duplicate entry keys fail the entire
App's admission. Rejected admission does not start the App lifecycle or expose a
partially activated BackOffice registry.

Missing, partial, revoked, stale, mismatched and corrupt evidence fail closed.
`BACKOFFICE.MIGRATION_REQUIRED` identifies the local package/action prerequisite and
points to `inspectBackOfficeMigration`; integrity/recovery errors retain existing
package diagnostics. There are no secrets, Store contents or provider paths in the
migration message. Native read-only inspection/planning remains available before
migration. It is deliberately separate from execution admission and does not acquire
execution authority, change bytes, or silently renew evidence. B3/B4a reports retain
their observational `enforcementReady:false`/`enforcementActive:false` fields; passing
inspection alone cannot admit a caller. The live gate independently validates them.

The stopped-App plan/review/apply workflow remains the only adoption publisher.
Operators must review every installed action explicitly, reconcile receipt/policy
requirements separately if necessary, then approve/apply the complete selected
inventory. A Page proposal additionally requires exact host review and independent
live Page permission. Startup performs no policy write or migration.

## Restrictive action dispatch

[backoffice.js](../../packages/wydgine/src/engine/packages/backoffice.js) uses the
normalized B4a action-reference digest, including exact receipt identity, generation
and policy revision. Discovery and invocation share installed acquisition, independent
live action permission and all-declared-resource service preflight. References remain
data and are never refreshed or resolved through another installation on failure.

At invocation, the service context's resource set is exactly the reviewed declared
maximum, verified within the accepted receipt's logical/concrete approval. A server
Page preparation retains its initiating branded context, caller, capabilities, limits
and lifetime; all required resources must also fit that initiating context. It cannot
borrow a newly acquired action context to widen its authority. Capabilities needed
by transaction members remain independently required; declaring a resource grants
neither a capability nor a Gate permission.

The effective authority is conjunctive:

1. Exact installed identity, generation, accepted artifacts and current reviewed scope.
2. Declared mandatory resources/maxima intersected with receipt scope and, for server
   preparation, the initiating context's concrete scopes and capabilities.
3. Exact App/publisher/package/principal/optional installation ownership.
4. Fixed operation capability, live action permission, and live service/Gate policy.
5. Actual target and transaction-envelope/member checks before provider mutation.
6. Current context, request budget, Session and relevant Page/binding checks at
   invocation and successful publication.

Neither the raw action HTTP envelope nor native action invocation retains the old
receipt-wide dispatch route. Canonical library operations still own actual-target
policy and provider semantics. Native host acquisition/library APIs remain trusted
host tools; they are not exported to ordinary package code or HTTP.

## Canonical Page HTTP entry and bindings

`GET /backoffice/pages/<entry-key>` is a closed variant inside the existing trusted
BackOffice adapter. It uses the existing host routing/admission, origin/Fetch
Metadata rules, reserved site cookie, genuine Gate Session resolver, installed
acquisition and canonical `executePage`. Queries, extra path segments and alternate
Page selectors reject. Unsupported methods execute no Page lifecycle. An anonymous
request receives 401; an authenticated unknown key receives 404; a known entry
without live permission receives a generic 403 without private Page content.

The entry must be host-reviewed and current, independently of the caller's Page
permission. The managed owner acquires the exact installation, then trusted code
adapts only the approved App-owned Page root while preserving the guarded lifetime.
Public Page routes and transfers still reject BackOffice placement. There is no
second Page interpreter or new administrative domain.

The server Page adapter supplies `SERVICES.Call("backoffice", bindingName, input)`
(and versioned `Invoke`, API `1.0.0`) for reviewed read preparation. This is a Page
facade, not a registered library/provider. The canonical Page handler executor binds
the actual guarded receiver; input cannot choose the consumer, package, action or
context. The receiving installed node must be the exact reviewed consumer with the
accepted prototype/ancestor chain and still belong to the Page. Unreviewed newly
constructed IDs cannot substitute for it. The shared interpreter retains a workflow service facade across method frames.
Therefore handlers that delegate through user `methodCall`/`methodValue` operations
receive a denying preparation facade for that workflow; use a separate exact Page
handler or explicit browser intent for protected work. Local composition remains
available. An installed child-method regression first demonstrated borrowed handler
authority on both providers, then verifies this refusal. Component methods/hooks
without explicit Page-handler receiver adaptation also receive a denying facade; inheritance,
parent/child traversal, repetition and prototype labels create no binding authority.
Runtime-created Taskboard children retain ordinary local composition/lifecycle only.
No implicit method/property action-handle language is added.

Preparation shares the Page ledger, deadline, cancellation and completion/drain
tracker. Only read-effect `prepare` bindings may run; cleanup cannot dispatch a
binding. Direct provider `Call`/`Invoke`, legacy calls and configured presentation
provider calls cannot bypass the facade. Denied presentation requests produce their
existing safe error state. Write actions require separately admitted explicit intent.

Successful Page documents expose bounded, escaped data-only intent references in
`wydgit-backoffice-bindings` metadata, filtered through independent action/service
preflight, and the existing session/App-scoped BackOffice CSRF token. No new client
bundle or automatic mutation behavior is shipped. A custom trusted renderer/client
can consume this declarative data; the generic action shell remains available.

The existing action endpoint accepts exactly one of `{reference,input,confirmed?}`
or `{pageBinding,input,confirmed?}`. The latter pins the versioned Page reference,
binding name and exact action reference. It rechecks Page permission/approval,
requires `intent` usage, merges typed fixed inputs without accepting changed constants,
validates actual action input and every reviewed consumer constraint, and independently
reauthorizes the action/service. Output must fit both action and consumer contracts.
Multiple entries may reference one action; one entry may bind differently scoped
actions. Cross-package/cross-installation bindings and target substitution reject.
Page admission never implies authorization for every referenced action.

Before any successful Page bytes, the adapter rechecks Session, Page permission,
entry/catalog and context validity; responses are no-store with the existing CSP,
same-origin resource policy and successful-document referrer policy. Late invalid
Sessions delete the matching auth cookie. A failure after native action admission
retains the existing uncertain outcome; no retry or rollback inference is made.

## Lifetime, local process coordination and recovery

The existing stopped-App reservation now coordinates cooperating local processes
with bounded private process leases and a short exclusive admission mutex. Startup
registers before asynchronous host initialization; a live App in another local
process prevents review/apply/replacement. A maintenance reservation prevents startup.
Requests and admitted native work remain registered until settlement/drain. Multiple
runtime processes can coexist, but all must stop before maintenance.

Only dead process leases are reclaimed under the exclusive mutex. PID reuse
conservatively blocks. Unknown, corrupt, nonregular or symlink lease evidence blocks.
An abandoned admission mutex is **not** automatically unlinked: after independently
stopping local processes, the host operator must inspect that private coordination
file and resolve it. This prevents competing stale-lock removals from splitting the
critical section. It is a local cooperating-filesystem protocol, not distributed
locking, hostile-root protection or a forced cancellation mechanism. Native hosts
must not run older engines that ignore these leases alongside the enforcing engine.

Package receipts, journals, checkpoints and the catalog commit point are unchanged.
A dead process lease is not approval and does not clear an installation/recovery
barrier. Existing authorized recovery selects only its exact approved source/target.
Committed revocation cannot be rolled back as a pending operation. Replacement,
upgrade, retirement, uninstall/reinstall, policy or accepted-tree/config drift require
fresh adoption where applicable. Historical evidence cannot renew itself. A change
to the accepted App tree can stale other entries whose B4a review pinned that tree;
operators must inspect and review those affected entries before restart.

Already committed native work remains committed if final authorization, deadline
or HTTP publication fails. The completion tracker drains it and reports uncertainty;
it never claims to undo the service commit. JSON/SQLite service transaction semantics
remain unchanged.

## Qualification and conformance

[Machine-readable evidence](../../test-support/backoffice-b4b-evidence-2026-10-21.json)
records exact commands, log hashes, counts, corrected attempts and final outcomes.
[Runtime tests](../../test/backoffice-enforcement.test.js) use actual installations,
canonical HTTP, real child processes and both providers. Existing action/HTTP,
placement, policy, B3 and B4a security/recovery tests remain required. Fixture-only
migration is explicit in test support; production startup never calls that helper.

The B1 receipt-wide observations and B3/B4a evidence remain archived. Live regressions
now assert restrictive denial. Cross-process policy-race tests now require earlier
`PACKAGE.BUSY` refusal while the first process holds stopped-App maintenance, then
verify its single terminal outcome. No race assertion is replaced by unchecked success.

The immutable client build initially caught changes to shared receiver code. Those
changes were removed; receiver adaptation lives only in the server Page executor.
Historical Spike L still verifies every archived source/archive hash and its complete
installed execution guard. Its Page comparison reconstructs and compares the entire
historical FrontEnd path after removing only explicit new BackOffice branches; limits,
completion, service authorization and cleanup code remain pinned. No archived hash,
experiment, deadline, observation record or frozen artifact was rewritten.

Promotions in the [conformance matrix](backoffice-conformance-matrix.md) require live
runtime evidence: action maxima/startup migration, rendered authorized Page results,
and installed neutral Taskboard composition. Broader ADM-01 and accessibility remain
partial; the BackOffice foundation is not declared complete.

The completed independent qualification runs have zero failures, cancellations,
skips or todo:

| Command/selection | Passed |
| --- | ---: |
| `npm test` (includes immutable client/regex pretest build) | 1,954 |
| Focused 12-file native/HTTP/security/recovery selection (exact command in evidence) | 311 |
| New B4b installed runtime tests included above | 26 |
| `node scripts/verify-packed-packages.js`: installed engine | 683 |
| Same harness: installed provider | 35 |
| Same harness: real installed process supervision | 20 |
| Same harness: installed unprivileged Linux boundaries | 25 |
| Independent immutable distribution history | 31 artifacts |
| Archived Spike L source and installed guard selection | 2 |
| `npm run check` | 3 Pages, 42 links, unique anchors |
| Changed Markdown/requirements | 89 file links, 5 anchors, 76 stable IDs |
| `git diff --check` | Passed |

Earlier attempts, including the receiver regression's two expected failures,
fixture corrections, sandbox listener refusal and overlapping broad-run failures,
are retained with exact commands/counts/log hashes in the evidence. The full suite
and content check are repeated after this evidence/report recording; their final
results are recorded in the commit message and handoff. No test deadline, mutation
assertion or existing HTTP limitation is waived by a later passing run.

## Deployment prerequisites and residual work

Only disposable Members (`list-members`), Notices (`list-notices`), JSON/SQLite
records/archive (six actions each), multi-resource, bound-Page and informational
Taskboard installations are reviewed/migrated in tests. Repository `content/` has
no installed catalog. **No external or production installation was inspected,
migrated, modified, or qualified.** Stop/drain every deployment, back up accepted
state, run trusted read-only inspection, explicitly reconcile/review/apply all
required actions/entries, ensure the host root permits its private local coordination files, and restart only
after current complete adoption. Preserve
old accepted state/runtime until cutover succeeds; do not run mixed engines.

B5 still needs independent end-to-end application/BackOffice qualification, broader
reusable administrative controls, real-browser intent integration, keyboard/human
assistive-technology work and deployment-specific operational evidence. Generic
WydData/CIR, DataTable/DataPager/DetailForm, cross-package bindings and wider
administrative domains remain deferred.

**WYDGINE-0.3-HTTP-LIMIT remains OPEN.** Native concurrent Contact writes may commit
and still return HTTP 500/indeterminate after the unchanged 1000 ms Page deadline.
This increment neither reruns those archived experiments as a correction nor changes
the deadline, retries uncertain writes, or treats an HTTP failure as non-commit.
No version bump, tag, release, publication or deployment is performed.
