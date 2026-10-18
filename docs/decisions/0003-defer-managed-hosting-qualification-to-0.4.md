# Decision 0003 — Defer managed WydHosting qualification to 0.4

Status: **accepted**, user-approved roadmap decision, 2026-10-18. Applies to
`develop/0.3`; supersedes the pending recommendation/approval language in the I5.6
manager and Debian feasibility records. It does not supersede their technical
contracts, acceptance criteria, security guarantees or historical evidence.

## Approved scope

1. Defer **managed, multi-tenant WydHosting qualification from 0.3 to 0.4**. I5.6
   remains **incomplete, experimental and not security qualified**. Preserve the
   implementation and all outstanding work; deferral is not completion or a waiver.
2. Continue **Wydgine 0.3 toward the five-site migration goals**. Use independent
   Node processes, separate OS users, secrets and storage behind a conventional
   reverse proxy. These operator-managed standalone deployments do not qualify
   managed WydHosting or demonstrate broker-compromise containment.
3. Defer the **Debian 13 VM experiment to 0.4**. Debian remains a supported target;
   managed-hosting security qualification remains outstanding. Preserve the
   [feasibility assessment and trial plan](../milestones/0.3-I5.6/recovery-and-debian-feasibility.md).
   No VM creation, installation, guest changes or other trial operations are authorized.
4. Track intermittent **`SEWN.LIMIT` HTTP 500 failures** as a separate unresolved
   **0.3 reliability issue**, [WYDGINE-0.3-HTTP-LIMIT](../milestones/0.3-reliability.md).
   Moving hosting qualification to 0.4 neither resolves nor defers that issue.

The [0.3 release-status record](../milestones/0.3-release-status.md) tracks this split.
This is a roadmap/documentation decision, not authorization to migrate or deploy any
site, change OS users/proxy/services, install dependencies, or publish a release.

## Six security work packages retained for 0.4

The existing [manager decision gate](../milestones/0.3-I5.6/manager-candidate.md#decision-gate-recommendation-only)
retains the complete dependency chain:

1. Implement live session/account/deployment verifier and protected boot/session
   history, with installed provenance and fail-closed anti-rollback policy.
2. Implement fixed protected publisher and complete effective PID 1 verifier;
   serialize publication/reload/effects with durable intent and uncertain outcomes.
3. Implement manager-owned launch job/listener plus authenticated connected-worker
   FD handoff; migrate broker and worker finally/retirement paths together.
4. Implement bounded service/socket adapter, mutual kernel authentication and result
   validation; enforce queue/rate/active-work bounds and durable result recovery.
5. Produce and review manager policy/service/label assets with simultaneous removal
   of every broker lifecycle and artifact right, then the single-identity installed
   campaign, including interrupted launch/retirement and writer attacks.
6. Qualify recovery/backup and subsequent integration gates without confusing ordinary
   offline passes with installed enforcement or full I5.8 release qualification.

No package is marked done by this decision. Preserve the I5.6 [gate table](../milestones/0.3-I5.6/README.md#gates),
[verification history](../milestones/0.3-I5.6/verification.md),
[authority contract](../milestones/0.3-I5.6/constrained-systemd-authority.md),
[coordinated cutover](../milestones/0.3-I5.6/offline-manager-protocol.md), and
[original acceptance/rollback requirements](../milestones/0.3-I4/I5-plan.md#5-cross-phase-acceptance-and-rollback).
Actual independent hostile enforcement, effective-state verification, exact lifecycle
ownership, crash uncertainty, backup/restore and applicable external-network evidence
remain required. Standalone functionality, same-UID tests, portable mocks or a
successful Debian installation cannot replace them. AppArmor is not a drop-in
replacement for SELinux/MCS; security-equivalent enforcement needs independent review
and evidence before any qualification claim.

## Consequences

Wydgine remains independent of WydHosting. The 0.3 migration path retains SEAM,
application/storage ownership, supported native dependencies, proxy/origin protections,
backup/rollback and site-specific verification obligations. No migration is marked
complete and no site design or deployment is performed by recording this decision.
The preserved VM plan and all installed security campaigns require separately scoped
approval in 0.4; existing historical permissions do not authorize new operations.
