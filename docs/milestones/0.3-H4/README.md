# Wydgit 0.3-H4 — Native controls and CLIENT authoring

WydClient **0.1.0-alpha.7**, WydSUB **0.1**, server/platform reference
**0.3.0-alpha.8**. H4 extends H3 with authored native controls and an explicit
CLIENT family/package build. Portable code remains canonical SEWN under SEAM.
There is no browser compiler, publisher JavaScript, UI framework, network form
submission, storage adapter or general DOM facade. See [verification](verification.md).

## Canonical control contract

`wydgit.presentation/0.2` requires `target: "client"` and one bounded `template`.
It reuses H3 structural nodes (`tag`, optional scalar `text`, ordered `children`)
and adds semantic control nodes. It does not define another Wydgit hierarchy.
Section/Block instances own their controls; fields may be lightweight presentation
metadata. Existing canonical Field validation supplies required/length/option
rules; canonical numeric conversion supplies Integer/Float input semantics.

```json
{
  "schema": "wydgit.presentation/0.2",
  "target": "client",
  "template": {
    "control": "form", "name": "NewTask", "label": "New task",
    "action": {"method": "submittask"},
    "children": [
      {"control":"text","name":"Title","label":"Task title",
       "type":"String","required":true,"maxLength":80},
      {"control":"submit","name":"Save","label":"Add task"},
      {"control":"reset","name":"Reset","label":"Reset draft"}
    ]
  }
}
```

Supported controls are label, status, button, form, text input, textarea, checkbox,
single select, submit and reset. Fields require explicit String/Boolean/Integer/
Float contracts, `required`, and `maxLength` 1–4096. Checkbox requires Boolean;
textarea/select require String. Select has 1–64 unique well-formed literal string
options, at most 128 code units each. Text input supports String or explicit numeric
conversion. Payloads contain only declared scalar fields; arbitrary JSON/native
objects cannot cross this boundary.

Each presentation is at most 65536 JSON characters, 256 nodes, 64 fields and 16
levels. Names are bounded safe identifiers and unique across one presentation.
Forms cannot nest. Empty/unknown options, unsafe keys, extra fields, unknown controls,
unknown attributes, invalid action signatures and unsupported targets fail validation.
H3's existing 4096 DOM-node, 262144 text-character, 32-level and shared step limits
also remain enforced. Native maxlength provides a UTF-16 editing bound; canonical
validation also rejects malformed surrogate sequences and enforces Unicode character
length. Native editing can consequently be stricter for non-BMP characters.

Literal/display values are scalars or exact public `properties.Name` reads.
Private/hidden/capability-restricted data cannot become display or initial-input
bindings. Input defaults do not confer write authority. Labels and field association
are generated natively; author-supplied HTML, CSS, event attributes, URLs, selectors
and browser objects are unsupported.

## Actions, authority and lifetime

A button declares a public `SUB Action()`; a form declares a public
`SUB Action(data AS Object)`. Schema validation resolves the method and declaring
owner using the existing registry and member kernel. Form field metadata supplies
the closed scalar record contract inside that Object parameter. Handlers are not
selected by reflection or DOM IDs. Event bindings remain the existing typed SEWN
events raised by those methods; H4 does not add a second dispatcher or SEWN grammar.

All actions must also appear in the trusted host's execution `actions` approval.
Control approval compares canonical method names without case distinction. This is
separate from publisher verification and every capability/member/scope check. Missing
host approval fails staging, including definitions used later by templates. The
package cannot approve itself. Runtime dispatch rechecks live root/receiver and
approval before entering the H3 controller. Inherited/overridden methods still use
authenticated declaring frames and the caller's unchanged SEAM context.

Listeners capture immutable control metadata and native element identity inside
trusted runtime closures. They verify current render generation, owning region,
root boundaries and executable instance state. The same terminal ledger checks the originating control lifetime again during
execution, so detaching a form cancels subsequent steps. A copied ID, cloned/transplanted
node, stale control, nested foreign form event or remounted root cannot obtain
another action. `isTrusted` is not an authorization rule: synthetic events can invoke
already approved live actions and acquire no additional permission. No native Event,
DOM element, callback, document/window, mutable context or trusted `host()` adapter
is passed to SEWN.

