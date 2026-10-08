# @wydgit/gate

Canonical server library `wydgate`, independently versioned at `0.1.0-alpha.2`.

Provides local users and Argon2id username/password authentication. Persistence uses
host-approved `wydstore` services and works with JSON or SQLite. WydGate never
imports a filesystem, database driver or WydStore provider.

The root exports the library manifest and registration entry. `/client` exports
`createGate(dispatch)` and `GateError`: create/get/find/update user, authenticate,
and changePassword, plus session, role/group, authorization and profile operations.
Only login returns a bearer token; other results contain safe metadata.

Requires explicit Gate capabilities, App scope and a host-configured private storage
binding. No automatic runtime authority or external login providers.
The initial directory is limited to 256 users and uses one atomic WydStore record.

See the monorepo's `docs/wydgate.md` for configuration, password policy, dependency
approval, errors and limits. Libraries provide capabilities. SEAM grants authority.


0.2-G adds revocable digest-backed sessions, additive roles/groups/permissions and
separate minimal profiles. Session-derived identity is metadata; it never grants
SEAM runtime authority. The private directory schema is now `wydgate.local/0.2`;
existing 0.2-F stores require an explicit future migration and are never reset.
See the platform documentation for APIs, host-only configuration and capacity limits.
