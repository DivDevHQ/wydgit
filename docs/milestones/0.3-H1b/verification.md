# H1b — Container-scoped WydSUB bootstrap

Branch: `develop/0.3`. Starting and final HEAD:
`bb7e771d90a3ce9778296ed7b46600786fd2592b`.
The starting tree was clean at the committed, independently reviewed H1 revision.
All H1b development changes remain uncommitted; no push, tag, release, deployment,
downstream edit or unrelated code change was made. This is implementation-time
verification, not an independent H1b audit.

## API and ownership

WydClient is now **0.1.0-alpha.2**; WydSUB remains **0.1** and Wydgine/platform
remains **0.3.0-alpha.7**. Existing alpha.1 artifacts are unchanged. The document
still auto-initializes exactly one `WydClientPage` in body with its original
`ready()` result shape and logical destinations. H0 canonical validators, registry
semantics, publisher signatures and property export filtering remain authoritative.

`WydClient.mount({root, policy?, page?, properties?})` starts an independent
environment and synchronously returns a frozen `ready()`/`state`/`unmount()` handle.
Root identity is the actual HTMLElement, tracked by a private WeakMap; same-root
concurrent calls share the first handle/policy and readiness promise. New roots
and remounts receive unique local Page IDs and context-qualified Top/Bottom
descriptors; no HTML IDs, cross-root Wydgit relationships or mutable registry
surfaces are used. Public snapshots contain no DOM, trust configuration, private
properties or executable handles.

Each container reads only direct-child inline `data-wydgit-manifest` JSON or a
direct-child manifest link, with one authoritative source per root. Predeclared
`data-wydgit-root` and privately registered roots exclude embedded configuration
from document discovery. Mark intended roots before automatic document bootstrap;
registration does not retroactively change completed discovery. Arbitrary nested
descendants are not manifest sources. A parent never adopts another registered
root's declarations. Per-root policies/properties are copied; document, parent and
sibling publisher keys, exact bindings, origin allowlists and registries are never
merged. All existing network/size/signature/executable-behavior restrictions apply.

Nested roots have independent lifecycles in both mounting orders. Removing outer
regions leaves inner Page and regions active; removing inner leaves outer active.
Unmount synchronously aborts pending fetch and DOM-ready waiting, settles disposed
readiness, releases ownership/private state and removes only its own region
wrappers, preserving host nodes. Late fetch/cryptographic results cannot activate
the disposed root or its replacement. Already returned bootstrap JSON remains a
historical snapshot; it grants no authority. No observer follows later host DOM
relocation. Detached roots require host cleanup/reconnection before remount.

## Barney findings

- **P3-1:** `network.js` now checks that native error codes are strings before
  prefix matching. `new DOMException('secret','AbortError')` normalizes to
  `NETWORK.FAILED`, with no secondary TypeError or leaked message.
- **P3-2:** the README distinguishes signed external **prototype packages** from
  unsigned manifest-authored declarations, whether inline or fetched. Namespace
  claims alone cannot authenticate friendship or grant SEAM authority.
- **P3-3:** the historical H1 verification identifies `c0e0f934…` as the pre-H1
  implementation baseline and `bb7e771d…` as the later committed/reviewed revision,
  keeping implementation checks distinct from independent audit results.

## Exact changed files

Modified:

```text
CHANGELOG.md
docs/milestones/0.3-H1/verification.md
docs/wydclient.md
package-lock.json
packages/wydclient/README.md
packages/wydclient/browser-smoke.js
packages/wydclient/dist/sizes.json
packages/wydclient/examples/default.html
packages/wydclient/examples/external.html
packages/wydclient/examples/index.html
packages/wydclient/examples/signed.html
packages/wydclient/package.json
packages/wydclient/src/network.js
packages/wydclient/src/packages.js
packages/wydclient/src/runtime.js
packages/wydclient/test/bootstrap.test.js
packages/wydclient/test/bundle.test.js
```

Created:

```text
docs/milestones/0.3-H1b/verification.md
packages/wydclient/dist/wydgit-client-0.1.0-alpha.2.js
packages/wydclient/dist/wydgit-client-0.1.0-alpha.2.min.js
packages/wydclient/examples/embedded-lifecycle-fixture.js
packages/wydclient/examples/embedded-sam-manifest.json
packages/wydclient/examples/embedded.html
packages/wydclient/examples/embedded.js
packages/wydclient/test/embedded.test.js
```

No Wydgine, SEAM, H0 registry or canonical-library implementation files changed.
No dependencies were added. The existing esbuild build and global singleton are
reused. The version-pinned signed package/public-key fixture is unchanged.

## Verification

- `npm run test:client`: **44 passed, 0 failed** — 22 retained H1 tests plus 22
  embedded/network/isolation/lifecycle regressions. Both standalone bundle forms
  still work without imports or runtime npm dependencies.
- `node --test --test-isolation=none test/oop-contract.test.js test/canonical-services.test.js`:
  **27 passed, 0 failed**.
- `npm test`: **556 reported passes, 0 failures**, including the H0 and existing
  canonical-library/security/regression suite.
- `npm run check`: **3 complete pages, 42 internal links**, unique anchors.
- `node packages/wydclient/browser-smoke.js`: **12/12 passed** with Google Chrome
  **155.0.8059.39**. Ten preserved H1 cases plus an embedded inline/external profile
  example and a real-browser nested/unmount/remount/cancellation/signed-trust
  fixture. The fixture performs seven explicit identity, lifecycle and isolation
  assertions in addition to preserved host/document bootstrap checks.
- `npm run build:client`: produced readable/minified alpha.2 artifacts and size
  metadata. No alpha.1 artifact modifications.
- `npm pack --workspace @wydgit/client --dry-run --json --ignore-scripts`: package
  contains versioned bundles, static examples and docs, with no runtime dependencies.
- `git diff --check`: clean; final status/stat/diff inspected. New files remain
  untracked and tracked changes unstaged for review.

Bundle: **36,199 bytes minified**, **12,649 bytes gzip**, **11,258 bytes Brotli**;
readable output **58,369 bytes**. Shared H0 validation still exceeds the original
8–15 KB design budget. H1b adds 2,670 raw minified bytes over alpha.1.

## Limitations and deferrals

Local HTTP/browser tests need unsandboxed socket/browser permissions in this
environment. Actual Chrome and Happy DOM were used; Safari, Firefox, live CDN and
native runtime compatibility are not claimed. Root boundaries do not isolate
malicious same-realm JavaScript. Hosts must independently authenticate publisher
key bindings; signatures establish origin, not execution authority. Signed loading
requires native Ed25519 Web Crypto in a secure context and fails closed otherwise.
Shadow roots, foreign documents and detached initial mounts are explicitly rejected.

No H1b blocking issue remains. H2/H3 instance construction, placement operations,
general rendering, lifecycle of executable objects, scoped SEAM execution bindings,
SEWN/WydBASIC execution, persistence, remote services, profile builders, social/host
infrastructure, publisher enrollment/lifecycle and stronger executable isolation
remain deferred. Future execution must validate a live context independently of
these historical JSON snapshots and HTML containment. H1b development stops here.
