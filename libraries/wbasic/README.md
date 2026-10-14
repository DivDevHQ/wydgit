# divdev/wbasic 1.0.0

Source alias: WBasic. Explicit import: `WITH LIBRARY divdev/wbasic`.
Public procedures: Mid, Len, InStr, UCase, LCase, CStr, Val.

`library.bas` compiles with `compilePrototype(source, {static:true})`.
`prototypes.json` uses the existing `wydgit.prototype-package/0.1` envelope.
Install into a build context with `installStaticLibraryDirectory(directory,
{verifiedPackages})`, using the host's independently verified/approved publisher
mapping. This does not authenticate a publisher by itself. No runtime grants,
network acquisition or implicit imports occur. Pass the returned definitions and
verifiedPrototypes to StaticLibraryRegistry; explicitly pin dependencies when
compiling applications. The compiler links only referenced procedures.

Mid uses one-based positions: start >= 1 and count >= 0. A start beyond the
string returns empty; count clamps to the remaining string. InStr returns one-based positions and 0 when absent.
String length/casing use the existing canonical UTF-16/Unicode contracts.
CStr supports Scalar through canonical Convert. Val uses canonical strict complete
decimal parsing; whitespace, overflow and underflow are rejected. Legacy unimported
CStr/Val retain their historical conversion behavior.

Source and compiled definitions are MPL-2.0. No registry or archive tooling is
provided. See ../../docs/milestones/wbasic-sewn-0.14.md for the platform contract.
