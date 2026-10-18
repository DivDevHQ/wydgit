# Wydgine 0.3 package lifecycle hardening

Commissioned 2026-10-18. **Status: partial implementation; production milestone
acceptance remains blocked.** This named workstream does not renumber 0.3-I
(Multi-App/hosting), I0–I5.6, or 0.3-J (administration). No earlier package lifecycle
milestone identifier was found in the current milestone records. The mission's
provisional 0.3I conflicts with established hosting records. Decision 0003's managed
hosting deferral and six security work packages remain unchanged.

## Initial audit

The starting branch was clean `develop/0.3` at `5da84b5`, version
`0.3.0-alpha.15`. Historical `wydgine/` modules are compatibility re-exports;
`packages/wydgine/src/engine` is the canonical implementation. No downstream project
or production site was touched.

| Area | Starting implementation and gap |
| --- | --- |
| Manifest/source security | Closed bounded local manifest; publisher-qualified identity; platform/library semver; relative nonhidden resources; no symlinks/JS; prototypes/compiler validation. Publisher metadata is not a signature or approval. |
| Installation | Read-only branded plan; exact host grants and physical owner/schema mappings; authorized canonical attachment; one principal per Page; atomic accepted App/catalog file. Repeated install refused. |
| Receipts | Embedded resource hashes, mappings, exact grants, initial attachment metadata and base/catalog hashes checked at startup. No dependency installation reason or package graph. |
| Dependencies | `requires` resolves host-enabled canonical/approved runtime libraries, with host-only infrastructure enablement. Static libraries/interfaces separately pinned. No application-package dependency declaration/resolver or reverse graph. |
| Ownership | App owns instances; package owns definitions. Storage enforces App/publisher/package/principal and optional installation identity. No package physical-purge authority. |
| Updates/removal | Explicitly documented as unimplemented. No install-owner reference-count deletion bug existed because no uninstaller existed. |
| Recovery | Catalog file fsync/rename; exclusive empty lock; stale lock blocked startup. Infrastructure installer saved old config/catalog and compensated handled failures; crash reconciliation was manual. Directory durability and writer metadata were incomplete. |
| Storage | JSON whole-document serialization/atomic rename and SQLite record transactions/history/schema validation. No package schema-change, physical purge, cross-store checkpoint or lifecycle transaction contract. |
| SEAM/SEWN | Branded contexts, deny-by-default authority, shared terminal budgets, bounded compilers, service cancellation/commit settlement. Generic LIMIT did not identify the first exhausted resource in trusted diagnostics. |
| Existing coverage | Guestbook and Taskboard package/HTTP/security, installer CLI and infrastructure failures, multi-App isolation and shared SEWN budgets. These did not establish update/uninstall/reinstall correctness. |
| Reliability | Open WYDGINE-0.3-HTTP-LIMIT: Contact POST and shared drain sometimes return page/cleanup SEWN.LIMIT under full-suite execution. Passing reruns are not attribution or closure. |

Reviewed repository development/founding architecture, package/distribution/storage/
SEAM documents, I0 execution/ownership contracts, I5 package boundaries, release
status/Decision 0003, native installer/catalog/infrastructure code, JSON/SQLite
adapters, existing package/Guestbook/Taskboard tests and retained HTTP evidence.

## Implementation phases

1. Preserve the native installer and accepted-state publication architecture. Add a
   manifest-based graph and reverse analysis, receipt-bound explicit/automatic
   reasons, protection and dependency-safe recursive pruning.
2. Compose the existing planner against candidate snapshots. Add conservative
   update/upgrade, retained uninstall/reinstall and narrowly authorized catalog
   purge. Preserve App-owned customization and content. Refuse schema migrations
   and physical deletion until adapter recovery/ownership contracts exist.
3. Share catalog locking/publication with the existing installer, journal durable
   boundaries, fsync publication directories and provide host-authorized recovery.
   Keep multi-resource provisioning recovery explicitly separate.
4. Exercise failure injection, real process death, competing plans, cancellation,
   hostile receipts/authority, two storage backends and seeded graph invariants.
   Add trusted resource diagnostics and run focused/full regressions.
5. Document actual guarantees and unmet acceptance criteria. Keep version
   `0.3.0-alpha.15`: the commissioned milestone is not complete and no release or
   hosting compatibility claim is made. WydClient advances to 0.1.0-alpha.9 because the shared ledger diagnostics change
   browser bundle bytes; alpha.8 and earlier distribution artifacts remain immutable.
   Current examples, authoring metadata, size report and lockfile follow alpha.9.
   No dependencies were added.

The [verification record](verification.md) retains exact executed commands,
counts, failure investigation and qualification boundaries.

The [implemented contract](../../package-lifecycle.md) specifies API, graph,
retention, errors, budgets, publication and recovery details.

## Remaining acceptance gates

| Gate | Status / concrete next work |
| --- | --- |
| Required/shared/transitive dependency safety | Implemented with recomputed graph, proposed-state validation and atomic publication; deterministic and integration regressions. |
| Catalog lifecycle recovery | Implemented/tested old/new publication boundaries with SIGKILL for install/update/uninstall. Local cooperating writer model only. |
| Configuration/content retention | Implemented, including real Guestbook JSON/SQLite records, navigation and exact authority. |
| Schema/data migrations | **Blocked for qualification**: design/version a trusted WydStore schema migration + checkpoint contract; validate record history, ordered versions, idempotency, commit uncertainty and destructive-change recovery on both adapters. Do not write SQL/files from package code. |
| Physical purge | **Blocked for qualification**: trusted adapter-scoped owner verification, explicit content authorization, recovery checkpoint and restart-safe purge completion. Current API refuses physical purge. |
| Provisioning crash recovery | **Incomplete**: qualify the existing host config/provider compensation journal, durable created-resource ownership, partial preparation and failed compensation. Current automatic recovery is catalog-only. |
| Incompatible instance migration / committed rollback | **Unsupported**: preserve/fail before publication; needs reviewed versioned transformations/checkpoints. Old accepted state is preserved on prepublication failure; no arbitrary rollback promise. |
| HTTP resource reliability | **Open release blocker**: versioned meters now expose first cause to trusted observers; controlled deadline probes and passing focused runs do not identify historical full-suite delays. |
| Deployment/storage durability | No network filesystem, power-loss, hardware or live-site qualification. No deployment performed. |

These require substantive storage/runtime contracts and qualification, not an
acceptance waiver. 0.3-J may design against the conservative API and structured
refusals, but cannot safely advertise full production lifecycle support until the
open gates close. No managed WydHosting qualification is implied.
