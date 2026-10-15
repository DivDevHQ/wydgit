# WBasic Taskboard

The original six-class SERVER family (`*.bas` in this directory), independent
canonical golden fixture and server acceptance tests are retained. CLIENT-specific
sources live in `client/`; they use the same canonical model and SEWN executor,
with a deliberately smaller presentation/service profile.

From the repository root:

```sh
npm ci
npm run build:client
node scripts/build-client-package.js examples/wbasic-taskboard/client/build.json packages/wydclient/examples/interactive divdev
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080/packages/wydclient/examples/interactive.html.
Next page, Add task and Clear local tasks execute compiled WBasic methods through
native controls. The embedded page beside it mounts two independent roots.
The host file supplies reviewed local development trust and action/capability
approval; it contains no application action handlers. It is not a production trust default.

The model accepts up to three additional in-memory tasks. Notes appear in feedback,
not persistent records. Reload loses additions; no database, Wydgine or Node server
is needed at runtime. Stop the static server with Ctrl+C.

See [H4 controls, authoring, signing and limits](../../docs/milestones/0.3-H4/README.md),
[WydClient current distribution](../../packages/wydclient/README.md), and
[the minimal quick start](../hello-client/hello.bas).
