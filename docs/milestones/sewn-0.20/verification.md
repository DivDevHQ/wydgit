# 0.20 checkpoint verification

**Milestone incomplete.** This report covers source family composition and server
presentation only. Starting HEAD was `127f9199355bba898aec799063024f839367f958` on
`develop/0.3`, with a clean tree; fetched origin matched. Required baseline `npm test`
passed 707/707; content check passed; Chrome baseline passed 14/14.

## Evidence matrix

“Existing” identifies retained 0.19/H2 behavior, not new executable support.
“Rejected” means an explicit unsupported-target/source failure. “Missing” means
not implemented. Composition is through the package's complete instance template,
not arbitrary NEW or a runtime symbolic-child resolver.

| Capability | Compiles | Validates | Server executes | Browser executes |
| --- | --- | --- | --- | --- |
| Complete class metadata | Existing | Existing | Existing methods | H2 executable classes rejected |
| Child composition | Yes | Shared lowerer + whole family + installer/hydration | Installed canonical tree | New source-family path unavailable |
| Presentation | SERVER syntax | Existing presentation + public bindings | Escaped scalar templates | Client target rejected |
| Property bindings | Scalar one-way reads | Public/discoverable/type checks | Reevaluated on explicit render | Rejected |
| Reusable templates | Package entry template only | Complete canonical tree | Installed tree only | New source-family path unavailable |
| Dynamic bounded child repetition | Missing | Missing | Missing | Missing |
| Literal scalar presentation repetition | Yes, LIMIT 256 | Homogeneous literal scalar arrays | Existing bounded each | Rejected |
| Custom event emission | Declarations only; emission rejected | Existing declared types | Missing | Missing |
| Child event subscriptions | Missing | Missing | Missing | Missing |
| App/Server/Session/Page class bindings | Missing | Existing host dispatcher only | No new class integration | Missing |
| Init / Preload / Render | Existing isolated hook modules | Existing | No automatic controller | Missing |
| Unload / Dispose | Existing isolated hook modules | Existing | No automatic controller | H2 host cleanup only |
| Complete Taskboard family | Missing | Missing | Missing | Missing |

## Tests and security

Seven new family conformance groups cover deterministic dependency order and exact
canonical resources, retained 0.19 result shape, complete-tree hydration, ordered
children, independently authored JSON/SEWN golden equivalence and actual compiled
method execution followed by rendering. A real temporary-package planner/apply/
reload test verifies that stored artifacts continue working without package source.

Negative cases cover publisher approval, foreign/unknown children, bad slots/types/
initializers, duplicate names/IDs, dependency/composition cycles, inherited child
collisions, missing minimum cardinality, global expansion bounds, private/hidden/
capability-restricted bindings, unknown/exact property resolution, unsupported
browser target, script/style/event attributes, invalid scalar conversion and absent
repeat limits. The shared lowerer receives manually mutated IR independently of the
source parser. No historical tests were removed or weakened.

There is no new runtime event/callback/service/construction execution path. Existing
SEWN method budgets, presentation each/expression/output bounds and package limits
remain unchanged. Family expansion is bounded before returning output; no partially
accepted result or filesystem write is made by compilation. Host filesystem staging
is outside the pure compiler API. Build-assigned child identities confer no authority.

## Final checks

Final full-suite and Chrome results are recorded below after execution. Platform
0.3.0-alpha.7, WydClient alpha.4, WydSUB 0.1, manifests and lockfile versions remain
unchanged. New build IR is wydgit.definition/0.20; executable wire remains existing
SEWN versions, and presentation remains wydgit.presentation/0.1. No browser source,
shared browser validation module or versioned artifact is modified.

No complete Taskboard acceptance, typed class emitter, shared event-chain budget,
instance lifecycle controller, runtime child resolver or dynamic typed template
fixture exists. These are unfinished required 0.20 work, not passing gates and not
work that may all be deferred to WydClient H3. Firefox/Safari/native targets and
remote deployments are unverified.

Executed checkpoint checks:

- Focused retained class + new family suite: **20 passed, 0 failed**.
- Full `npm test`: **714 passed, 0 failed, 0 skipped/cancelled/todo**. Includes
  guarded reproducible alpha.4 build, historical artifact checks, WBasic/SEWN/OOP/
  interface/static-library/SEAM/event/presentation/package regressions, current
  Guestbook and archived Guestbook/Taskboard source compatibility.
- `npm run check`: **3 complete pages, 42 internal links**, unique anchors.
- Chrome alpha.4 baseline and final runs: **14/14 passed each** against the
  unchanged artifact; these remain H2 tests, not new class execution.
- `git diff --check`: clean. Tracked/new code, fixtures, docs and final status/stat/
  full diff reviewed. No versioned distribution change appears in the diff.

Tests requiring Git history, sockets and Chrome used authorized outside-sandbox
execution. Baseline fetch initially failed on sandbox-protected FETCH_HEAD; the
approved fetch succeeded. This was an environment restriction, not a source defect.
No dependency/version/lockfile bump, release, tag, main merge or deployment.
The checkpoint commit and final clean-tree status are reported in the handoff.
