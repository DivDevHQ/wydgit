# Generic BackOffice usability — alpha.22

The trusted WydClient web adapter renders the existing closed bounded action
contract recursively. It accepts no contributed markup, callbacks, arbitrary JSON
Schema keywords, remote widgets or native host handles. Contract, service and
server validation remain authoritative. The standalone client package and immutable
historical bundles are unchanged; the served web adapter is mirrored in Wydgine's
runtime as before.

## Inputs

Strings show their maximum length and allow empty text, consistent with the server
contract. Whole-number inputs show both inclusive bounds and reject absent,
fractional, unsafe or out-of-range values without sending them. Checkboxes represent
both true and false; a required boolean does not mean it must be true. Null has an
explicit fixed-value control. Object fieldsets preserve nesting and closed fields.
Required fields are marked; optional fields retain explicit Include controls and
are omitted entirely unless included. Disabled optional fields do not submit data.

Arrays now use the same recursive renderer for their items: Add item, Remove item,
a live item count and a disabled Add control at the declared maximum. Primitive,
null, object and nested-array items use the same controls and bounds. Removing an
item preserves the remaining values and renumbers its accessible name; focus moves
to the next Remove control or Add when the array becomes empty. Adding focuses the
new editable item. There is no drag-and-drop dependency, silent coercion, automatic
reordering or arbitrary JSON editor. All supported contract types have controls.
The existing maximum depth six, 32 object fields, 256 array items and 4096 string
characters remain server restrictions. The client rejects rendering beyond depth
six; it cannot extend server bounds.

Field errors are text linked through `aria-describedby` and `aria-invalid`.
Submission announces the error and focuses the first invalid control. Native
`novalidate` allows the renderer to provide consistent bounded-value errors;
server checks remain unchanged. Loading disables the complete input fieldset while
preserving each optional fieldset's independent state. Input and array edits clear
write confirmation; each invocation consumes confirmation, including failed calls.

## Results and failure safety

Homogeneous object arrays render native tables with captions and column headings;
heterogeneous structures use lists and labeled nested values. Empty collections,
empty objects, empty strings and null have explicit text. Long strings over 240
characters use native details/summary disclosures with the full bounded value as
safe text. Whitespace and wrapping are preserved; table cells and scroll regions
remain bounded by the existing HTTP/result contracts. Common integer
`offset`/`limit`/`total` metadata receives a concise visible summary. It does not
promise a stable snapshot or automatically fetch another page.

Known service/validation/deadline failures have local plain-language messages;
untrusted messages/details are never rendered. Successful output must still match
the complete closed output contract. Every contributed key/value uses DOM text
construction, never HTML evaluation. Unknown result fields and oversized responses
still reject. No credential, provider exception, path or native policy is exposed.

An explicit trusted `rejected` outcome header lets a write failure say that service
execution did not begin. Otherwise a failed/lost write response remains uncertain:
inspect current state before submitting again. There is no automatic retry,
idempotency promise, reference rebinding or rollback claim. Current Gate permission,
SEAM/resource scope, origin, CSRF, receipt/generation and Store revision checks are
unchanged. Native package-policy review remains outside ordinary actions.

## Qualification

BOUI-01–15 cover the original member roster, array add/remove/max/count/focus,
nested object/array editing, optional inclusion, null/boolean values, inclusive
integer and string bounds, invalid input focus/announcements, 128 bounded result
rows, long hostile text, empty results, pagination, stale selection and confirmation
reset/no replay. The [real-browser harness](backoffice-browser-qualification.md)
is rerun against the changed renderer with the real installed roster. Deterministic
DOM tests qualify supported array shapes; broader native keyboard/assistive-technology
and arbitrary-skin checks remain limited to the explicitly recorded browser cases.
This is a small action form renderer, not a record-management product or full ADM-01.

Checkpoint evidence: full suite **1496/1496**; focused HTTP/action/UI **62/62**;
UI-only new renderer tests **15/15**. Chrome real login/roster/theme/responsive
rerun passed, with artifacts in `/tmp/wyd-backoffice-browser-mHmvC9`. Content and
whitespace checks passed. Final combined verification repeats required checks after
all increment edits; earlier counts are independent runs, not additive totals.