Complete field preparation is charged to the same terminal ledger as method entry,
nested calls, typed events, construction/reconciliation, hooks and presentation.
Only one native interaction per root may be pending; overlapping clicks/submissions
are dropped rather than queued into fresh budgets. Busy controls are disabled and
restored in `finally`, including errors and exhaustion. Independent subsequent
interactions begin independent authorized chains. Existing FIFO event ordering and
cancellation semantics are unchanged.

Unload cancels pending work through H3, disables actions and preserves local drafts.
Reactivation restores eligible controls without duplicate registrations. Rerender
retires old element listeners. Removal/Dispose/unmount deletes drafts and registrations
and permanently invalidates old receiver lifetimes. Root removal while work is
pending cannot mutate a replacement or a sibling. Cleanup remains best effort at
browser termination. Host relocation does not create canonical ownership; hosts
still own explicit mounting/unmounting responsibilities.

## Input, commit, validation and accessibility

Native input/change updates a root-local draft only. Canonical properties remain
unchanged until an approved action executes SEWN. A native submit is always prevented
from navigating or sending HTTP. The adapter reads only its registered fields,
rejects extra/missing controls, validates the entire record, converts bounded numeric
text and only then invokes the handler. Failed validation makes no application call
and cannot partially commit a record.

Invalid/rejected submissions preserve drafts. Validation feedback is sanitized,
announced with `role=alert`/`aria-live`, and fields receive `aria-invalid`. Application
exception text never reaches the UI. The current feedback intentionally reports a
general required/length/option error rather than exposing internal exceptions.

Rerender preserves edited draft values by exact live instance/control identity and
restores input focus/caret when possible. Unedited values reevaluate display/default
bindings. Successful SUB completion clears drafts to the newly rendered initial
values by default. Canonical `reset: "manual"` retains them instead; the current
WBasic form syntax uses the default success policy. Explicit native reset returns to
initial values and clears validation feedback. Earlier SEWN changes are not rolled
back after a later handler/event failure; that is the existing canonical H3 behavior,
not a transactional rollback promise for application methods.

Native button/form/input/textarea/checkbox/select/label elements provide keyboard
activation, tab order, Enter submission and selection semantics. Fields have visible
associated labels, forms have accessible names, and status text has a live region.
There are no click-only divs or global keyboard interceptors. Disabled controls
cannot initiate native actions. Focused rerenders preserve text selection where the
native control supports it.

## WBasic CLIENT target

Use build option `target: 'client'` and a client-only manifest runtime. SERVER remains
the default and retains its existing contracts. Unknown targets are rejected; BOTH
is not implemented. The existing parser, family dependency ordering, definition IR,
canonical lowerer, SEWN validator and static linker are reused. CLIENT uses the same
portable profile as the loader, rather than another interpreter or validator.

```vb
PUBLIC CLASS Panel EXTENDS wydgit.core/section
    META Id = "acme/panel"
    PUBLIC PROPERTY Message AS String = "Ready"
    PUBLIC SUB Save(data AS Object)
        Me.Message = data.Title
    END SUB
    PRESENTATION CLIENT
        HEADING "A native WBasic form"
        FORM Entry CALL Save
            INPUT Title AS String LABEL "Title" LIMIT 80 REQUIRED
            TEXTAREA Notes AS String LABEL "Notes" LIMIT 240
            CHECKBOX Done AS Boolean LABEL "Complete" LIMIT 1
            SELECT State AS String LABEL "State" LIMIT 16 OPTIONS ["Pending","Complete"]
            SUBMIT Submit LABEL "Save"
            RESET Reset LABEL "Reset"
        END FORM
        STATUS Feedback VALUE Me.Message
    END PRESENTATION
END CLASS
```

`BUTTON Name LABEL "Text" CALL Method` binds a zero-argument action.
`LABEL Name VALUE scalar` presents text. All fields use explicit `AS`, `LABEL` and
`LIMIT`; optional REQUIRED, OPTIONS (select only), and VALUE follow that order.
VALUE accepts the same scalar/exact public property bindings. CONTENT and HEADING
retain their scalar semantics. Component templates/repeaters remain the supported
list mechanism; markup-local REPEAT is not part of this client profile.

