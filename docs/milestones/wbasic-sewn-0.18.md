# WBasic / SEWN 0.18 — Date and time utilities

Implemented on `develop/0.3`; authoritative wire version `sewn/0.18`.
Platform 0.3.0-alpha.7 and WydClient 0.1.0-alpha.2 remain unchanged, following
0.11–0.17 policy. No dependency, manifest or lockfile changes are required.

## Temporal model and API

DateTime retains its private 0.11 brand, absolute UTC instant identity, canonical
ISO serialization, integral milliseconds and inclusive ±8,640,000,000,000,000 ms
range. Gregorian calendars use astronomical year numbering (including year zero).
Calendar dates and local clock components are projections, not independent instants.
Offsets are fixed displacements, not named timezone rules; durations are elapsed
quantities, not calendar months. No new primitive type or implicit conversion exists.

All positional arguments are required; these reserved intrinsics need no import:

| Signature | Result |
| --- | --- |
| DatePart(value AS DateTime, part AS String, zone AS String) | Integer |
| DateAdd(value AS DateTime, part AS String, amount AS Integer, zone AS String) | DateTime |
| DateDiff(start AS DateTime, finish AS DateTime, part AS String, zone AS String) | Integer |
| ParseDate(text AS String, format AS String, zone AS String) | DateTime |
| FormatDate(value AS DateTime, format AS String, zone AS String) | String |

Part strings are case-sensitive: `year`, `month`, `day`, `hour`, `minute`, `second`,
`millisecond`, `dayOfWeek`. Months are 1–12, days 1–31, hours 0–23, minutes/seconds
0–59, milliseconds 0–999; dayOfWeek is Sunday 0 through Saturday 6.
DateAdd/DateDiff accept those units except dayOfWeek, additionally `week`.

## Calendar arithmetic and differences

Millisecond/second/minute/hour addition uses checked UTC elapsed arithmetic.
Day/week addition preserves local wall time in the selected fixed-offset calendar
(one week is seven calendar days). Under fixed offsets this equals 24/168 elapsed
hours. Month/year addition retains clock components and clamps the original day to
the final valid day of the destination month. Negative amounts follow the same rule;
clamping is not invertible. January 31 + one month becomes February 28 or 29.
Gregorian leap rules include century exceptions and years divisible by 400.

Elapsed DateDiff uses exact integral timestamp subtraction and truncates toward
zero after division. A result outside the safe Integer range fails SEWN.TYPE.
Calendar day differences count midnight boundaries; month differences compare
`year * 12 + month`; year differences compare years. These count boundaries, not
completed anniversaries. Week difference truncates calendar-day difference / 7
and has no weekday alignment. Negative differences are symmetric.

Arithmetic and local projection reject range overflow, unsafe amounts/products,
and nonfinite intermediates. Local projection must itself fit DateTime bounds,
even when the original UTC instant is valid. All produced instants pass through
the established trusted DateTime constructor. No native Date object escapes.

## Parsing and formatting

ParseDate supports only format `iso`. Grammar:
`YYYY-MM-DDTHH:mm:ss.SSSZ` or the same with `±HH:mm` instead of Z.
Canonical expanded signed six-digit years support the established extended range;
redundant expanded ordinary years and negative zero year are rejected.
Exactly three fractional digits and an explicit timezone are required. Calendar
and clock components are checked before conversion; impossible dates, leap seconds,
whitespace, missing offsets and trailing characters fail. Explicit input offset
must equal the supplied zone offset; Z matches UTC or +00:00. This prevents the
zone argument from becoming a silent default or overriding explicit text.
DateTime() and Convert(..., DateTime) retain strict canonical UTC-only semantics.

FormatDate supports `iso`, or a bounded pattern using these greedy exact tokens:
`yyyy`, `MM`, `dd`, `HH`, `mm`, `ss`, `SSS`, `XXX` (numeric offset, +00:00 at UTC).
yyyy uses four digits for ordinary years, otherwise canonical signed six digits.
Literal characters are space, hyphen, slash, colon, period, comma and uppercase T.
Unsupported characters or incomplete tokens fail; no quoting, escaping, directives,
expressions or translated names exist. Repeated valid tokens are allowed within
bounds. ISO output uses Z at zero offset and the explicit numeric offset otherwise.
Output never uses locale, language preferences or the host timezone.

## Timezone decision and deferred services

