# Decision 0002 — Portable fixed-offset date/time baseline

Status: accepted for WBasic / SEWN 0.18.

DateTime remains the existing branded UTC instant. Canonical operations use the
shared executor with invariant Gregorian calculations, UTC and explicit fixed
offsets. They never query host locale or timezone rules. Named IANA identifiers
fail explicitly; Now() remains deferred.

The repository has no pinned shared timezone dataset or timezone update protocol.
Host Intl would silently inherit differing OS/browser data versions. A pinned
regional dataset requires a separately reviewed distribution, versioning and update
contract plus bundle measurements. The current milestone therefore takes its
permitted portable baseline without adding a timezone dependency.

Month/year addition clamps invalid destination days. Calendar differences count
boundaries; elapsed differences truncate toward zero. Strict ISO parsing requires
an explicit offset equal to the supplied zone. These policies avoid implicit locale
interpretation and incidental normalization.

Fixed offsets have no DST gaps/overlaps. Regional calendar days across DST remain
unsupported, and applications must not assume a region's offset remains constant.
See [the complete contract](../milestones/wbasic-sewn-0.18.md).
