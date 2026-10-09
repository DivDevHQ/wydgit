# Portable Forms — 0.2-N

`wydgit.core/form` inherits `wydgit.core/section`. Form is a first-class semantic
Wydgit and submission scope, independent of HTTP, HTML, Node and DOM. Sections
retain their `blocks` slot, now accepting Blocks, Sections and Fields. Blocks gain
an optional `children` slot with those same types. Forms retain the legacy `fields`
slot as ordinary containment for 0.2-H compatibility; it is neither required nor a
parallel index. Normal content, help text and layout can surround fields.

Every descendant Field belongs to its nearest containing Form. Traversal visits
slots in lexical order and children in canonical array order. Fields need not be
direct children. Names are stable binding keys, distinct from immutable instance
IDs: 1–64 ASCII letters/digits/underscore/hyphen, starting with a letter; reserved
keys are forbidden. Names must be unique across the entire Form. Nested Forms,
including subtypes and Forms concealed beneath other containers, are rejected by
hydration, every canonical mutation candidate, and draft subtree validation.

## Controls and values

All concrete controls inherit `wydgit.core/field`. The original concrete Field
remains a text control for compatibility.

| Prototype suffix | Value | Empty value |
| --- | --- | --- |
| text-input | String | `""` |
| password-input | String, sensitive | `""` |
| text-area | String, multiline | `""` |
| checkbox | Boolean | `false` |
| radio-group | String or Null | `null` |
| checkbox-group | Array of distinct Strings | `[]` |
| select, multiple false | String or Null | `null` |
| select, multiple true | Array of distinct Strings | `[]` |

The common contract is `name`, `label`, `value`, `required`, `enabled`, `visible`,
`valid`, and `validationMessage`. Legacy `errors` and `warnings` remain available.
Label is semantic human-readable control metadata, including native/accessibility
association. TextInput, PasswordInput and TextArea add `placeholder: String|Null`
and `maxLength: Number|Null`. Placeholder is a display hint for an empty value;
it never enters collected/bound values. Null maxLength imposes no semantic limit;
non-null limits must be nonnegative safe integers. Character validation counts
Unicode code points. Runtime string/body/resource bounds still apply. HTML
maxlength counts UTF-16 units and can be stricter for supplementary characters;
server validation remains authoritative. Non-text controls have no placeholder or
maxLength property. Core controls contain no HTML tag/configuration properties.

RadioGroup, CheckboxGroup and Select share `options`, an array of exactly
`{value: String, label: String, enabled: Boolean}` objects. Values are nonempty and
unique within the control. Unknown/dangerous keys and malformed objects are denied.
Only enabled option values pass selection validation. Select adds `multiple`.
There is no coercion between arrays, strings, nulls and booleans. Authored values
initialize each isolated request/client state; binding operates on current values.

## Form methods

These are public inherited prototype methods, authored as WydBASIC and compiled
through the existing `sewn/0.3` method system:

```basic
CALL Me.Bind({"name":"Brian", "subscribe":TRUE})
DIM valid AS Boolean = Me.Validate()
DIM current AS Object = Me.Values()
DIM lastValidation AS Boolean = Me.IsValid()
CALL Me.Clear()
```

- `Bind(Object)` changes only supplied field values. Unknown keys, incompatible
  types, duplicate selections and unavailable options fail closed before edits.
  Required/character-limit failures are retained for subsequent validation.
- `Values()` returns JSON data keyed by field name, excluding PasswordInput.
  Labels, placeholders, options and other configuration never appear in this map.
- `Validate()` checks every descendant, writes deterministic `valid`,
  `validationMessage`, `errors`, and clears warnings, then updates Form validity.
  It returns Boolean. Required text means non-whitespace text; required Checkbox
  means true; required groups/selections mean at least one selected value.
  Type, cardinality, enabled option membership and maxLength are independently
  checked. Disabled/visually hidden fields are still included and validated.
