# @wydgit/gate

Canonical server library `wydgate`, independently versioned at `0.1.0-alpha.1`.

Provides local users and Argon2id username/password authentication. Persistence uses
host-approved `wydstore` services and works with JSON or SQLite. WydGate never
imports a filesystem, database driver or WydStore provider.

The root exports the library manifest and registration entry. `/client` exports
`createGate(dispatch)` and `GateError`: create/get/find/update user, authenticate,
and changePassword. Results expose immutable user identity and safe metadata only.

Requires explicit Gate capabilities, App scope and a host-configured private storage
binding. No automatic authority, sessions, tokens, roles or external login providers.
The initial directory is limited to 256 users and uses one atomic WydStore record.

See the monorepo's `docs/wydgate.md` for configuration, password policy, dependency
approval, errors and limits. Libraries provide capabilities. SEAM grants authority.
