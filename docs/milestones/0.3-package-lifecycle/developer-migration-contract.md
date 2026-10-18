# Developer migration declaration contract, increment 1

Historical increment contract. The [manual replacement successor](manual-replacement-contract.md)
adds durable retirement/staging and separately versioned prototype adoption while
preserving the version 1 declaration behavior below.

This is the bounded successor contract for the declaration/execution portion of
[the authoritative plan](developer-defined-migrations.md). It does not implement
retirement, durable replacement staging, reference adoption or qualify MIG-01
through MIG-15 as a whole. The existing host migration contract remains accepted.
I/J assignments, the HTTP blocker and Decision 0003's 0.4 deferral are unchanged.

Trusted `planPackageOperation` accepts optional `developerMigrations`, a closed
`wydgit.developer-migration-request/1` object with `declaration`, `path`, `approvals`
and `artifacts`. Only an installed primary package on `update`/`upgrade` is supported
in this increment; mixing developer and host migration approvals refuses.
Artifacts are explicit local package paths, never fetched. They contain every
intermediate target; the final target comes from the normal approved candidate.

The separate closed JSON declaration `wydgit.developer-migrations/1` has `package`,
`supportedSources`, `limits`, and `steps`. Each step has `id`, `from`, `to`, `logic`,
`logicHash`, `validators`, `validatorsHash`, and `requiredCapabilities`. Endpoints
contain exact `version` and `artifact` SHA-256. Artifact hashes are SHA-256 of
canonical JSON (`clean`, sorted object keys) of `{manifest, resources}`; resource
values are exact file text. `inspectPackageMigrationArtifact(packagePath)` returns
the version and hash. These hashes bind local content; they are not publisher
signatures. Static-library/interface compiled artifacts are unsupported here.

Logic is the existing closed `wydgit.package-migration/1` lossless rename/default
grammar. Its identity/versions must match the enclosing declaration. This increment
permits fixed-ID property changes only; prototype changes, structural mapping,
splits/merges, storage ownership/provider changes and destructive operations refuse.
No callbacks, general SEWN, JavaScript, SQL, paths, services or host context are
passed to developer logic. Recovery publishes verified images, never reruns logic.

Validators have exact `before`/`after` arrays. Each predicate has `scope`, `name`,
`field`, `op`, and (only for `equals` or `type`) `value`. `scope` is `storage`
(logical collection name) or `instance` (managed instance ID). Supported operations
are `present`, `absent`, `equals` (canonical JSON equality), and `type` (JSON type).
Storage predicates inspect all live values and all non-null historical values;
tombstone metadata stays intact. Instance predicates inspect properties. Foreign
or unknown scopes refuse, including empty collections. Predicates cannot write.

`logicHash` and `validatorsHash` hash canonical JSON. A step hash hashes its entire
canonical declaration. Each host approval has exact `step`, `sha256`, and
`capabilities`, matching that step and its required capabilities. Storage logic or
validators require `store.records.read`; storage writes additionally require
`store.records.write`; instance logic/validators require `object.instances.edit`.
Declarations must request exactly the capabilities they use. The branded host
context must hold each capability. No declaration, package permission, identity,
role, dependency, other step or approval grants it. Resource access is confined to
receipt-established mappings and managed IDs, with existing object edit scopes.

`path` explicitly selects step IDs, including for a single edge. Every selected
approval is used exactly once; no unrelated/extra artifact or approval is accepted.
Alternative declaration edges are allowed, but duplicate IDs/edges, inconsistent
artifact identities for a version, non-increasing versions, unknown formats and
missing supported-source paths refuse. `supportedSources` names exact versions;
each needs a path to the requested target. No claim of all prior versions is
inferred. Every chosen intermediate validates schemas, full App hydration,
bindings, unchanged template footprint and the full dependency graph. Intermediate
requirements and grants must equal the approved final candidate's; they never
activate. A failed path cannot switch to an alternative.

Limits are positive integers: `records` (at most 4096), `history` (16384), `bytes`
(4 MiB cumulative scanned input/output), `mappings` (256), `steps` (32), and
`stagingBytes` (4 MiB). The operation also shares the existing terminal work/time
ledger and cancellation token. Counts accumulate across steps and validators.
Declarations/requests have the existing 64 KiB ceiling; the aggregate recovery
checkpoint remains 4 MiB. No ceiling is raised and no chunking is implied.

The frozen preview binds the selected declaration hashes, artifacts, path, scopes
and before/after resource fingerprints. Apply consumes the original plan and
rechecks local artifacts before effects. Catalog/config/store stale checks, writer
serialization, private checkpoint publication, crash reconciliation and checked
rollback reuse the existing lifecycle machinery. Receipt/catalog migration lineage
records declaration/step/artifact hashes and source receipt identity. Reusing an
observed step ID with different content refuses. This is local integrity evidence,
not an external audit ledger or distribution trust protocol.

Durable manual retirement/staging and their execution quarantine remain necessary
before manual/automatic equivalence or package-management beta can be claimed.
The qualification record for this increment must distinguish tested portions of
MIG gates from the full scenarios still open.
