# Wydgit Command-Line Interface Specification

Status: Proposed Architecture

We're defining the complete Wydgit application lifecycle, from source code to installed application.

The Wydgit toolchain handles building and distribution. Wydgine and WydClient handle execution.

That prevents us from bloating the browser runtime with compilers, ZIP libraries, or installation utilities.

## Proposed Wydgit CLI

| Command            | Responsibility                                               |
| ------------------ | ------------------------------------------------------------ |
| `wydgit compile`   | Compile WBasic into validated SEWN                           |
| `wydgit package`   | Assemble a distributable `.wydpkg`                           |
| `wydgit sign`      | Cryptographically sign a package                             |
| `wydgit verify`    | Verify signature, integrity, and package structure           |
| `wydgit install`   | Install and activate a package                               |
| `wydgit uninstall` | Remove an installed package safely                           |
| `wydgit upgrade`   | Replace a package with a compatible new version              |
| `wydgit list`      | Show installed packages                                      |
| `wydgit info`      | Show package metadata, dependencies, license, and permissions |
| `wydgit validate`  | Check a package/project without compiling, installing, or executing it |

These are proposed interfaces. The repository already has installation infrastructure; the goal is to build on it rather than replace it unnecessarily.

## The application lifecycle

WBasic source and Wydgit resources

.bas · prototypes · manifest · assets

Compile

Source → validated SEWN

Package and sign

.wydpkg · signed inventory · publisher identity

Verify and install

Trust policy · dependency checks · SEAM permissions

Wydgine / WydClient

Execute installed, validated application

Upgrade

Versioned replacement and data migration

Uninstall

Deactivate and remove safely

## Two operations require special care

### Upgrade

An upgrade should be treated as a controlled transaction, not an uninstall followed by an install.

It must verify the replacement publisher, check new dependencies and permissions, preserve application data by default, and apply any authorized data migrations with rollback or recovery provisions.

Critically, upgrading must not automatically grant new SEAM permissions just because the previous version was trusted.

### Uninstall

We should distinguish uninstalling an application from deleting its data.

For example:

```
wydgit uninstall divdev/taskboard
```

Should deactivate and remove the package while retaining its stored records by default.

A separate, explicitly confirmed option could remove package-owned data:

```
wydgit uninstall divdev/taskboard --purge-data
```

That operation must respect storage ownership and shared-resource dependencies. No deleting another package's records.

## How this fits the architecture

I'd divide the implementation into three internal components:

| Component                | Owns                                   |
| ------------------------ | -------------------------------------- |
| Wydgit Toolchain         | Compile, package, sign, verify         |
| Wydgit Package Manager   | Install, upgrade, uninstall, inventory |
| Wydgit Execution Runtime | Execute validated SEWN under SEAM      |

They can share one `wydgit` CLI and common libraries without becoming one giant executable.

This also allows DivDev Studio to call the same packaging and management APIs that the CLI uses, rather than maintaining separate implementations.

And WydClient can receive a small prepared application bundle without needing any of the developer tooling.

### Validate

It should check a package or project without compiling, installing, or executing it, as appropriate to the input.

That would be particularly useful for 3rd party Wydgit Developers, because they could catch invalid manifests, unsupported WBasic syntax, missing resources, and inconsistent permissions before handing an application to Wydgine.

I'd update `docs/wydgit-package-distribution.md` with a dedicated Package Lifecycle and Toolchain section, defining these commands and their responsibilities.

The end goal is one coherent workflow:

```
wydgit validate ./taskboard
wydgit compile ./taskboard
wydgit package ./taskboard
wydgit sign ./taskboard.wydpkg
wydgit verify ./taskboard.wydpkg
wydgit install ./taskboard.wydpkg
```

Then later:

```
wydgit upgrade ./taskboard-1.1.0.wydpkg
wydgit uninstall divdev/taskboard
```

That's a genuine package-management ecosystem rather than just a loader for Wydgit files.

And most importantly, it keeps our original architectural principle intact:

One toolchain. One package format. One execution contract. Multiple runtimes.
