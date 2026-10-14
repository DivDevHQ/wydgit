# WBasic / SEWN 1.0 — Language Stabilization and Developer Experience Audit

**Repository:** `DivDevHQ/wydgit`  
**Branch:** `develop/0.3`  
**Proposed repository path:** `docs/wbasic-1.0-stabilization-audit.md`  
**Status:** Requirements — Audit Authorized; 1.0 Release Not Authorized  
**Baseline:** SEWN 0.18, commit `227decbc8cf3d4ebf1299d469c4369be46e7e8a3`  
**Next platform priority:** Wydgit 0.3-H2 / WydClient rollout

## 1. Mission

Conduct a comprehensive stabilization and developer-experience audit of WBasic and the SEWN execution environment following completion of the planned 0.10–0.18 language milestones.

Determine whether WBasic is ready for a **1.0 language contract**, identify remaining blockers, verify the security and portability of its implementation, and establish objective criteria for declaring the language stable.

This is primarily an **assessment, conformance, documentation, and release-readiness milestone**, not another language-feature expansion.

The audit must answer:

1. Is WBasic complete enough for ordinary application development?
2. Are its language rules internally consistent?
3. Can independent developers learn and use it successfully?
4. Does compiled SEWN behave consistently across supported runtimes?
5. Can untrusted applications execute without bypassing SEAM?
6. Are public contracts sufficiently stable to support a 1.0 compatibility promise?
7. What must be fixed before declaring 1.0?
8. What can safely remain deferred?

**Do not declare, tag, publish, or version-bump WBasic 1.0 as part of this audit.**

The final deliverable is an evidence-backed release-readiness recommendation.

---

## 2. Scope and preparation

Before beginning:

1. Verify `develop/0.3` and inspect the working tree.
2. Read `docs/wbasic-language-ref.md` completely.
3. Read `docs/sewn.md`.
4. Read milestone documents 0.1–0.18, emphasizing implemented behavior rather than earlier proposals.
5. Read the static Wydgit, package-distribution, CLI, and applicable security architecture specifications.
6. Inspect compiler/parser, validator, executor, linker, type system, and prototype/reference handling.
7. Inspect WydClient integration and existing portability tests.
8. Review the current test suite and coverage structure.
9. Review the published Guestbook compatibility baseline.
10. Review the archived Guestbook and Taskboard source baselines.
11. Review existing application development examples and installation workflows.

Use the implementation and passing tests to verify documented claims.

Do not assume that a feature is implemented merely because it appears in a future-state language reference.

### Work authorization

Cooter may autonomously:

- Perform read-only architectural and code analysis.
- Run repository tests and existing validation commands.
- Write audit documentation.
- Add missing conformance tests and fixtures.
- Correct misleading or obsolete documentation.
- Fix small, unambiguous defects necessary to establish the audit baseline.

Cooter must not independently undertake a substantial language redesign, breaking change, package-system overhaul, or new product feature.

Record larger findings as remediation proposals.

---

## 3. Audit structure

The audit shall contain seven independent tracks.

| Track | Scope |
|---|---|
| A | Language completeness and consistency |
| B | Compiler, SEWN and runtime conformance |
| C | Object model, libraries and interfaces |
| D | Security and resource isolation |
| E | WydClient portability and deployment |
| F | Developer experience and documentation |
| G | Compatibility and 1.0 release policy |

Each track must produce:

- Findings.
- Supporting evidence.
- Severity classification.
- Recommended action.
- Release-blocking status.
- Ownership or affected subsystem.
- Verification requirements.

An assertion without supporting evidence should be labeled unverified.

---

# Track A — Language completeness and consistency

## 4. BASIC developer expectations

Assess whether a developer familiar with mainstream BASIC-family languages can implement ordinary application logic without repeatedly encountering missing foundational constructs.

Review at least:

- Variable declarations, assignments and constants.
- Strongly checked types and explicit conversions.
- Integer and floating-point arithmetic.
- Boolean expressions and logical operators.
- String manipulation.
- Arrays and collections.
- Conditional statements.
- `SELECT CASE`.
- Numeric `FOR/NEXT`.
- `FOR EACH`.
- `DO WHILE` and `DO UNTIL`.
- Loop exits.
- Functions and subroutines.
- Parameters and return values.
- Exception handling.
- Date/time operations.
- Regular expressions.
- Static libraries.
- Object construction and methods.
- Prototype inheritance.
- Interfaces and casting.
- API and service interactions.
- Data access through approved Wydgit services.

