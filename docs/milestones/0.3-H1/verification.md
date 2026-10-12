# H1 verification and handoff

Branch: `develop/0.3`. Starting and final HEAD (uncommitted work):
`c0e0f93421b2d02ad5fb265530aecf65452f6dc5`.
The initial working tree was clean. No commits, pushes, tags, releases or
downstream changes were made; all H1 changes remain available for review.

## Changes

- `packages/wydclient/`: independent manifest/version, six small source modules,
  browser build, readable/minified classic-script distribution and measured sizes,
  bootstrap/registry/manifest/signature security tests, real Chrome smoke tool,
  default/inline/external/signed static examples, publisher fixture and README.
- Root `package.json` and `package-lock.json`: pinned development-only esbuild and
  Happy DOM, workspace metadata, build/pretest/focused-client scripts.
- `CHANGELOG.md`, `docs/wydclient.md`, this milestone's README and verification:
  versioning, trust boundaries, H0 reuse and deferred operations.

No Wydgine implementation files, canonical-library implementations, platform
version or existing regression tests were changed. Build output selects only
Object, Page, Section, Block, Field and Navigation from the authoritative H0
prototype data. H1 reuses the existing registry/member/property/JSON validators;
it does not introduce a second object model or bundle the execution engine.

## Architecture

DOMContentLoaded (when needed) → explicit single-source discovery → bounded JSON
and pinned native cryptographic verification → staged H0 registry approval →
canonical static Page adaptation → runtime-owned Top/Bottom regions → readiness.
Missing manifests succeed with the default Page. Invalid manifests/packages/Page
selection report sanitized failures and retain only a base Page with empty regions.
The private registry is read-only. Portable execution is absent; public diagnostics
contain frozen JSON and logical destinations, without DOM or construction handles.

The Page uses `wydgit/0.2`, official `wydgit.core/page`, H0 property defaults and
empty ordered slots. Title and URL pathname supply required browser properties.
Derived Pages obey the same inheritance/override policy; extra required defaults
and empty-compatible slots are necessary. Destinations remain adapter-owned.
Signature verification establishes publisher origin bindings, never SEAM grants.

## Results

- `npm run test:client`: **22 passed, 0 failed**, including standalone bundle,
  limits, origin/redirect/deadline, publisher key/signature/hash and authority tests.
- `node --test --test-isolation=none test/oop-contract.test.js test/canonical-services.test.js`:
  **27 passed, 0 failed**.
- `node packages/wydclient/browser-smoke.js`: **10/10 passed** with
  **Google Chrome 155.0.8059.39**. Actual HTTP pages cover default/inline/external/
  signed loading, late/duplicate/already-ready loading, malformed JSON, duplicate
  sources, redirect denial and CSP denial; every case checks both regions and
  preserved host content.
- `npm test`: **534 reported tests passed, 0 failed**. The default Node reporter
  counts the two new client files at file level; the focused run above reports
  their individual cases. Full suite includes existing H0 and canonical-library
  security/regression coverage.
- `npm run check`: **3 complete pages, 42 internal links**, unique anchors.
- `git diff --check`: clean.
- `npm pack --workspace @wydgit/client --dry-run --json --ignore-scripts`:
  distributable package contains both artifacts, examples and documentation;
  no runtime dependencies or missing module imports are required by websites.

Final bundle: **33,529 bytes minified; 11,666 bytes gzip; 10,341 bytes Brotli**.
Readable development output: **53,399 bytes**. Measurements are reproducible in
`dist/sizes.json`. The raw minified size exceeds the suggested 8–15 KB budget:
preserving shared H0 validation avoids a divergent reduced object model.

## Environment and remaining scope

Sandbox permissions prohibit local socket binding and browser process startup.
The initial sandboxed full-suite run was interrupted after HTTP-test failures;
the complete suite and browser smoke were rerun outside the sandbox. Chrome was
verified through headless tooling; no connected interactive browser was available.
Happy DOM supplies fast automated DOM coverage and does not establish full browser
compatibility. No Firefox, Safari, live CDN, publisher enrollment service or remote
revocation service was verified. Signed packages require native Ed25519 Web Crypto
in a secure context and fail closed when unavailable. The demo private signing key
was discarded; its public fixture is not production publisher authentication.

No blocking prerequisite remains for H1's signed-definition loading. Before future
untrusted execution, H2 must establish scoped instance construction, method/member
bindings and SEAM authority independently of verified origin. Placement, rendering,
SEWN/WydBASIC execution, persistence, services, native runtimes and automated
package lifecycle remain deferred. H1 work stops here.
