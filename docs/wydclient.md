# WydClient

The current standalone bootstrap is **WydClient 0.1.0-alpha.5**, independently compatible
with **WydSUB 0.1**. Wydgine is **0.3.0-alpha.8**. H0 continues to define the
canonical OOP contract; H1 uses the existing validators without changing server
semantics. H1b adds trusted-host container mounting, per-root configuration and
independent nested cleanup. This browser stage does not execute portable code or
grant authority.

See the [package documentation](../packages/wydclient/README.md) for lifecycle,
Page adaptation, manifests, signatures, publisher-key policy, logical regions,
static examples, deployment, measured sizes and limitations. The
[H1 milestone](milestones/0.3-H1/README.md) records the implementation baseline.

H2 introduced WydClient **0.1.0-alpha.3**, retaining WydSUB **0.1** and Wydgine
**0.3.0-alpha.7**. A trusted `host()` adapter adds scoped canonical drafts, ordered
placement, safe literal rendering, updates and subtree cleanup. See the
[implemented H2 contract](milestones/0.3-H2/README.md). Execution under SEWN/SEAM
remains H3 work; publisher signatures and object possession grant no authority.


Alpha.4 packages the updated shared canonical validation from WBasic 0.19 under a
new immutable filename. Alpha.3 was restored byte-for-byte to the previously
verified H2 artifacts. At that correction, examples pinned alpha.4 and protocol 0.1/Wydgine
0.3.0-alpha.7 remained unchanged. Repository builds now reject overwrites/deletions
of committed versioned artifacts and require a new implementation version for
changed bytes. See [distribution correction and verification](milestones/sewn-0.19/distribution-correction.md).

## 0.20 boundary and alpha.5 validation distribution

WBasic 0.20 server artifacts use closed component metadata for executable composition,
subscriptions and repeaters. H2 alpha.5 explicitly rejects that metadata and does not
execute class methods/hooks/events/bindings. Its standalone closure carries a rejection
validator rather than server lifecycle code. Alpha.1–alpha.4 bytes remain unchanged.
Alpha.5 exists because shared validator changes require new immutable bytes, not
because H3 was implemented. See the [precise execution handoff](milestones/sewn-0.20/wydclient-handoff.md)
and [actual verification matrix](milestones/sewn-0.20/verification.md).