- `IsValid()` reads current field validation state, without running rules again.
  Call Validate after changing values. Page submission always validates first.
- `Clear()` uses the empty values above, resets validation to its initial valid
  state and preserves every configuration/layout property. It does not restore
  authored defaults. A distinct Reset operation is deferred.

Disabled fields may be bound and collected: enabled controls interaction, not
existence. Visible controls presentation, not membership. Each request starts from
an independent canonical snapshot; request edits do not persist automatically.

## Kernel and authority

`FormState(operation, data?)` is the narrow kernel binding used by these methods.
It accepts only validate/isValid/values/bind/clear, only on a Form receiver. It
traverses canonical containment rather than exposing arbitrary graph navigation.
Page operations require `children` traversal and visibility of every visited
object. All writes use normal `object.instances.edit` and exact visibility/edit
scopes, atomically. WydClient applies the same requirements to its host-supplied
semantic tree. Traversal is bounded to 10,000 server nodes / 1,000 client nodes;
`context.limits.formNodes` can reduce these limits. Prototype methods retain normal
SEWN budgets and the caller's exact authority. Inheritance grants none.
The shared rules and traversal helpers in `object-model/forms.js` are runtime
neutral; they import no Node, browser, HTTP or persistence APIs.

## Sensitive values

PasswordInput is distinct from ordinary text. Its normal control interaction is
obscured. Generic Values, scoped/draft property reads and client Value reads omit
or blank its value. Default `dehydrate`, `serialize`, instance JSON diagnostics,
and web projection redact it. Validators/errors report only rule failures, never
submitted contents. Web rendering always leaves the password value empty,
including after invalid POST. Client Change payloads redact OldValue/NewValue;
the adapter commits the private proposal separately.

Trusted kernel code can read raw runtime properties or explicitly export
`dehydrate(runtime, {includeSensitive:true})` when preserving request state through
an internal edit. That host-only export must never be used as diagnostic output.
For a deliberate authentication action, the web host's existing scoped
`REQUEST.Form.Get` can read a named submitted password. There is no generic
password collection method, secret persistence, vault or logging API. Passwords
remain transient request/control state; no automatic secret storage is introduced.

## Hosts and rendering

The web adapter decodes POST data into semantic values: text as String, checkbox
presence as Boolean, repeated values for multi-choice controls as Arrays, missing
single choices as Null. The empty single-select browser option maps to Null, so
option values must be nonempty. Multiple submissions to single-value controls are
rejected. Unknown submitted keys fail closed. Disabled fields retain their current
values. The shared validator runs before semantic Submit; invalid Submit handlers
can inspect validation, while the registered action default is suppressed.
Non-sensitive values and layout survive invalid redisplay.

Web maps controls to text/password input, textarea, checkbox, radio/checkbox
fieldset groups, and single/multiple select. Labels use associated control IDs;
groups use legends and per-option labels. Validation uses aria-invalid and
aria-describedby with message IDs. Enabled maps to disabled, visible to omission,
and text hints/limits map to placeholder/maxlength. IDs derive from instance IDs
but never become application identity. Normal nested Section presentation remains.
Form's existing label property supplies the web adapter's submit action caption.

WydClient can execute these prototype methods using a supplied PrototypeRegistry
and parent-linked semantic node projections. It adapts text, Boolean checkboxes,
radio/checkbox groups and single/multi select; host `readValue`/`writeValue` hooks
can supply another native control mapping. Submit validates before dispatch and
uses existing action authority. These hooks/elements stay in trusted host code;
portable handlers receive no native objects. The client adapter does not implement
canonical tree attachment or storage. Windows/mobile controls and renderers,
automatic client bootstrap, Reset, advanced validators and cross-field rules are
deferred. The Guestbook reference applet is deferred to 0.2-O.

`test/forms.test.js` provides the ProfileForm vertical fixture and direct hostile
object/mutation/draft, shared rule, portable source/Page and client tests. Existing
real HTTP tests continue proving the transport boundary, CSRF and isolation.
