# @wydgit/store

Canonical library `wydstore`, independently versioned at `0.1.0-alpha.2`.

The root export is the trusted server library descriptor and registration entry.
`@wydgit/store/client` exports `createStores(dispatch)` and `StoreError`, a portable
store/collection/record facade with no Node dependencies. Supply a host-bound SEAM
dispatcher; never pass the raw registry to ordinary package code.

This initial package includes typed records, explicit save/delete, optimistic
concurrency, record history, minimal equality queries, and local JSON/SQLite adapters. Both implement the same internal contract.
SQLite uses the pinned better-sqlite3 dependency; provider selection and paths
remain in trusted host configuration.
It is installed but disabled by default in the Wydgit demo.

See the monorepo's `docs/wydstore.md` for configuration, authority, API, persistence
limits and structured errors. Libraries provide capabilities. SEAM grants authority.
