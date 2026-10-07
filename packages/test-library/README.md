# @wydgit/test-library

Non-production workspace fixture for the Wydgit library contract. This is a real,
independently versioned npm package (`1.0.0`), deliberately marked private to avoid
accidental publication. It implements no platform infrastructure.

Canonical identity: `wydtest`. Publisher: `wydgit.core`. Server capability:
`test.echo.read`. Registration supplies one harmless echo function to the host.

Installation alone does not load this package. The demo's `wydgit.config.json`
explicitly maps it but disables it. Tests enable it through the same host loader
used at startup. Importing the module does not register anything globally.

See the monorepo's `docs/library-model.md` for the contract. Repository location
is not part of runtime identity. The package uses no relative imports into Wydgine.
