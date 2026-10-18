# WydClient

The proposed [execution-context architecture](execution-contexts-and-administrative-domains.md)
resolves `runat=Client` implicitly to `context=SUB` (explicit SUB allowed). SUB is a
portable client application interface; native desktop/mobile adapters need not
emulate a browser. Future platform-specific contexts/APIs and manifest variants
remain optional proposals, with explicit portability requirements. This design
adds no current native runtime, manifest fields or server-service transport.

The current runtime is **WydClient 0.1.0-alpha.9**, WydSUB **0.1**, with
current Wydgine/platform **0.3.0-alpha.15** (the historical H4 reference is alpha.8). The [H4 contract](milestones/0.3-H4/README.md) adds semantic native controls, typed
form drafts/submission, explicit CLIENT family/package authoring and signing.
The [H3 contract](milestones/0.3-H3/README.md)
defines authenticated executable components, independent host SEAM approval,
lifecycle, typed events, shared budgets, public scalar presentation and keyed
repetition. The [verification](milestones/0.3-H3/verification.md) records static
Taskboard/Chrome acceptance, conformance, bundle growth and unsupported capabilities.

Alpha.9 adds trusted execution-meter diagnostics without changing execution limits
or the WydSUB protocol. Historical versioned artifacts remain immutable.

Alpha.8 corrects inert literal-data validation; see the [H5 findings](milestones/0.3-H5/review.md).

Earlier H1/H2 descriptions below are historical baselines. Their execution deferrals
are superseded only by the explicit closed H3/H4 profiles; signatures still grant no
execution authority and same-realm host JavaScript remains trusted.

See the [package documentation](../packages/wydclient/README.md) for lifecycle,
Page adaptation, manifests, signatures, publisher-key policy, logical regions,
static examples, deployment, measured sizes and limitations. The
[H1 milestone](milestones/0.3-H1/README.md) records the implementation baseline.

H2 introduced WydClient **0.1.0-alpha.3**, retaining WydSUB **0.1** and Wydgine
**0.3.0-alpha.7**. A trusted `host()` adapter adds scoped canonical drafts, ordered
placement, safe literal rendering, updates and subtree cleanup. See the
[implemented H2 contract](milestones/0.3-H2/README.md). At the H2 baseline, execution under SEWN/SEAM
remained future H3 work; publisher signatures and object possession grant no authority.


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

H4 verification: [native Chrome, package/security and distribution results](milestones/0.3-H4/verification.md).
