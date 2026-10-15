# Wydgit Package Distribution, Signing and Compatibility Architecture

**Status:** Draft architectural specification  
**Proposed repository path:** `docs/wydgit-package-distribution.md`  
**Applies to:** Wydgine, WydClient, DivDev Studio, Wydgit Package Registry, and third-party publishers

## 1. Purpose

This document establishes Wydgit's intended approach to application packaging, publisher authentication, cryptographic integrity, software licensing, compatibility, and distribution.

Wydgit is designed as a portable application framework supporting independently developed Wydgits, reusable prototypes, and applications compiled from WBasic and future languages into SEWN.

The package architecture must support secure third-party distribution without imposing unnecessary runtime complexity or requiring every package to use Wydgit's own software license.

**Core principle: Packages carry software and provenance. SEWN defines execution. SEAM controls authority.**

## 2. Design principles

1. **Portability:** Packages must be distributable across supported operating systems and runtime environments.
2. **Publisher autonomy:** Developers retain control of package licensing and their private signing keys.
3. **Verifiable provenance:** Installers must verify package integrity and the signing publisher's identity under explicit trust policies.
4. **Least privilege:** Publisher trust does not confer runtime authority.
5. **Lightweight execution:** Browser runtimes should not include build tools, unnecessary server dependencies, or obsolete execution grammars.
6. **Backward compatibility where justified:** Preserve published and known-working application baselines rather than indefinitely supporting every alpha development iteration.
7. **Simple development:** Unpacked directory packages remain usable during development.
8. **Deterministic verification:** Package integrity does not depend on ZIP entry order, timestamps, or compression settings.
9. **Explicit versioning:** Package, library, compiler, wire-schema, and execution compatibility are distinct concerns.

## 3. Package container

### 3.1 Official format

The proposed distributable package format is:

**`.wydpkg` — a standard ZIP archive**

Wydgit should use established ZIP implementations rather than inventing a proprietary compression or archive format.

The archive extension identifies it as a Wydgit package, while the contained manifest defines the package's identity.

### 3.2 Proposed package structure

```text
example.wydpkg
├── manifest.json
├── integrity.json
├── signature.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── NOTICE
├── THIRD_PARTY_LICENSES.md
├── prototypes.json
├── section.json
├── scripts/
│   ├── main.bas
│   └── handlers.bas
└── assets/
    └── icon.svg
```

This layout is illustrative. Existing package manifest/resource schemas remain authoritative until the new packaging specification is implemented.

The package root must not require an additional enclosing directory.

### 3.3 Development packages

Wydgit must continue supporting unpacked package directories for local development.

Production/public distribution uses the signed archive format when signing infrastructure is available.

The packaging system should compile, validate, and prepare artifacts without requiring developers to manually manipulate archive metadata or signatures.

## 4. Required documentation and licensing

### 4.1 Documentation requirements

| File | Installable development package | Published package |
|---|---|---|
| `manifest.json` | Required | Required |
| `README.md` | Recommended | Required |
| `LICENSE` | Recommended | Required |
| `CHANGELOG.md` | Recommended | Recommended |
| `NOTICE` | When legally required | When legally required |
| `THIRD_PARTY_LICENSES.md` | When needed | When needed |

An installation tool may warn about incomplete documentation in development packages.

Publishing tools should enforce the requirements of the applicable publishing policy.

A changelog is especially appropriate when a package has publicly released versions or introduces breaking changes.

### 4.2 Independent licensing

The MPL 2.0 license covering Wydgit framework files does **not** automatically require every independently written package to adopt MPL 2.0.

Packages may use compatible licenses including:

- MPL-2.0
- MIT
- Apache-2.0
- BSD-3-Clause
- GPL family licenses, subject to applicable obligations
- Proprietary/commercial licensing
- Custom publisher agreements

Licensing obligations for copied, modified, combined, or redistributed third-party material still apply.

### 4.3 License metadata

Package manifests should support an SPDX license expression where applicable.

Illustrative metadata:

