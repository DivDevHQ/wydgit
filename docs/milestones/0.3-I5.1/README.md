# I5.1 — Engine boundary and baseline locks

Wydgine executes applications. WydHosting operates hosting infrastructure.
This phase preserves platform **0.3.0-alpha.12**, WydClient **0.1.0-alpha.8** and
WydSUB **0.1**. It establishes internal source boundaries, not a packed engine.

## Implementation

- New `wydgine/inventory.js` owns the sole `validateAppInventory` implementation,
  its closed-schema/path/tree/ownership checks, execution reductions and configuration
  fingerprint. `executionLimits` and `snapshotAppConfiguration` are internal helpers
  shared with the controller; neither is in the trusted worker facade.
- `wydgine/multi-app.js` imports those helpers and re-exports the same validator
  function for compatibility. All controller lifecycle/admission/token code is retained.
- `wydgine/relocation.js` imports inventory directly. Restore no longer dynamically
  imports the live controller; the relocation/controller cycle is removed.
- New `wydgine/trusted/worker.js` contains five direct re-exports. It adds no state,
  authority, management transport, provider registration or alternative execution path.
- New `test/engine-boundary.test.js` exercises identities, standalone HTTP/services/
  upload runtime assets/shutdown, inventory failures and local ESM dependency closure.
  Existing `test/multi-app.test.js` and `test/hosting-operations.test.js` now exercise
  the facade with their full real five-library/Taskboard/lifetime/relocation contracts.

## Trusted integration contracts

Import `wydgine/trusted/worker.js` only from trusted Node composition:

| Export | Existing authoritative contract |
| --- | --- |
| `validateAppInventory(input, {root, execution})` | Validate fixed canonical inventory; frozen result, existing HOST error categories |
| `createHostApp(options)` | Explicit selected root/App identity; ready canonical libraries, HTTP App, `stop`/`shutdown` |
| `createMultiAppHost(input, options)` | Validate/create fixed controller; `activate`, listeners, scoped contexts/bindings, health/usage, `stop`, `dispose`, stopped `snapshotApp` |
| `createOperationalHost(policy, options)` | I3 required/optional startup, sanitized `snapshot`, `shutdown`, signals, trusted controller access |
| `restoreLocalApp(snapshot, destinationPolicy)` | Existing stopped local JSON profile, rebound roots and complete inventory validation |

Creation does not implicitly start a controller listener. Operational `start` does.
Shutdown/retirement and source `controller.snapshotApp` remain existing methods,
not parallel facade implementations. No ExecutionContext constructor or raw snapshot
helper is exported here. Exports organize trusted code; they cannot sandbox hostile
Node code. Portable packages receive only existing SEAM-governed interfaces.

## Compatibility and security

The sixteen-App ceiling, inventory size/tree bounds, canonical identity checks,
root confinement/link rejection, service and remote namespace ownership, package
catalog/recovery checks, routing/anonymous parking and resource/execution policies
are unchanged. Publisher config gains no authority. Root `app.js`, `server.js`,
`npm start`, renderer/pipeline, proxy policy and I0–I3 examples keep their paths and
behavior. No manifests, dependencies, browser artifacts or WydSUB code change.

Direct re-exports preserve function identity. The same original SEAM context module,
WeakSet brands, private controller WeakMaps and frozen tokens remain authoritative.
Existing tests through the facade reject copied/foreign/retired/reused contexts and
tokens, including a fresh controller with the same canonical App IDs. No copied
runtime, second executor or WydHosting dependency is introduced.

## Deferred

I5.2 owns standalone selection/setup and its CLI. I5.3 owns provider registry/plans.
I5.4 owns coherent physical extraction, metadata/assets/dependency relocation and
actual isolated tarball installs. I5.5–I5.8 own protocol/supervision, qualified Linux
privilege/isolation, journaled provider migration and release decisions. None is
implemented here. Current path validation is not race-proof against hostile OS
writers; current isolation is logical within a shared process.

See [dependency audit](dependency-audit.md) and [verification](verification.md).
