# WBasic / SEWN 0.17 — Interfaces and casting

Implemented on `develop/0.3`. The authoritative executable version is `sewn/0.17`.
Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2 remain unchanged, following
0.11–0.16 policy. No dependency, manifest-version or lockfile bump is required.

## Declaration and approved build context

A dedicated interface definition uses the existing prototype/package namespace:

```vb
INTERFACE ICountable
    FUNCTION Count() AS Integer
    SUB Observe(value AS String)
END INTERFACE
```

Trusted authoring calls `compileInterface(source, {id:"contracts/icountable",
publisher:"contracts", version:"1.0.0"})`. `compileDefinitions` also accepts a
prototype entry with these identity fields, `interface:true` and `behaviorSource`.
Source entries accept identity metadata only; conflicting canonical signatures or
additional implementation metadata fail. The output is a declaration-only record:

```json
{
  "id": "contracts/icountable",
  "publisher": "contracts",
  "interface": true,
  "alias": "ICountable",
  "version": "1.0.0",
  "signatures": {
    "count": { "kind": "function", "params": [], "returns": "Integer" },
    "observe": { "kind": "sub", "params": ["String"] }
  }
}
```

Method names are canonical lowercase; parameter names are authoring labels, while
order and types define the contract. Existing fundamental WBasic parameter/return
types are supported. There are at most 64 interfaces per registry, 64 methods per
interface and the existing 16 parameters per method. Interfaces cannot contain
bodies, constructors, fields, properties, inheritance, methodRules, service bindings,
capabilities or other metadata. They are nonconstructible definitions in the
ordinary PrototypeRegistry. There is no independent object registry or installer.

Publisher qualification prevents short-name impersonation. Registry construction
requires the existing host-issued `verifiedPrototypes` publisher binding for every
interface and implementing/derived prototype. Application JSON and package claims
cannot supply that binding. Existing package namespace, signed client package and
host approval boundaries remain authoritative. Directory approval alone is not
cryptographic authentication of public distribution.

Consumers compile with `{prototypeRegistry, dependencies:{"contracts/icountable":
"1.0.0"}}`. Only exactly pinned approved definitions participate in alias lookup;
missing pins, wrong versions or ambiguous aliases fail. One definition per canonical
ID is accepted per registry; duplicate or conflicting versions fail. There is no
version-range compatibility or silent newer-version substitution.

## Explicit implementation and validation

Concrete prototype metadata declares:

```json
{
  "id": "collections/counter",
  "publisher": "collections",
  "implements": { "contracts/icountable": "1.0.0" }
}
```

The example omits required method behavior. Existing public instance resolution
must find every required member. FUNCTION/SUB kind, arity, ordered parameter types
and return type must match exactly; numeric compatibility does not introduce
signature variance. Private/protected/friend/hidden methods and static methods cannot
satisfy the contract. Matching names without an explicit validated declaration do
not constitute implementation. Capability requirements remain on implementing
methods and are enforced when called; they are never interface grants.

Inherited public methods may satisfy declarations. Derived prototypes inherit
validated implementation pins, but their resolved methods are revalidated after
existing explicit override, publisher, visibility and capability checks. A derived
prototype needs its own verified publisher binding. Overrides cannot retain an
invalid trusted implementation claim.

Application package manifests optionally declare an `interfaces` map with at most
16 exact ID/version pins. Installation resolves it against approved definitions
already in the existing package/prototype context; it never downloads interfaces.
Prototype implementation claims, dependencies and compiled type descriptors must
agree with manifest pins. Canonical prototypes and compiled event sources are saved
through existing catalog/receipt/resource-hash checks. Reload uses approved stored
artifacts, without a compiler or resolver in the browser. No registry/CLI work or
new package format is introduced.

## Reference contracts and operations

```vb
DIM item AS ICountable
SET item = Cast(Me, ICountable)
IF Implements(item, ICountable) THEN
    CALL item.Observe("sample")
    RETURN item.Count()
END IF
```

Interface types work in DIM, procedure parameters, function returns and SET.
Underlying Wydgit inputs are checked and narrowed at every typed binding. Unrelated
interface assignments fail compilation. Dynamic mismatches fail SEWN.TYPE.
Uninitialized interface variables are NULL, and nullable arguments/returns and SET
NULL retain reference-nullability behavior. Explicit Cast(NULL, ...) and
Implements(NULL, ...) fail as invalid inspection operands; NULL is not a live object.

`Implements` resolves the exact trusted interface and guards the actual live bound
node before consulting validated prototype conformance. A legitimate live
nonimplementer returns FALSE. Forged data, unbound host shapes, invisible/stale,
foreign-context and invalid transaction/draft handles fail, rather than concealing
authorization violations as FALSE. No constructor or conversion runs.