```json
{
  "id": "acme/inventory",
  "version": "1.0.0",
  "license": "MIT"
}
```

Custom licenses may use appropriate SPDX `LicenseRef` declarations with accompanying legal terms.

The package registry must not infer legal licensing rights from technical installation capabilities.

**A license determines legal permissions. SEAM determines technical authority.**

## 5. Cryptographic package signing

### 5.1 Purpose

Publisher signing establishes two fundamental properties:

- **Integrity:** Package contents have not been modified since signing.
- **Provenance:** The package was signed using a private key corresponding to the trusted publisher identity.

A signature does not establish that a package is secure, harmless, correctly implemented, or entitled to privileged access.

### 5.2 Proposed algorithms

| Purpose | Standard |
|---|---|
| Digital signatures | Ed25519 |
| File hashing | SHA-256 |
| Signed inventory serialization | Deterministic canonical JSON or equivalent specified encoding |
| Package archive | ZIP |
| Publisher key identity | Explicit key identifier tied to trusted publisher records |

Algorithm agility and future migration should be planned without permitting unsafe fallback or ambiguous verification.

### 5.3 Signed contents

All installable package content must be covered by the signed inventory, including:

- Manifest and declared metadata
- Wydgit prototypes and templates
- WBasic source and/or compiled SEWN
- Assets and other resources
- README and changelog
- License and legal notices

The signature envelope itself must be excluded from the inventory to avoid circular signing dependencies.

Any such excluded metadata must be narrowly defined and treated solely as verification data.

### 5.4 Canonical inventory

The packaging tool generates a deterministic inventory containing the package identity, version, and an exact listing of signed file paths and their content hashes.

The signing specification must define:

- Exact canonical byte encoding
- Path normalization
- Lexical entry ordering
- Duplicate-path rejection
- Hash algorithm identification
- Signature payload construction
- Signature domain separation
- Versioning of the signing envelope

Equivalent package contents should verify regardless of ZIP compression level, entry order, timestamps, or other nonsignificant archive metadata.

### 5.5 Publisher keys

A publisher may maintain one or more authorized signing keys.

Private keys remain under publisher control.

The system must support:

- Public-key registration
- Key identifiers
- Key rotation
- Key revocation
- Explicit trust decisions
- Publisher ownership continuity
- Secure key-loss recovery procedures

A correctly signed package is not automatically trusted merely because its signature verifies mathematically.

### 5.6 Update authorization

A new package version must be authorized by a key recognized for the claimed publisher and package identity.

An unrelated key must not be able to impersonate an existing publisher or replace an established package.

Changes of signing authority require an explicitly verified transfer, rotation, or recovery procedure.

### 5.7 Trust states

The system should distinguish:

1. **Integrity verified:** File hashes and cryptographic signature are valid.
2. **Publisher recognized:** The signing key is associated with the claimed publisher identity.
3. **Publisher trusted:** The host accepts that identity under its configured trust policy.
4. **Capabilities approved:** The operator grants the package's requested SEAM permissions.

These states must not be conflated.

An authenticated publisher cannot grant their software permissions over resources they do not control.

## 6. Package installation security

Before activation, the installer must validate archive structure, package identity, signature, trust policy, dependencies, resource declarations, and requested capabilities.

The archive processor must reject:

- Absolute paths and `../` traversal
- Path aliases and ambiguous normalization
- Duplicate or case-colliding entries
- Symlinks and special filesystem entries
- Unlisted or missing signed content
- Modified file contents
- Malformed manifests and signature envelopes
- Excessive decompression size, entry counts, or compression ratios
- Unsupported archive features and malformed ZIP metadata

Verification and extraction must avoid race conditions and filesystem escape.

All resource and permission approvals must pass through the existing controlled installer and SEAM mechanisms.

Package changes should be applied transactionally where supported.

## 7. Runtime artifact architecture

### 7.1 Source and execution

WBasic source compiles into validated SEWN.

Future Wython and Wuby compilers will target the same canonical execution contract.