### Gap classification

For each missing or limited feature, determine whether it is:

1. **Essential:** Ordinary application development is significantly impaired.
2. **Important:** A common task is unnecessarily difficult.
3. **Convenience:** A reusable library or helper could address the limitation.
4. **Optional:** Reasonably deferred beyond 1.0.
5. **Intentionally prohibited:** Incompatible with Wydgit's security architecture.

Not every familiar BASIC feature belongs in WBasic.

For example, unrestricted file access, arbitrary DLL invocation, and uncontrolled dynamic evaluation are not required for 1.0.

### Required outcome

Produce a gap matrix explaining which missing capabilities genuinely obstruct application development.

Do not recommend a feature merely because it exists in Visual Basic or another language.

---

## 5. Semantic consistency

Audit the consistency of:

- Type declarations.
- Initialization requirements.
- Scope and lifetime.
- Constants and mutation.
- Type conversions.
- Numeric overflow and precision.
- Null handling.
- Reference identity.
- Array indexing.
- Collection equality.
- Expression evaluation order.
- Short-circuit evaluation.
- Error propagation.
- Function argument validation.
- Procedure return contracts.
- Loop termination.
- Date/time interpretation.
- String and Unicode behavior.

Pay particular attention to inconsistent behavior introduced by the incremental milestone sequence.

### Examples

Confirm that:

- `Length()` behaves consistently for supported Strings and Arrays.
- Canonical `Convert()` and compatibility `CStr()` / `Val()` differences are explicit.
- Scalar, DateTime, and DataType contracts are not accidentally interchangeable.
- Interface-typed references preserve object identity.
- Static libraries follow the same type and execution rules as local procedures.
- All supported loop constructs obey the shared resource model.
- Parsing and formatting semantics are independent of host locale.

Document intentional differences and eliminate accidental inconsistencies.

---

# Track B — Compiler and execution conformance

## 6. Compiler validation

Review:

- Lexical analysis.
- Parsing.
- Symbol resolution.
- Scope management.
- Type checking.
- Function and method resolution.
- Interface conformance.
- Static library linking.
- Dependency version locking.
- Diagnostic accuracy.
- Malformed source rejection.

### Required tests

Include positive and negative source examples.

Invalid programs should fail with controlled, useful diagnostics.

Reject malformed source before execution wherever possible.

Do not silently accept unsupported syntax.

---

## 7. SEWN validation

Audit the closed-schema validation model.

Verify:

- Valid operation schemas.
- Rejection of unknown operations.
- Rejection of unexpected fields.
- Recursive validation of nested expressions.
- Typed-value integrity.
- Reference validation.
- Library metadata validation.
- Interface metadata validation.
- Historical schema boundaries.
- Compiler-produced artifact validity.

The SEWN validator must not assume that all executable artifacts originated from the trusted WBasic compiler.

**Hostile or malformed SEWN must fail closed.**

### Compiler/runtime agreement

For supported source programs, verify that compiler lowering matches documented runtime semantics.

No operation should behave differently because it was produced through a static library rather than local source.

---

# Track C — Object model and reusable libraries

## 8. Object-oriented capabilities

Audit the practical usability of:

- Wydgit prototypes.
- Instances.
- Parent/child relationships.
- Inheritance.
- Method dispatch.
- Public/private visibility.
- Reference identity.
- Interface declarations.
- Interface implementation.
- `Implements()`.
- `Cast()`.
- Static Wydgits.
- Imported libraries.

Verify that the object model is sufficient for common component-oriented applications.

Identify missing primitives that would obstruct:

- Reusable forms.
- Databound cards.
- Lists and tables.
- Repeating templates.
- Pagination containers.
- Independent data providers.

### Important boundary

**Do not implement the planned pagination Wydgits during this audit.**

Use them as an architectural test case.

Determine whether they can be implemented cleanly using current language and runtime capabilities.

If they cannot, identify the exact missing platform primitives.

Distinguish missing language capability from missing Wydgit framework/library functionality.

---

## 9. Library and dependency behavior

Verify that independently developed static Wydgits can:

- Declare public and private procedures.
- Resolve explicit imports.
- Use approved dependencies.
- Link required procedures.
- Preserve exact version identity.
- Execute under caller authority.
- Share resource budgets.
- Operate in supported server/browser contexts.

Confirm that the standard `divdev/wbasic` compatibility library does not depend on hidden compiler privileges beyond documented legacy behavior.

A future Wython or Wuby compiler should be able to target the same canonical SEWN library contracts.

---

# Track D — Security and resource isolation

## 10. Adversarial execution

Review all resource-sensitive operations:

- Infinite and deeply nested loops.
- Recursive procedures.
- Large arrays.
- String expansion.
- Regular expressions.
- Numeric edge cases.
- Date/time calculations.
- Static library calls.
- Interface dispatch.
- Object construction.
- Service invocation.

Verify that operations respect shared resource limits.

Do not consider an operation safe merely because normal tests execute quickly.

### Required properties

- No uncontrolled recursion.
- No unbounded iteration.
- No unrestricted native regex backtracking.
- No uncontrolled memory growth through supported operations.
- No arbitrary host-code execution.
- No hidden resource-budget resets.
- No recoverable budget exception allowing infinite retries.
- No bypass of service permissions through libraries.
- No arbitrary cross-site data access.
- No forged privileged object references.

Existing security tests must remain passing.

Add tests for meaningful untested boundaries discovered during review.

---

## 11. SEAM capability boundaries

Verify that:

- A Wydgit cannot claim capabilities through package metadata alone.
- An interface does not grant capabilities.
- A cast does not elevate authority.
- Static libraries execute under caller restrictions.
- Public method visibility does not override SEAM policy.
- Browser-side execution cannot authorize protected server-side operations.
- References cannot bypass invocation lifetime or publisher boundaries.
- Trusted service access is mediated through approved interfaces.

The audit must evaluate actual enforcement paths, not merely documented policy.

---

# Track E — WydClient portability

## 12. Server/browser equivalence

Determine whether the same validated SEWN artifact produces equivalent results under Wydgine and WydClient for supported portable operations.

Audit:

- Numeric behavior.
- Strings and UTF-16 indexing.
- Arrays.
- Typed values.
- DateTime.
- Regular expressions.
- Procedures.
- Loops.
- Static libraries.
- Interfaces.
- References.
- Errors.
- Resource budgets.

Environment-dependent operations must explicitly declare their context requirements.

### Portability classification

Classify operations as:

- **Portable:** Identical documented semantics across supported runtimes.
- **Contextual:** Requires explicit host capabilities or inputs.
- **Server-only:** Intentionally unavailable in WydClient.
- **Client-only:** Intentionally unavailable in Wydgine.
- **Unsupported:** Not part of the current contract.

Do not claim universal portability for contextual or unsupported features.

---

## 13. Client footprint

Measure the WydClient execution footprint.

Include:

- Bootstrap minified size.
- Bootstrap gzip size.
- Bootstrap Brotli size.
- Event-runtime minified size.
- Event-runtime gzip size.
- Event-runtime Brotli size.
- Relevant optional dependencies.

Identify unnecessary compiler, resolver, package-management, or server-only code present in browser artifacts.

### Objective

WydClient must remain a deliberately constrained execution environment.

The compiler and package-building tools belong outside the browser runtime.

Do not introduce speculative bundle optimizations that risk regressions.

Record significant opportunities for the forthcoming 0.3-H2 rollout.

---

# Track F — Developer experience

## 14. Documentation audit

Evaluate documentation as though the reader has never participated in Wydgit's development.

The documentation must explain:

1. What WBasic is.
2. How WBasic relates to SEWN and SEAM.
3. How to declare variables and types.
4. How to write functions and subroutines.
5. How to control program flow.
6. How to work with Strings and Arrays.
7. How to handle errors.
8. How to use Wydgit objects and interfaces.
9. How to import static libraries.
10. How to access approved data and services.
11. How to create and install a Wydgit.
12. How to diagnose compilation and runtime errors.

### Required documentation artifacts

Review or create, as necessary:

- Language reference.
- Concise getting-started guide.
- Feature and syntax quick reference.
- Canonical operations reference.
- Wydgit object-model examples.
- Static-library example.
- Common errors and diagnostics guide.
- Minimal working application example.
- Supported/deferred capability matrix.

