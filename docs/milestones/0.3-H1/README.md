# 0.3-H1 — WydClient bootstrap and manifest foundation

Starting branch: `develop/0.3`, clean working tree. Starting HEAD:
`c0e0f93421b2d02ad5fb265530aecf65452f6dc5`.

H0's [canonical OOP contract](../../canonical-oop.md) remains authoritative.
WydClient reuses its validators without modifying the server object model.
The independent client release is `0.1.0-alpha.1`; WydSUB compatibility is `0.1`;
the platform/Wydgine version remains `0.3.0-alpha.7`.

Implementation, deployment, manifest/signature contract, Page adaptation,
trust boundaries and deferred H2 operations are documented in the
[WydClient package README](../../../packages/wydclient/README.md). The
[publisher fixture](../../../packages/wydclient/examples/publisher/README.md)
includes a signed version-pinned package and complete ready-to-copy declaration.

Validation stages all declarations before approval. Failure retains only a
default browser Page and logical Top/Bottom destinations, with explicit failed
readiness. Signature verification is functional using native SHA-256/Ed25519;
it does not grant SEAM authority or execute package behavior. Native crypto
support/secure context are required for signed packages, otherwise fail closed.

H1 deliberately retains the shared full H0 declaration validator, exceeding the
suggested minified size budget. The bundle includes no server execution engine,
Node builtins or runtime npm dependencies. Measured sizes are recorded in
[sizes.json](../../../packages/wydclient/dist/sizes.json).
