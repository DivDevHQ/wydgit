# H2 verification

Branch `develop/0.3`; clean starting tree at
`c4a5c94` (WBasic audit documentation baseline). Work is confined to WydClient,
its lockfile version, examples, tests, generated alpha.3 artifacts and documentation.
No language/executor/server implementations or previously published bundles changed.

## Results

- Focused WydClient suite: 53 passed, zero failures, including H1/H1b regressions
  and nine H2 cases covering lifecycle, ownership, isolation, malicious content,
  bounded capacity/depth, inherited properties/visibility and rendering recovery.
- Full `npm test`: 689 passed, zero failures. Includes existing H0, SEAM, SEWN,
  Guestbook, Taskboard and security regressions. No regression tests removed.
- `npm run check`: three complete pages, 42 internal links, unique anchors.
- Chrome 155.0.8059.39: 14 actual HTTP smoke fixtures pass (12 retained H1/H1b
  plus standalone/embedded H2). Both H2 examples report PASS; ordered display,
  removal, isolated IDs/references and surviving-root updates are asserted.
- `npm run build:client`: readable/minified alpha.3 bundles generated successfully;
  standalone bundle tests verify no imports, Node builtins, eval or HTML injection.
- Package dry-run: succeeds with immutable distributions, static examples and docs.
- `git diff --check`: clean. Status, diff/stat and staged additions inspected before
  the explicitly authorized commit/push; no unrelated starting changes existed.

## Distribution measurements

Bytes, reproducible in `packages/wydclient/dist/sizes.json`:

| Form | H2 alpha.3 | Checked-in H1b alpha.2 | Increase |
| --- | ---: | ---: | ---: |
| Readable | 93473 | 81670 | 11803 |
| Minified | 56947 | 50455 | 6492 |
| Gzip | 19196 | 16754 | 2442 |
| Brotli | 16848 | 14787 | 2061 |

The comparison uses actual checked-in alpha.2 bytes, rather than the older
H1b verification report (which records an earlier 36199-byte minified build). H2 adds the trusted
instance adapter and uses the current shared H0 prototype/declaration validators;
prior immutable artifacts remain unchanged. No compiler, package builder, server
execution engine or runtime npm dependency is added to the distribution. Shared
validation is retained rather than substituting divergent browser rules.

## Limits and H3

The sandbox blocks local sockets and npm cache writes. Full HTTP tests, Chrome
and package dry-run required approved outside-sandbox execution; focused DOM tests
and content checks ran in the sandbox. Chrome and Happy DOM were verified; Firefox,
Safari, remote CDN and native platforms were not. No publishing/tagging/release.

Rendering is intentionally literal text, fixed hooks and ordered Section/Block
composition. Arbitrary attributes/URLs, full Markdown, controls and executable
methods are unsupported. Same-realm JavaScript belongs to the trusted host.
The host adapter is not a SEAM facade and must never be given to portable code.
H3 must bind authenticated live contexts and authorized references, enforce exact
member visibility/capabilities and shared SEWN budgets, and recheck cancellation
and disposal. See README for complete implemented lifecycle and boundary contract.