Avoid duplicating contradictory language definitions across documents.

Each implemented feature should have an authoritative reference and at least one executable or tested example.

---

## 15. Developer task audit

Evaluate common tasks:

- Validate form input.
- Transform text.
- Iterate through records.
- Filter and sort data using approved services.
- Render databound content.
- Process user actions.
- Call approved APIs.
- Handle expected failures.
- Share code through a library.
- Implement a reusable component.
- Use an interface-based provider.
- Produce paginated output.

Identify unnecessary steps, confusing APIs, unclear examples, and missing diagnostics.

The audit should distinguish:

**Language deficiencies:** The language cannot express the required logic cleanly.

**Platform deficiencies:** Required runtime, data, or component functionality is unavailable.

**Documentation deficiencies:** Existing functionality is insufficiently explained.

**Tooling deficiencies:** Compilation, debugging, inspection, or testing is unnecessarily difficult.

**Application defects:** The developer used available functionality incorrectly.

These categories must not be collapsed into a generic "developer error."

---

## 16. The Goober Test — Independent Taskboard benchmark

The original Taskboard experiment required approximately three attempts to produce an installable Wydgit, followed by nineteen additional iterations to achieve working pagination.

That experiment motivated improvements to the language and developer experience.

Use it as a case study and, when practical, as the basis for a controlled follow-up benchmark.

### Benchmark goal

Determine whether the improved WBasic language and documentation make ordinary application development substantially easier.

### Clean-room conditions

The benchmark developer should receive:

- Current public documentation.
- An ordinary development environment.
- A clean Taskboard requirement.
- Standard Wydgit build/install tools.
- No privileged implementation knowledge.
- No access to solutions from the earlier Taskboard attempts.
- No undocumented workarounds.

### Required functionality

The application should:

1. Install successfully.
2. Display records.
3. Support authorized record retrieval.
4. Paginate records correctly.
5. Handle empty datasets.
6. Handle first and last pages.
7. Maintain stable ordering.
8. Respect data-access restrictions.
9. Handle invalid page requests.
10. Work across its supported execution contexts.

### Measurements

Record:

- Attempts to achieve installation.
- Attempts to achieve working pagination.
- Compiler errors encountered.
- Runtime errors encountered.
- Documentation lookups.
- Undocumented assumptions.
- Platform limitations.
- Developer mistakes.
- Workarounds introduced.
- Final source complexity.
- Test results.

### Benchmark interpretation

Do not claim success solely because the new attempt takes fewer iterations.

Compare task complexity, tool availability, documentation quality, and developer assistance.

The historical experiment is a useful qualitative baseline, not a controlled scientific experiment.

### Timing

**Do not launch a new full Taskboard implementation or begin building the pagination library as part of this audit unless a ready-to-run isolated benchmark already exists.**

If the clean-room benchmark would delay 0.3-H2, deliver a complete repeatable benchmark plan and fixtures instead.

The benchmark can be executed during a later developer-experience validation phase.

---

# Track G — Compatibility and release policy

## 17. Historical compatibility

Review current backward compatibility against the project's established alpha policy.

Prioritize:

- Published Wydgit 0.2.0-alpha.18 behavior.
- Guestbook installation and persistence.
- Archived Taskboard source compatibility.
- Existing package workflows.
- Current SEAM rules.
- Already published artifact expectations.

Do not promise indefinite runtime support for every historical SEWN intermediate wire schema.

A legitimate migration strategy may transform older artifacts at build or installation time.

Such migration must preserve supported semantics and fail clearly when migration is impossible.

Do not silently relabel incompatible artifacts.

---

## 18. WBasic 1.0 compatibility commitment

Propose a formal post-1.0 compatibility policy.

The policy must distinguish:

1. WBasic source-language compatibility.
2. Canonical SEWN wire-schema compatibility.
3. Static-library API compatibility.
4. Wydgit package/prototype compatibility.
5. WydClient runtime compatibility.
6. Security-policy compatibility.

These are related but not identical.

**WBasic 1.0 must not imply that every future Wydgit package or SEWN wire format is forever immutable.**

Define which interfaces are stable, what constitutes a breaking change, and how supported migrations are communicated.

Consider semantic versioning for the language contract, while preserving separately versioned platform and client releases.

---

## 19. Release blockers and severity

Every finding must receive a severity.

