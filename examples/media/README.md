# Installable Media Wydgits

`divdev/media@0.1.0` is an ordinary declarative package requiring canonical
WydStream, whose new host storage uses WydFiles and WydStore. Install with the existing operator tool:

```sh
node scripts/install-package.js examples/media --root /absolute/app/root --apply
```

It appends an Upload, Player and Gallery section to an existing Page without
replacing App content. It registers three public prototypes:

| Prototype | Properties |
| --- | --- |
| divdev/media-upload | resource (media), acceptedCategories (all four), maxBytes (8 MiB), accept (browser file hint), label |
| divdev/media-player | resource, mediaId (empty selects the media query parameter), label |
| divdev/media-gallery | resource, pageSize (10), mediaType (empty permits type query filtering) |

All use existing light/dark skin tokens, responsive controls, escaped text and
accessible labels. Player supports native audio/video controls, image previews,
and a download link. Gallery previews images directly, filters by category and
paginates with offset/type parameters. Empty/error states are bounded and disclose
no protected metadata. Upload requires a current WydGate session and the package's
explicit upload grant; anonymous visitors cannot upload. Existing host login
integration supplies that session. Login/admin consoles are outside this package.

The standard multipart form works without JavaScript. Browser submissions show a
success page and return link; programmatic submissions return JSON. The generic browser multipart adapter reports upload progress and supplies exact byte size.
Without JavaScript, enter the exact byte count in the size field before submitting. The package grants read/upload only, without store, repair,
update or delete authority. The library's private WydStore dependency manages
metadata separately from binary storage. See [the API/security/provider guide](../../docs/wydstream.md).

Run `node examples/media/demo.js` from the repository root for the disposable local
HTTP demonstration. See [0.3-F integration and migration](../../docs/wydmedia.md)
for storage configuration, limits, recovery, migration and simulated-S3 tests.
