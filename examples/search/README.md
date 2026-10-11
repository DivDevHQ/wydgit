# Installable search Wydgits

`manifest.json` is a normal `wydgit-package/0.1` package, `divdev/search` 0.1.0.

From the platform checkout, with canonical workspace libraries installed:

```sh
node scripts/install-package.js examples/search --root /path/to/site --apply
```

Approve the displayed permissions, public source Pages and infrastructure, select
an existing Results Page or create one, and optionally place Bars in existing
Page header Sections and add a navigation link. Installation produces the standard
receipt and preserves unrelated site content. Restart the host after installation.
The package receives only search read capability and an exact index scope; its
WydStore access remains empty. Source selection belongs to trusted host policy.

Public prototypes:

- `divdev/search-bar`: `destination`, `placeholder`, `queryParameter` (q),
  `label` (accessible label), `submitLabel`, and inherited skin properties.
- `divdev/search-results`: `index` (required; template selects site), `queryParameter` (q), `pageSize` (10),
  `showType`, `showSnippet`, `emptyMessage`, `noResultsMessage`, and inherited skin.

The provided Section template contains both components. They can also be
instantiated independently in trusted initial installation policy `additions`,
using ordinary canonical instance envelopes and placement `{page,parent,slot,index}`.
Each instance keeps its own properties. Template `properties` overrides are keyed
by instance ID. Results query parameters must differ for independent searches;
`offset` is reserved for pagination. The host presentation budget defaults to four attempts per Page execution;
trusted `runtime.componentRequests` accepts 0 through 16.

Bars use ordinary GET forms. Components render in existing Sections/Block slots,
including Page header Sections. App navigation supports links, not Wydgit slots;
there is no global header component placement. One package principal per Page and
one installation per package ID remain enforced. Additional initial placements
are bounded to 32, with 256 total template/attachment objects. New Page provisioning
is limited to an empty native Page. No upgrade/uninstall lifecycle is added.

The original [search acceptance site](../testsearch/setup.js) consumes this installed
package. [WydSearch documentation](../../docs/wydsearch.md) covers host limits,
visibility, refresh, portability and durability.

Component behavior is declarative in `prototypes.json` (`wydgit.presentation/0.1`).
There are no search renderer hooks or search prototype IDs inside Wydgine.
`config.js` and `install-policy.js` are static trusted operator UI adapters only and are not manifest
resources or executed by ordinary Wydgits. The library owns source extraction and
refresh; generic host initialization calls only approved library implementations.