Supported zones are exactly `UTC` or `±HH:mm`, hours 00–23 and minutes 00–59.
+00:00 is UTC; -00:00 is rejected because RFC 3339 uses it for unknown offset.
Unknown identifiers, including all named IANA zones, fail SEWN.TYPE (overlong
identifiers fail SEWN.LIMIT). No fallback or host Intl timezone lookup occurs.

The repository has no shared pinned timezone dataset. Adding one would require a
separate data/version/update contract and measured browser distribution. This
milestone chooses the explicitly permitted fixed-offset baseline and adds zero
timezone dependencies. It does not claim named-zone completeness or compare hosts'
independent timezone databases as evidence of parity. DST gaps, overlaps and
historical rule changes are unsupported because named zones are unsupported.
Applications must not use a fixed offset as a substitute for America/Chicago or
another region across DST. A 23/25-hour regional day cannot be computed here.
Named-zone transition tests are therefore rejection tests, not simulated DST.

Now() remains deferred. No unrestricted host clock intrinsic or mutable clock state
is introduced. The existing deadline clock is only an execution resource check.
Localized parsing/formatting, calendar primitives, durations as new types, traditional
DateSerial/TimeSerial/DateValue wrappers and scheduling/recurrence are deferred.

## Wire, security and resource bounds

0.18 extends 0.17 using the existing closed `operation {name,args}` expression.
The validator checks names, exact arity and every nested expression. Runtime checks
exact argument types and output contracts. Prior schemas reject new operations;
their reserved-name lists remain unchanged. Static linking propagates 0.18.
Prototype validation and the HTTP runtime asset allowlist include the shared module.

Hard maxima (UTF-16 units): dateInput 40, dateFormat 256, dateTokens 64, dateZone 64,
dateOutput 1,024. ExecutionContext may reduce these via `sewnDateInput`,
`sewnDateFormat`, `sewnDateTokens`, `sewnDateZone`, `sewnDateOutput`, including zero.
Existing String/value bounds, steps and deadline also apply. Formatting spends one
shared step per token/literal; every date operation spends an additional work step
and normal operation/expression costs. Calendar arithmetic and parsing do constant
bounded work without calendar searches or caches. Procedures and static calls keep
caller counters; no conversion replenishes budgets. Wrong types, invalid dates,
formats, zones and arithmetic produce recoverable SEWN.TYPE. Resource exhaustion
produces fatal SEWN.LIMIT, which cannot be caught and retried.

## Conformance and size

`test/sewn-dates.test.js` shares fixtures across server execution and an independently
bundled browser executor. It covers all five operations, component numbering,
pre-1970/year-zero instants, Gregorian century rules, month ends, negative arithmetic,
fixed offsets, calendar boundaries, malformed inputs, unsupported zones, overflow,
forged brands, wire closure, historical schema rejection, shared procedure/static
budgets, error recovery and WydClient event cancellation. No compiler, package
manager, host timezone database or Node module is bundled in that executor.

Event harness minified/gzip/Brotli: 218,914 / 70,362 / 61,342 bytes versus the
identical 0.17 harness 215,170 / 68,874 / 60,020: +3,744 / +1,488 / +1,322.
Alpha.2 bootstrap: 50,455 / 16,754 / 14,787 versus 49,966 / 16,617 / 14,649:
+489 / +137 / +138 bytes. Alpha.1 is unchanged. The event harness is a reproducible
test bundle, not an additional shipped bootstrap artifact.

Executed verification:

- Focused date suite: 4 groups passed, including shared browser fixtures, static
  linking, WydClient cancellation, input bounds and unrecoverable resource failures.
- Required `npm test -- --test-isolation=none`: 680 passed, 0 failed.
- Required `npm run check`: 3 complete pages, 42 internal links, unique anchors.
- Current Guestbook installation/HTTP/persistence and archived Guestbook/Taskboard
  source compilation baselines passed. Archived checks are not full host replay.
- Existing contracts/conversions, collections/loops, interfaces/Cast, regex,
  static libraries, package validation and SEAM/security regression suites passed.
- `git diff --check` clean; final branch/status, full source/artifact diff reviewed.

The first restricted full run could not exercise required local HTTP sockets;
successful verification used approved unrestricted execution. No test was weakened.
The independent [timezone decision](../decisions/0002-portable-date-time-fixed-offset-baseline.md)
records the principal portability limitation.
