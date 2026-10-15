# I5.4 dependency closure (before extraction)

Baseline bb4664e, Node 24.21.0, npm 11.19.0. Baseline normal-isolation suite:
888 passed; check passed. Restricted sandbox execution cannot run the full suite;
normal subprocess/loopback execution is required.

| Entry/resource | Actual closure and extraction requirement |
| --- | --- |
| app.js, server.js | composition, renderer, host, lifecycle, Hono transport; preserve root sample entry, move composition once |
| wydgine/index.js | marked, sanitize-html, components, skins, repository, definitions; App content/prototypes/public belong to consumer |
| WBasic/SEWN | all compiler, definitions, object-model, events, SEAM, generated RE2JS 2.8.6 including license; single context brand |
| host, installer | root platform metadata, semver, recovery/catalog receipts, approved dynamic library imports; use installed metadata |
| HTTP | Hono, @hono/node-server, busboy, routing/transfers/cookies/response; explicit browser module allowlist |
| Browser resources | wydclient/uploads.js and index.js plus allowlisted engine modules; compiler signing imports WydClient packages/data/network source |
| Gate client | pipeline statically imports @wydgit/gate/client even without enabled services; remove eager resolution while preserving actual facade |
| Canonical services | resolve implementations and exported metadata via createRequire at App root, approved installation ancestry only; never install at request time |
| Store/Gate | better-sqlite3 13.0.3 / argon2 0.45.1; native installation must be verified |
| Search | entities 4.5.0, undeclared sanitize-html, repository/renderer/ExecutionContext cross-tree imports |
| Files/Stream | aws4 + fast-xml-parser / file-type; Stream imports engine transfers/destination; Files requires Node >=24.21 |
| Inventory/operations/relocation | one engine graph; metadata + App contracts + resource ownership; no hosting dependency |
| Launcher | config/selection/setup/start/terminal/persistence; setup verifies real installed package identity, not repository ancestry |
| WydHosting | inventory/config/routing/validation/schema/governance repository imports become explicit trusted package exports; exact engine prerelease |
| Build | build-regex writes canonical generated source; client bundle source labels must retain historical bytes; all 23 tracked dist files protected |

There is no runtime npm installation or untracked generation requirement in an
installed package. Tests, samples, App state, keys and build tools are excluded.
Third-party registry dependencies and locally packed Wydgit dependencies are distinct.
