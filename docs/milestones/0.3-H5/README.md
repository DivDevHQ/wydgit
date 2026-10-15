# Wydgit 0.3-H5 — Platform consolidation

This milestone reviews the implemented platform through H4, corrects demonstrated
defects and consolidates current documentation. It does not add multi-App hosting,
new application capabilities or an independent security certification.

- [Platform inventory, architectural review, findings and retained risks](review.md)
- [Verification commands, results, versions and distribution evidence](verification.md)
- [Current introduction and executable quick start](../../../README.md)

The runtime correction distinguishes SEWN literal data from executable operations
in the browser profile. WydClient alpha.8 carries that correction; alpha.1–alpha.7
remain immutable. Wydgine/platform stays 0.3.0-alpha.8 and WydSUB stays 0.1.
Test fixes clean temporary authoring output and reject socket bind failures instead
of leaving an HTTP fixture waiting indefinitely. No authority or budget gate was relaxed.

Current documentation leads with implemented behavior. Historical milestone reports
remain evidence for their own versions. See the findings register for the precise
server/browser boundaries and the constraints 0.3-I must preserve.