Server/Session/request/response/service contexts, unavailable libraries, unsupported
renderer metadata, invalid controls, private/mismatched action signatures and
client-forbidden service/storage capabilities fail compilation/lowering. Diagnostics
retain filename, line/column and declaration context; action binding errors can
identify their control declaration. No runtime tokens/secrets are emitted.

## Reproducible client packaging and signing

The explicit source inventory lives in a build JSON with exactly `target`,
`manifest`, `sources` and `entry`. Sources are bounded, dependency-ordered and
constrained to the build directory, including realpath checks. The manifest retains
publisher/package/version, exact static/interface pins and requested permissions.
No permission becomes a host grant. The generated client envelope remains the
implemented `wydgit.prototype-package/0.1`; the registry stays
`wydgit.registry/0.1`, WydSUB 0.1. This does not implement the proposed .wydpkg ZIP.

```sh
node scripts/build-client-package.js \
  examples/wbasic-taskboard/client/build.json \
  packages/wydclient/examples/interactive divdev
npm run build:client
python3 -m http.server 8765 --directory packages/wydclient
# /examples/interactive.html and /examples/interactive-embedded.html
```

The CLI's final publisher argument is explicit trusted local approval, not source
self-authentication. Outputs are deterministic `package.json`, local `registry.json`
and `integrity.json` with exact SHA-256 and client version. Only complete successful
compilation/lowering produces output. Consuming sites need static files only.

Trusted development APIs are `buildClientPackage(sources, options)` and
`signClientPackage(result, {privateKey,keyId,url})` in
`wydgine/wydbasic/client-package.js`. `buildClientFromConfig` in the script accepts
independent verifiedPackages, signing and approved static-library registry options.
Existing static linking resolves exact pins and rejects unavailable/untrusted/private
exports; only used portable SEWN helpers are included. A signing key must be Ed25519.
Signing reuses the existing SHA-256/pinned JSON/Ed25519 signature payload without
changing browser verification. For signed deployment, host the package and returned
signed registry, independently provision the returned public key binding, and approve
exact `package`/`packageVersion`, installation, actions and SEAM grants. Never publish
a private key or infer production trust from the sample local policy.

## Acceptance application, compatibility and exclusions

The client Taskboard retains the six-class Model/List/Card/Navigation/Record/Taskboard
family and typed PageChanged subscription. Its minimal model extension stores up to
three in-memory added records, visible on both pages. Next toggles pages; the form
adds a validated title/status, displays notes as feedback, and Clear removes local
records. Stable keys preserve added-card identity during navigation. Reset affects
only the draft. Notes are feedback text, not persisted task-record fields. Reloading
the page loses these local tasks; no database or browser persistence is involved.

Source and build inventory are under `examples/wbasic-taskboard/client/`. The H3
source/golden package remains unchanged and still runs as compatibility evidence.
The local host script contains only trust/bootstrap configuration. It has no
application button/form handlers. Chrome acceptance uses native mouse/keyboard
input against local, signed and independently embedded instances.

Controls require alpha.7; alpha.6 rejects the new presentation schema. Alpha.1–alpha.6
and their versioned reports remain immutable. The classic artifact contains neither
source compiler nor builder/signing/HTTP/storage code. Existing H3 presentations,
methods, events, rendering and root isolation remain supported.

Not supported: general event-to-method reflection, arbitrary JSON input, input-driven
property writes, file/password/upload controls, network submission, API/fetch/storage,
rich HTML/CSS/Markdown, Server/Session emulation, cross-root delegation, cross-origin
isolation, native adapters, new registry/archive infrastructure or deployment.
Server rendering of schema 0.2 explicitly fails; shared validation/type contracts do
not imply equivalence between native browser events and HTTP request lifecycles.
Future work can add reviewed semantic controls and target mappings without changing
SEWN or granting raw browser access. H5 candidates are focused accessibility/browser
compatibility review and approved semantic service profiles; persistence and iframe
isolation remain separate milestones.