`Cast` performs the same check and returns an opaque reference view of the original
handle, failing SEWN.TYPE for a live incompatible object. It does not copy, construct,
serialize, reauthorize or extend lifetime. `item IS Me` remains TRUE for the same
live object. Inspection never discloses prototype identity to application code.

A view admits only contract-declared instance methods. Property reads/writes,
facade reads, concrete extra/private methods, traversal and mutation facade calls
are denied. Passing a view into a Wydgit parameter or returning it as Wydgit preserves
the view; an ordinary assignment cannot recover an unrestricted surface. Explicit
casts to another interface require that object's independently validated declaration.

Dispatch selects the actual implementing method under ordinary inheritance and
override resolution. Its internal Me uses the original instance receiver so its
own valid helpers still work. Arguments and returns use existing procedure type
checks, and errors propagate through established boundaries. The implementing
publisher supplies no authority. SEAM service/resource checks, visibility, step,
call-depth/count, iteration, deadline and value limits remain those of the caller.

## Closed wire and browser representation

0.17 adds `implements {value,type}` and `cast {value,type}` expressions (each also
has `op`), with canonical type strings such as
`interface:contracts/icountable@1.0.0`. These exact strings also appear in procedure
parameter/return descriptors and optional declare/set `type` fields. Declare records
retain their interface contract at runtime, including when a forged set omits type;
set cannot change the contract. All grammar-owned interface types are resolved
before workflow execution, including unreachable code. Older schemas reject the
new operations/types/fields and retain their historical reserved-name grammar.

Runtime tokens use the existing invocation WeakMap with `{value,kind,view}` internal
metadata. A view records the exact interface identity alongside the original handle;
it is not a serializable handle or application object. Caller variable/type tables
are restored across procedure frames, with shared counters and deadline.

Wydgine and WydClient share validation, conformance and execution. Browser event
handles bind their existing semantic nodes to the same trusted member adapter and
invocation guard. The HTTP runtime asset allowlist includes the contract module.
The alpha.2 bootstrap accepts declaration metadata but retains its existing ban on
executable prototype bodies; executable interface calls use the portable event
runtime. Neither browser path includes the compiler, installer, package registry,
unrestricted resolution or privileged server APIs.

## Conformance and verification

`test/fixtures/interfaces` contains three independent prototype-package fixtures:
contract publisher, explicit collection implementation (including derived and
overridden implementations), and an unrelated counter with the same method name.
`test/wbasic-interfaces.test.js` tests declaration closure, exact pins, publisher
approval, signature failures, inheritance, identity, typed bindings/returns,
restricted views, hostile wire/claims, caller service permissions, consumed drafts,
foreign/stale/transaction handles, cumulative budgets, WydClient cancellation,
independently bundled browser execution and normal package install/reload.

The identical minified event harness exporting execute, PrototypeRegistry,
ExecutionContext and bindMembers measures 215,170 / 68,874 / 60,020 bytes
(minified/gzip/Brotli), versus 209,654 / 67,219 / 58,674 at pre-milestone HEAD:
+5,516 / +1,655 / +1,346 bytes. This comparison includes approved prototype metadata
support; it is a reproducible test harness, not an additional shipped asset.
Alpha.2 bootstrap minified/gzip/Brotli is 49,966 / 16,617 / 14,649 bytes,
versus 45,465 / 15,469 / 13,632 at 0.16: +4,501 / +1,148 / +1,017 bytes.
Alpha.1 distribution is unchanged.

Executed verification:

- Focused `node --test --test-isolation=none test/wbasic-interfaces.test.js`: all
  10 groups passed, including independent browser conformance and hostile inputs.
- Required `npm test -- --test-isolation=none`: 676 passed, 0 failed, including
  current Guestbook installation/HTTP/persistence, archived Guestbook/Taskboard
  compilation baselines and historical SEWN/security suites.
- Required `npm run check`: passed (3 pages, 42 internal links, unique anchors).
- `git diff --check`: clean. Source, artifact changes and measured sizes reviewed.

The initial restricted run encountered local HTTP `listen EPERM`; successful full
verification used approved unrestricted execution. The first unrestricted run found
a missing runtime asset allowlist entry and a changed client mutation-denial code;
both were fixed, with their existing regression tests preserved.

## Deliberately deferred

Interface properties are deferred: canonical stored property descriptors do not
provide method-style readable accessor/type contracts. No alternate property system
is added. Interface inheritance, interface-valued signature members inside interface
definitions, concrete casts/downcasts, generics, overloads, default method bodies,
structural typing, reflection, mutable static state and runtime-generated contracts
are unsupported. Ordinary concrete single inheritance remains unchanged. Archived
Guestbook/Taskboard checks are compilation baselines rather than archived host replay.
