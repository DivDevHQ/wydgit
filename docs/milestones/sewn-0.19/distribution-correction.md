# WydClient alpha.4 — immutable distribution correction

Correction baseline: `bb0af8ecfacfabfbd5dbd3969695752ea4c847c7`, branch `develop/0.3`.
The tree started clean. This is an authorized follow-up to the initial 0.19 delivery,
not a new WydClient feature milestone or public release.

## Policy and corrected identity

The WydClient README requires immutable versioned filenames and explicitly pinned
upgrades. Founding architecture section 19 independently versions WydClient.
No applicable policy reserves new implementation versions for dedicated milestones.
The 0.19 commit changed shared prototype-validation code embedded in alpha.3 while
retaining its filename. This was a functional distribution change, not a harmless
rebuild. The original verification report now links here and labels its measurements
as the superseded initial delivery.

The original H2 alpha.3 readable/minified bytes are restored from
`15905895489e8db54cf3620d0d1ce1c0b5570fc1`. Direct Buffer equality tests compare
both files to Git blobs on every repository test run. The original H2 `sizes.json`
is preserved byte-for-byte as `dist/sizes-0.1.0-alpha.3.json`. The unversioned
`dist/sizes.json` now describes alpha.4; `sizes-0.1.0-alpha.4.json` archives that
current report. Alpha.1 and alpha.2 bytes remain unchanged.

Package metadata, workspace lock metadata, runtime VERSION, README deployment
snippets, all seven current HTML examples and the Chrome fixture loader now identify
**0.1.0-alpha.4**. The bundle test asserts current example paths and package/report
consistency. Historical H2 documentation keeps its alpha.3 identity and explicitly
points to current alpha.4 examples. Wydgine stays 0.3.0-alpha.7; WydSUB stays 0.1.
No tag, release, package publication or deployment is performed.

## Byte evidence

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| alpha.3 readable | 93473 | `30696ee5d1d1791364d340174a72715e4e67ab667396766b63cf34562f013914` |
| alpha.3 minified | 56947 | `d79c62b146e1842f4ac6e7cd5617795fc81495fa32f1f14257950b33738c7512` |
| alpha.3 size snapshot | 132 | `e9a639002583ae0cdb72697474bb80b92a3898fd4526663ca0f6b68fab1cdd9f` |
| alpha.4 readable | 100815 | `a4641e2cffc28a79329e07058cb283a19489441aa10b48802b859e6b2e7b4a6c` |
| alpha.4 minified | 61977 | `60d70193d74516a2727a88734b1edab04a46fd88208f3400257ce5aff29c8aca` |
| alpha.4 size snapshot | 133 | `aad8c15fb552121b91fa0abed6dbc08d35cf39feba76dc9c7d84607376e71e96` |

Alpha.3 gzip/Brotli sizes return to 19196/16848. Alpha.4 gzip/Brotli are 20511/17999.
Replacing only the alpha.4 version string with alpha.3 makes each new bundle
byte-identical to the corresponding intended 0.19 bundle at `bb0af8e`. This
comparison verifies that packaging the validation update introduced no additional
runtime implementation changes. The historical bad alpha.3 rebuild is not used
as the canonical alpha.3 baseline.

## Functional verification

A browser-bundle regression runs both readable and minified historical/current
artifacts in independent Happy DOM windows. A deliberately inert Page prototype
attempts to expose a linked static helper as an instance method. Restored alpha.3
retains its H2 acceptance; alpha.4 rejects it with `PROTOTYPE.STATIC`, demonstrating
that the intended validation update is actually present. Both report their exact
implementation version. The usual bootstrap/idempotence/safety tests run on alpha.4.

Alpha.4 includes canonical class-contract validation and linked-helper isolation
through shared PrototypeRegistry code. It adds no browser source compiler, typed
custom-event delivery, automatic lifecycle execution or H3 adapter. The executable
class-definition restrictions described in the 0.19 report remain in force.

## Automated immutability regression

Repository-only `packages/wydclient/artifact-policy.js` implements the build/test
boundary. Existing legacy distributions are pinned to the approved pre-0.19 H2
snapshot above, making the authorized alpha.3 restoration explicit. Every new
versioned JS artifact or versioned size report introduced after that snapshot is
compared with its first committed Git blob, not its latest modified blob. The
check enumerates historical additions, so deleting or renaming an artifact does
not evade it. Missing/shallow history fails closed with a fetch-history diagnostic.

`build.js` builds both artifacts in memory, prepares their versioned size report,
and verifies all protected historical files and candidate outputs before writing
any distribution files. A mismatched same-version build fails with instructions
to restore the original bytes and increment the implementation version. An exact
rebuild or new version is accepted. The current unversioned size pointer remains
mutable; per-version snapshots are immutable after their first commit.

The regression suite uses isolated temporary Git repositories to prove:

- Exact bytes and identical rebuild candidates pass; mismatched candidates fail
  without altering existing files.
- Workspace changes, already committed changes and deletions of protected files fail.
- A new version can be introduced, then is pinned to its first commit even after
  later committed edits; restoring canonical bytes passes again.
- Missing reference history fails; real alpha.3 files and size metadata equal H2.

This establishes a prospective invariant from the approved restoration baseline;
it does not rewrite old Git history or claim that the earlier mistake never occurred.
Full Git history is required for repository builds/tests. Consumers still need
only the standalone artifact, with no Git or build tooling in the browser.

## Results and handoff

- Focused artifact/bundle tests: **8 passed, 0 failed**.
- Required `npm test`: **707 passed, 0 failed, 0 skipped/cancelled/todo**, including
  guarded client build, all existing compiler/runtime/security/package compatibility
  tests and the new distribution regressions.
- Required `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- Chrome 155.0.8059.79: **14/14 smoke fixtures passed**. Every case now asserts that
  it fetched the alpha.4 artifact; diagnostic cases also assert runtime version.
  All current examples run alpha.4, including both H2 construction/removal fixtures.
- Both alpha.3 files and original size report compared directly against H2 Git blobs;
  alpha.1/alpha.2 unchanged. New alpha.4 validation behavior verified in both forms.
- Repeated build reproduced alpha.4 exactly. Final status, full source/generated
  diff, metadata consistency and `git diff --check` reviewed before commit/push.

Git-history/process spawning and local HTTP/Chrome require approved outside-sandbox
execution in this environment. The first restricted client build stopped before
writing distributions because Git spawning was denied. No test was weakened or
excluded. Firefox, Safari, native targets and deployment were not exercised.

The correction commit is reported in the final handoff; this document cannot
contain its own commit SHA without changing that commit. Changes are confined to
client distribution identity/build safeguards, tests, examples, metadata and
correction documentation. 0.19 lifecycle/event runtime deferrals are unchanged.
