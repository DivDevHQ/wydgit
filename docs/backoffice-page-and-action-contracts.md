# BackOffice Page entry and action resource maxima

**Status: approved architecture; enforcement pending.** DEC-01 and DEC-02 were
approved without amendments on **2026-10-21** by the **Project owner**. The exact
approval wording and preserved alternatives are in the
[ratified B2 decision package](work-in-progress/backoffice-b2-decision-package.md#owner-ratification).
That detailed contract governs implementation; this document makes the decisions
discoverable from the normative architecture.

## DEC-01 — approved

A host-approved exact installed Page entry, independent live Page permission,
active BackOffice placement and valid exact installation are separate requirements.
Use existing trusted routing, Session, acquisition, SEAM, Page execution and response
machinery. Placement, inheritance, nesting and configuration alone grant no authority.
App-owned Page wrappers need exact trusted root adaptation, not receipt object grants.

Page bindings are declarative same-installation requests to resolve exact approved
fixed actions. They are not bearer capabilities, executable handles or permission
tokens. Reauthorize entry, action and service policy at invocation and success
publication. Page lifecycle/preparation may use approved read bindings only;
mutations require separately admitted explicit intent. In-process calls retain the
original caller/context and reduce its authority. Client/SUB supplies intent, never
server authority. Cross-package Page bindings remain unsupported.

## DEC-02 — approved

Existing action `scopes` declare both required resources and restrictive maxima.
Resolve logical requirements through accepted trusted mappings/resolvers. Effective
resources are approved receipt scope intersected with the declared maximum, and
with the original branded server scope for in-process calls. Every required resource
must fit; partial intersection does not satisfy required-resource preflight.

Resource sets, operation capabilities, exact App/publisher/package/principal/optional
installation ownership, action-invocation permission and actual service policy are
separate checks. Gate permissions are live predicates, not invented personal Store
scope sets. A protected Store can require an independent current permission;
unprotected/public Store rules preserve their existing meaning. Exact finite resource
scopes permit no wildcards. Transaction envelope and all actual members must pass
scope/capability/policy checks before provider mutation; no cross-store transaction
is introduced. Gate private implementation resources remain private.

Use existing native package-policy review for exact per-action authority evidence.
Widening an action inside an unchanged receipt still requires expansion review.
Require explicit stopped-App reviewed migration before an enforcing runtime admits
active legacy BackOffice actions. Provide read-only preflight first, preserve source
until cutover, and provide no receipt-wide compatibility bypass. Old receipts and
accepted artifacts are never silently reinterpreted or edited.

## Implementation and qualification boundary

[B3](work-in-progress/backoffice-b3-migration-preflight.md) implements observational
installed inventory and pure/non-authoritative candidate validators. A valid candidate
or matching review witness is not authenticated host approval and never authorizes
execution. No existing receipt encodes durable strict-action adoption. B3 does not
reject existing Apps, publish Page entries, attenuate production dispatch or perform
migration. **Current runtime action dispatch remains receipt-wide.** B1's qualified
required-resource/actual-target protections and HTTP behavior remain unchanged.

B4 must version and authenticate durable review/publication evidence, implement
migration/startup prerequisites and strict dispatch before exposing canonical
BackOffice Page HTTP entry. Preserve all lifecycle/integrity/recovery, live-policy,
no-retry and indeterminate-native-outcome guarantees. The 1,000 ms Page deadline
and **WYDGINE-0.3-HTTP-LIMIT OPEN** status are unchanged. WydData, CIR, wider domains
and generic data components remain deferred; ratification implements none of them.