The package build process may produce platform-specific deployment artifacts from a common source package.

### 7.2 Server execution

Wydgine executes validated server-side SEWN using approved server services, contexts, and capabilities.

Server-only resources and source must not be exposed to browsers merely because they exist in the original package.

### 7.3 Browser execution

WydClient should receive only the components required for browser execution.

Its production bundle should generally contain:

- The portable SEWN executor
- Required validation and safety logic
- Approved client-facing context and service bindings
- Referenced application artifacts and resources

It should not routinely include:

- WBasic's source compiler
- Wython/Wuby compilers
- Node-only service implementations
- Server storage adapters
- Unused standard libraries
- Unneeded historical SEWN compatibility machinery

Build-time tooling is responsible for preparing the client distribution.

### 7.4 Validation at trust boundaries

A package signature does not replace SEWN validation.

Likewise, prior verification by a server must not justify blindly trusting executable content supplied through an untrusted client boundary.

Each runtime must validate or securely consume previously validated artifacts according to its trust model.

## 8. SEWN versioning and compatibility

### 8.1 Guiding policy

**Published compatibility commitments and known-working applications matter more than internal development milestones.**

Wydgit is still in alpha development.

Intermediate SEWN versions used during architecture exploration are not necessarily permanent public compatibility contracts.

### 8.2 Required historical baselines

Two compatibility baselines are currently identified.

**Baseline A — Published Wydgit 0.2.0-alpha.18**

Commit:

`bc3d2bf5162615215bd5a54bf7756883155086f5`

This release includes the Guestbook example and represents the published alpha framework whose compatibility must be evaluated and preserved under an explicitly documented policy.

**Baseline B — Last pre-Codex Taskboard**

Known candidate commit:

`6e9ce28b32702263f23baa8283103559f5f1ff66`

Taskboard package:

`0.4.0-alpha.14`

Confirm this commit as the exact compatibility baseline before finalizing implementation requirements.

The Taskboard uses language features introduced during the early WBasic development period.

### 8.3 Historical SEWN schemas

Do not retain every obsolete SEWN runtime grammar solely because it appeared as an internal milestone.

Where historical implementations are unnecessary:

- Consolidate current execution behavior.
- Preserve compatibility for identified applications.
- Migrate internal tests where appropriate.
- Retain security regressions against current behavior.
- Remove unused legacy acceptance paths where safe.

Do not silently reinterpret an old schema identifier with incompatible semantics.

Unsupported historical formats should be explicitly rejected or migrated through a documented transformation.

### 8.4 Compatibility migration

Where practical, migration from an earlier supported representation to the current canonical SEWN representation should occur at build or installation time.

A migration must preserve the original program's observable behavior and security constraints.

Changing only a schema version string is not a valid migration.

Runtime compatibility code should not be retained indefinitely when an independently verified build-time migration can replace it.

### 8.5 Historical releases

Published Git commits and release tags remain immutable historical references.

Reducing support in a newer alpha runtime does not erase earlier releases.

Intentional breaking changes must be documented.

## 9. Package identity and dependencies

Packages must have stable publisher-qualified identifiers.

Package manifests must identify their own version and declare compatible platform, library, and dependency requirements.

Package dependencies and signing authority are separate concerns.

A package must not acquire authority merely because a trusted package depends on it.

Installed package updates must preserve publisher ownership and obey operator policy.

Future registry tooling should expose dependency information, supported runtime versions, licenses, trust information, and SEAM permissions before installation.

## 10. Proposed developer tooling

Future tooling should support operations conceptually equivalent to:

```bash
wydgit package ./my-package
wydgit sign ./my-package.wydpkg
wydgit verify ./my-package.wydpkg
```

These are proposed interfaces, not implemented commands.

The precise command names, flags, key-management workflow, and registry integrations will be specified in a later tooling milestone.

Verification should also work independently of installation.

## 11. Distribution and publishing

Distinguish:

**Installable package:** A structurally valid package satisfying applicable installer, dependency, integrity, and permission requirements.

