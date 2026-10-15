# Native client Taskboard

This explicit CLIENT variant retains the six-class WBasic Taskboard family and H3
navigation, typed events, keyed cards and lifecycle hooks. Its Model adds a bounded
three-record in-memory list. The authored form collects a title, feedback notes,
completion flag and state. Next navigates; Clear retires added cards. Nothing persists.

From the repository root:

```sh
node scripts/build-client-package.js examples/wbasic-taskboard/client/build.json packages/wydclient/examples/interactive divdev
npm run build:client
python3 -m http.server 8765 --directory packages/wydclient
```

Open `/examples/interactive.html` or `/examples/interactive-embedded.html`.
The final CLI publisher argument independently approves local build provenance;
it does not grant runtime authority. `interactive-host.js` explicitly reviews local
prototype identities and approves actions/SEAM grants. It contains no application
button/form behavior. See [H4](../../../docs/milestones/0.3-H4/README.md) for production
signed-package setup and the canonical control grammar.

The generated `interactive` folder is reproducible package/registry/integrity output.
The original H3 source and independent golden fixture remain unchanged. Browser
controls do not imply HTTP form semantics; SERVER builds use their existing path.
