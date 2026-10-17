# Page operation completion contract (alpha.15 compatible correction)

This contract is specified before implementation. Normal Page status contracts and deadline HTTP 500 remain; canonical store API
versions, record IDs and optimistic versions are unchanged. A failed workflow after
possible effects replaces buffered output with an explicit indeterminate error.
The additive `X-Wydgit-Operation-Outcome` header describes effects of admitted Page
service calls: `not-committed`, `committed`, or `indeterminate`. A failed Page with
possible effects uses an explicit indeterminate document. HTTP 500 alone never
promises rollback. Clients must inspect current authoritative state before retrying.

The Page's shared execution ledger owns the execution/admission deadline. Expiration
revokes subsequent service admission and cancellable precommit work. It is not a
transaction spanning the Page, nor permission to abandon an admitted write. Page
teardown waits for all admitted service calls before responding. JSON checks revocation
immediately before rename; an already submitted rename must settle and directory
fsync completes before acknowledged success. SQLite checks revocation inside its
synchronous transaction before returning to COMMIT, so expiry there rolls back.
Neither path pretends an in-progress kernel operation can be cancelled.

The outcomes describe service effects, not a Page-wide transaction. A precommit
cancellation with no other effect is `not-committed`; a successful store mutation is
`committed`; a failed Page after any commit, an uncertain commit, or a service without
a completion-aware adapter is `indeterminate`. Errors remain sanitized. No storage
paths, record values, credentials or exception strings are returned.

Reconciliation for canonical storage uses the existing stable record identity and
`get`, `history`, `query` and optimistic version checks, including after reopening the
provider/worker. A caller retrying create with the same record ID conflicts rather
than creating a duplicate; updates/deletes use their original expected version.
There is no global retry or generic Page idempotency cache. Applications generating
fresh IDs on each submission (including Contact) must reconcile by their application
read surface; automatic replay is unsafe. A durable, client-keyed Page receipt and
submission identity is still a proposed API addition, not implemented by this patch.

Transport loss is not proof of cancellation or rollback. Graceful request draining
waits for service completion; forced worker termination, provider loss, connection
loss and power failure can leave the caller without an outcome. Existing stable
record identities remain the reconciliation boundary. Arbitrary trusted libraries
must implement their own durable completion semantics; the runtime conservatively
reports their effects as indeterminate. A stuck admitted service can delay teardown
until the supervisor's existing bounded process-termination policy acts. No increased
execution budget or unbounded resource allowance is introduced.

This is an independently testable correction of post-response Page writes, not a
claim of complete request idempotency, crash receipts or I5.6 qualification.

See [resume checkpoint](continuation-2026-10-17.md) for executed tests, uncommitted
privileged candidates and unavailable guest qualification.