**Publishable package:** A package additionally satisfying publisher authentication, documentation, licensing, metadata, and registry policies.

The public Wydgit registry should require authenticated publisher signing before accepting publicly distributed packages.

Local development packages may follow a separate, explicitly configured trust policy.

Production installation must not silently downgrade its verification requirements to accommodate unsigned development packages.

## 12. Performance and package size

WydClient is a primary reason to avoid accumulating unused runtime dependencies.

Browser-facing runtime size should be measured regularly, including compressed transfer size and initialization cost.

Minimize client distribution by separating:

- Compiler versus executor
- Build-time versus runtime
- Server-only versus browser-safe
- Current execution semantics versus legacy compatibility
- Referenced resources versus unused resources

Removing a historical SEWN grammar is not, by itself, proof of a meaningful bundle-size reduction. Actual output must be measured.

## 13. Future milestones

This architecture should inform dedicated work in the following areas:

| Milestone area | Responsibilities |
|---|---|
| Package metadata | README, LICENSE, CHANGELOG, SPDX, publisher identity |
| Archive specification | `.wydpkg`, canonical paths, ZIP validation |
| Publisher signing | Ed25519, SHA-256 inventories, verification |
| Publisher trust | Trusted keys, rotation, revocation, ownership continuity |
| SEWN compatibility cleanup | Published baseline testing, migration and grammar consolidation |
| WydClient packaging | Browser-specific deployment artifacts and size control |
| DivDev Studio | Package creation, signing workflow, documentation and distribution |
| Package registry | Publication policy, publisher verification, updates, license display |

These are separate from the WBasic/SEWN 0.11 Core Type Contracts milestone.

## 14. Unresolved implementation decisions

Before development begins, establish:

1. Exact archive schema identifier and signature-envelope version.
2. Canonical signed payload encoding.
3. Publisher trust-store ownership and management.
4. Revocation and key-rotation mechanisms.
5. Whether the current package manifest schema is extended or replaced with a new version.
6. Whether publication always requires signatures, and how private distribution is configured.
7. Exact Guestbook and Taskboard compatibility fixture boundaries.
8. Minimum supported SEWN deployment format and build-time migration process.
9. Client artifact signing and trusted verification procedures.
10. Distribution size targets and measurable bundle budgets.

These decisions must be documented before their associated feature is considered stable.

---

## Architectural summary

Wydgit package distribution consists of four separate layers:

**Package:** Contains the application and its declared resources.

**Publisher signature:** Establishes package provenance and integrity.

**SEWN:** Defines validated, portable program execution.

**SEAM:** Controls runtime authority and resource access.

Licensing independently defines the legal terms under which the package may be used, modified, or distributed.

The long-term objective is a secure, publisher-independent package ecosystem whose installed applications can execute across Wydgine and WydClient without unnecessary historical compatibility code or unrestricted host access.

**End of draft specification.**

## 0.20 authoring/runtime compatibility

The existing distribution/installation contract also consumes trusted source-family
build output; see [the Taskboard workflow](milestones/sewn-0.20/README.md). Canonical
component contracts require platform alpha.8 or newer, server execution eligibility
and existing independent publisher/owner approval. The installer validates manually
constructed artifacts too. No package source compiler runs at browser/runtime startup,
no new package format is added, and no metadata authenticates a publisher or grants SEAM.

## Implemented H3 browser profile

The [H3 contract](milestones/0.3-H3/README.md) documents WydClient alpha.6 executable
definitions, separate host authorization and immutable distribution. It reuses the
existing pinned signed JSON prototype-package envelope; this does not implement
the proposed archive/registry infrastructure described above.

## Implemented H4 client authoring

[H4](milestones/0.3-H4/README.md) supplies deterministic CLIENT family builds and
Ed25519 signing preparation for the implemented `wydgit.prototype-package/0.1`
and `wydgit.registry/0.1` browser envelopes. Existing hash/signature/origin/version
checks and independent execution approval remain authoritative. The speculative
ZIP/registry design above is not substituted for these contracts.