| Severity | Definition | 1.0 impact |
|---|---|---|
| **P0 — Critical** | Security bypass, corruption, unbounded execution, serious trust failure | Blocks release |
| **P1 — Major** | Fundamental language defect, serious portability failure, unusable essential functionality | Blocks release |
| **P2 — Moderate** | Important usability or documentation problem with a reasonable workaround | Review individually |
| **P3 — Minor** | Cosmetic issue, convenience improvement, nonessential feature | Does not block |
| **Deferred** | Explicitly excluded capability with a documented boundary | Does not block if accurately represented |

A missing feature is not automatically a release blocker.

A documented unsupported feature may be acceptable.

An implemented feature that silently violates its contract is substantially more concerning.

### Requirements for declaring readiness

A 1.0-ready recommendation requires:

- Zero known open P0 defects.
- Zero known open P1 defects.
- Passing required regression and security suites.
- No unexplained critical server/browser conformance failures.
- Published and internally consistent language contracts.
- Documented compatibility policy.
- Usable getting-started and developer documentation.
- Clear enumeration of limitations.
- Repeatable build and verification procedures.
- No unresolved ambiguity about supported runtime behavior.

P2 findings must have explicit disposition and rationale.

---

## 20. Release gates

Use the following checklist in the final assessment.

| Gate | Required evidence |
|---|---|
| **G1 — Language** | Completeness matrix and documented intentional omissions |
| **G2 — Semantics** | Conformance tests for fundamental language contracts |
| **G3 — Compiler** | Positive/negative source tests and controlled diagnostics |
| **G4 — SEWN** | Closed-schema validation, malformed-input tests |
| **G5 — Security** | SEAM and resource-boundary regression results |
| **G6 — Portability** | Server/browser conformance and context matrix |
| **G7 — Compatibility** | Guestbook/Taskboard and published baseline verification |
| **G8 — Libraries** | Static-library and interface conformance |
| **G9 — Developer experience** | Documentation review and repeatable application benchmark |
| **G10 — Release policy** | Versioning, compatibility and migration recommendations |

Each gate must be marked:

- Pass.
- Pass with documented limitations.
- Fail.
- Not verified.

Do not translate "not verified" into "pass."

---

## 21. Audit deliverables

Create:

`docs/audits/wbasic-1.0-readiness.md`

Include:

1. Executive summary.
2. Audit baseline and inspected revisions.
3. Release-gate scorecard.
4. Findings by audit track.
5. Confirmed strengths.
6. Known implementation gaps.
7. Documentation gaps.
8. Security and portability findings.
9. Compatibility assessment.
10. Test evidence.
11. Proposed 1.0 compatibility policy.
12. Final readiness recommendation.

Also create:

`docs/audits/wbasic-1.0-findings.md`

Include a prioritized table with:

- Finding ID.
- Severity.
- Category.
- Affected subsystem.
- Reproduction or supporting evidence.
- Recommended remediation.
- Blocking status.
- Verification criteria.

And:

`docs/audits/wbasic-developer-experience.md`

Include:

- Developer workflow evaluation.
- Documentation findings.
- Taskboard/Goober case-study analysis.
- Proposed clean-room benchmark.
- Recommended examples and tooling improvements.

If necessary, update the authoritative language reference to distinguish implemented behavior from deferred functionality.

### Avoid duplicate sources of truth

Audit documents should link to the canonical language and platform specifications.

Do not create another competing language grammar.

---

## 22. Remediation policy

Cooter may fix minor, self-contained defects discovered during the audit when:

- The expected behavior is already specified.
- The change is backward compatible.
- The fix does not broaden language scope.
- The associated regression test is included.
- The change can be verified independently.

Examples include a missing validation check, incorrect diagnostic, or documentation example that does not compile.

### Do not autonomously implement

- New fundamental language constructs.
- Major object-model changes.
- New package systems.
- New canonical services.
- Large dependency changes.
- Breaking wire-format changes.
- A new application builder.
- Pagination component libraries.
- Named-timezone infrastructure.
- Generalized persistence models.

Document such findings and recommend a separate milestone if genuinely necessary.

**The audit should not become SEWN 0.19 by accident.**

---

## 23. Relationship to Wydgit 0.3-H2

The WBasic audit is intentionally separate from the Wydgit platform's next delivery milestone.

