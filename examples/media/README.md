# Installable Media Wydgits

`divdev/media@0.1.0` is an ordinary declarative package requiring canonical
WydStream. Install with the existing operator tool:

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
integration supplies that session. A complete login/admin UI is deferred to 0.3-E.

The standard multipart form works without JavaScript. Browser submissions show a
success page and return link; programmatic submissions return JSON. Progress is
deferred to 0.3-F. The package grants read/upload only, without store, repair,
update or delete authority. The library's private WydStore dependency manages
metadata separately from binary storage. See [the API/security/provider guide](../../docs/wydstream.md).
