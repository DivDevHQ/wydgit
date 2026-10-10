# Wydgit 0.2-H — event and lifecycle documentation bundle

Status: implementation specification. Prepared 2026-10-08 from the referenced “Create Generic Wydgit Boilerplate” conversation. This bundle defines the milestone; it does not claim that the runtime has been implemented or tested.

Read in this order:

1. [Model](01-model.md): founding rules, context, lifecycle, state ownership, and dispatch.
2. [Safe HTTP surfaces](02-request-response.md): request, response, Markdown, files, headers, cookies, and client boundaries.
3. [Acceptance and scope](03-acceptance.md): required tests, version/changelog work, deferred features, and completion criteria.
4. [Codex implementation prompt](04-codex-prompt.md): copy or supply this together with the entire bundle to the Wydgit repository task.

The conversation is the design source, not proof of existing APIs. No repository sources were available here. Code snippets describe the intended WydBASIC surface; Codex must align syntax with the actual parser without changing these semantics or pretending unsupported syntax already works.

## Decision provenance

Conversation-backed rules include Page-in-Session execution, transient Page trees, semantic events, safe context objects, parameterless handlers, SEAM authority preservation, no direct DOM access, and platform-owned rendering. The conversation recommends the lifecycle/event inventory and parent-first traversal with child-first cleanup.

This bundle resolves previously tentative details: `EVENT.Target` is the current recipient; `ME` is the handler owner; cancellation and handling are separate; response body operations are terminal; dispatch snapshots and bounded queues govern mutation/reentrancy; client Mount precedes Ready; and cleanup runs on failure and early response. These are explicit 0.2-H baseline decisions, not claims that the prior conversation settled every edge case. If actual architecture makes a decision incompatible, document the concrete conflict before altering the contract.

## Philosophy

Keep KISS/KICK as Wydgit's established philosophy; do not invent expansions or redefine either term. Prefer semantic intent over transport plumbing and a small, rigorous kernel over framework ceremony. Wydgine owns server execution and transport. WydClient owns client adaptation and rendering internals. SEAM governs authority. Keep the event envelope and semantic contracts compatible with future SEWN execution without implementing SEWN now.

The bundle uses generic runtime vocabulary and original documentation. Naming is not a substitute for copying another framework's code or documentation, and this bundle makes no legal-clearance claim.