**The next planned implementation priority is Wydgit 0.3-H2 and the WydClient rollout.**

The audit must not postpone that work indefinitely.

### Handoff requirements

Produce a concise handoff describing:

- Confirmed WBasic/SEWN capabilities available to WydClient.
- Remaining client-portability concerns.
- Known runtime or packaging risks affecting 0.3-H2.
- Browser-bundle optimization opportunities.
- Developer-documentation requirements relevant to rollout.
- Any P0/P1 findings that directly threaten 0.3-H2.

Separate language-release blockers from platform-rollout blockers.

A language feature need not receive a 1.0 stability declaration before it can be used in an appropriately labeled alpha WydClient rollout, provided its actual contracts and risks are understood.

Do not silently merge the language 1.0 release schedule with the platform 0.3 release schedule.

---

## 24. Execution sequence

Perform the work in this order:

**Phase 1 — Baseline verification**

Inspect architecture, documentation, tests, and current implementation.

**Phase 2 — Language and conformance audit**

Assess implemented syntax, semantics, runtime, and security.

**Phase 3 — Developer-experience audit**

Evaluate documentation, common workflows, and Taskboard lessons.

**Phase 4 — Compatibility and release gates**

Produce readiness matrix and release policy.

**Phase 5 — Limited remediation**

Fix only approved-in-scope small defects and add missing regression coverage.

**Phase 6 — Final verification**

Rerun tests and confirm findings reflect the final audited revision.

**Phase 7 — Documentation and handoff**

Deliver the three audit documents and the 0.3-H2 handoff summary.

Do not wait for a full clean-room Taskboard rebuild if doing so would prevent completing the audit.

---

## 25. Final verification

Before completing:

1. Confirm correct branch and revision.
2. Run the full applicable repository test suite.
3. Run `npm run check`.
4. Run relevant server/browser conformance tests.
5. Verify SEAM security regressions.
6. Verify resource-limit tests.
7. Verify Guestbook installation/HTTP/persistence.
8. Verify archived Guestbook and Taskboard compilation baselines.
9. Inspect any new tests and documentation changes.
10. Inspect the final diff.
11. Confirm the resulting working-tree status.

Record actual test results, not assumptions based on prior milestone reports.

Do not alter the platform or package versions.

---

## 26. Commit and delivery

Commit completed audit documentation and any permitted minor fixes to `develop/0.3`.

Suggested commit:

```bash
git add docs/audits/ docs/wbasic-language-ref.md
git commit -m "docs: Audit WBasic 1.0 readiness and developer experience"
git push origin develop/0.3
```

Stage only files actually changed by the audit, including associated tests or fixes where applicable.

If no language-reference changes are needed, omit that path.

Do not create a tag, release, pull request, merge, or version bump.

### Final report

Report:

- Commit SHA and branch.
- Overall readiness assessment.
- Number of findings by severity.
- Release-gate status.
- Tests executed and results.
- Major language gaps.
- Major developer-experience gaps.
- Security findings.
- WydClient portability concerns.
- Recommended pre-1.0 remediation.
- Deferred features.
- What can proceed immediately in Wydgit 0.3-H2.

Explicitly state:

**"WBasic 1.0 has not been declared or released. This audit establishes the requirements and evidence for that decision."**

---

## 27. Definition of done

The audit is complete when:

1. All seven tracks have been assessed.
2. Each release gate has a documented status.
3. Major claims have supporting evidence.
4. Findings are severity-ranked.
5. Known gaps are categorized correctly.
6. Security and conformance checks have been run.
7. Historical compatibility has been assessed.
8. Developer workflows have been reviewed.
9. The Goober/Taskboard benchmark has a repeatable plan.
10. Language 1.0 compatibility recommendations are documented.
11. Any small remediation is covered by tests.
12. Audit documentation is committed and pushed.
13. No unauthorized 1.0 release action has occurred.
14. Wydgit 0.3-H2 has a clear next-step handoff.

### Architectural objective

WBasic 1.0 should signify more than a completed feature checklist.

It should mean that independently developed Wydgits can rely on a coherent, documented, portable, security-enforced programming-language contract.

**A stable language is one that developers can trust—not merely one that has stopped changing.**

**Audit it. Document it. Fix what's necessary. Then get back to shipping Wydgit.**

**KISS. KICK. KICK ASS.**
