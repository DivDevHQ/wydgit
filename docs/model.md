# Wydgit model and renderer API

## Editing Wydgits

The prototype is the structural kind; Markdown is a Block content property:

```json
{
  "id": "example",
  "prototype": "section",
  "order": 10,
  "blocks": [
    {
      "id": "example-intro",
      "prototype": "block",
      "order": 10,
      "format": { "presentation": "pullquote" },
      "content": { "type": "markdown", "value": "## A heading\n\nYour text here." }
    }
  ]
}
```

Each prototype JSON defines required properties, types, defaults and supported format values. Wydgine resolves those definitions before rendering. Renderers for the six kinds remain explicit JavaScript in this alpha; prototypes are not executable plugins. Page/Section child contracts define nested ownership.

Sections and Blocks sort by numeric `order` (default 0; ties keep array order). IDs must start with a letter and contain only letters, numbers, `_` or `-`, and must be unique within a page. Optional Block `anchors` retain source heading/link IDs. Section headings stay in Markdown; there is no automatic extra heading.

Supported `format` properties are `align` (start/center/end), `width` (normal/wide/narrow), `layout` (flow/cards/columns), `tone` (plain/hero/muted), and `presentation` (prose/card/whole-card-link/pullquote/eyebrow/lead/button/panel). They map to fixed CSS classes, never arbitrary CSS. `position` supports header/main/aside/footer; it adds a semantic class, chooses the corresponding Block container, and places site Navigation in the header, side column, or footer. Section order remains explicit rather than visually rearranged by CSS.

Navigation targets:

```json
[
  { "label": "About", "page": "about" },
  { "label": "Intro", "page": "about", "section": "about-details" },
  { "label": "This section", "section": "example" },
  { "label": "External reference", "url": "https://example.com/" }
]
```

Same-page sections resolve to `#section`; other pages resolve to their slug plus optional fragment. Nested `items` create native HTML disclosure menus. Markdown can use ordinary existing paths and fragments. Add new page IDs to `content/site.json` and corresponding Navigation items as needed.

## Renderer API and errors

```js
import { createRenderer } from './wydgine/index.js';
const renderer = createRenderer({ root: '/absolute/path/to/wydgine-alpha' });
const { html, status, diagnostics } = renderer.renderPage('/about/');
```

`renderSite(model, pathname)` is the pure in-memory renderer; `loadRepository(root)` is the file loader. Neither depends on Express. A render result contains the complete HTML document and suggested response status.

Unknown/malformed Blocks, Sections or Navigation show a small unavailable-content placeholder while the rest of the page renders. Unknown/malformed Page, Site or prototype files return a complete 500 page. Missing routes return 404. Details go to server diagnostics, never stack traces in HTML. Invalid links fail locally. Markdown HTML is sanitized with a narrow tag/attribute allowlist; scripts, embeds, event attributes, unsafe URLs and arbitrary styles are removed. Only CSS is exposed as a static directory. Request paths never become file paths.


## Linked cards

`card` is a bordered content block. `whole-card-link` makes the entire block a native, keyboard-accessible link. Both support `linkToPage`, a page **ID**, using the same resolver as Navigation `page` (including the home page and slug changes). It is required for `whole-card-link`. A plain `card` with `linkToPage` receives a separate descriptive page link; without it, normal Markdown links remain usable. Other presentations reject `linkToPage`.

```json
{
  "id": "about-card",
  "prototype": "block",
  "format": { "presentation": "whole-card-link" },
  "linkToPage": "about",
  "content": { "type": "markdown", "value": "### About\n\nLorem ipsum dolor sit amet." }
}
```

Inner Markdown links in whole-card links become plain text to prevent nested anchors. Missing or unpublished target IDs produce a local diagnostic and placeholder. `linkToPage` accepts neither URLs nor fragments; use Navigation or ordinary Markdown links for those.

## Skins and inheritance

`prototypes/skin.json` defines a sixth Wydgit kind. Store instances in `content/skins/<id>.json`, with an ID matching the filename. The site uses `"skin": "default"`, defined in `content/skins/default.json`.

Any Site, Page, Section, or Block can reference a skin by ID. Tokens cascade in this order:

**Built-in defaults → Site → Page → Section → Block**

Omit `skin` to inherit everything. Reference a partial skin to override only its declared tokens. Siblings and ancestors remain unchanged. A page's skin applies to its main content; the site header and footer retain the site's skin.

For example, create `content/skins/quiet.json`:

```json
{
  "id": "quiet",
  "prototype": "skin",
  "title": "Quiet accent",
  "tokens": { "accent": "#aabbcc", "card-columns": 1 }
}
```

Then add `"skin": "quiet"` to a section. It keeps the parent font, colors, and spacing except for those two tokens. The same reference works on a page or block. Layout tokens affect the layout owned by that node, not its parent's grid.

Supported tokens are declared in the prototype: colors (`ink`, `muted`, `paper`, `surface`, `accent`, `line`, `link`, `panel`, `panel-ink`); `font-family`; `body-size`; `line-height`; `content-width`; `reading-width`; `section-space`; `column-gap`; `card-padding`; `card-gap`; and `card-columns` (1–3). Colors use hex notation. Lengths use positive px/rem/em/ch values. Font choices and numeric bounds are explicit in the prototype. Unknown tokens and CSS injection are rejected.

Skins render as scoped CSS custom properties through `/css/skins.css`; no inline styles, client framework, or weaker Content Security Policy are needed. JSON edits apply on refresh. Missing/invalid site or page skins fail the page; section/block skin failures stay local. Skin definitions do not contain arbitrary CSS or scripts.

## Columns and presentation roles

Sections with `format.layout: "cards"` use the skin's `card-columns` count (two for the default skin), collapsing to one on small screens. Section labels and headings span the grid; `card` and `whole-card-link` occupy individual cells.

For composed layouts, use `format.layout: "columns"` on the section and `format.column: "left"`, `"right"`, or `"full"` on its blocks. Adjacent blocks with the same placement form a column group. Keep blocks in reading order: full-width label if needed, left group, then right group. Groups stack in that same order on mobile. Without explicit placement, a columns section retains the ordinary two-column grid behavior.

The homepage uses these groups for the hero, AI feature, economic section, and constitutional section. `eyebrow`, `lead`, `button`, and `panel` provide reusable presentation roles for labels, introductions, primary links, and feature panels. `width: "narrow"` centers the long-form basics section. No homepage IDs are hardcoded into the stylesheet.

Leading Sections with `position: "header"` render above the sidebar/content grid. Keep these header sections at the start of the page's ordered sections. The site `logoText` property supplies an optional decorative letter mark. The skin's `link-hover` token controls text-link hover color; header navigation underlines only the current page.

Reading-page presentations also include `related` (separate Continue reading links), `note`, `concept`, `relationship`, `metadata`, `summary`, `back`, `glossary`, and `assessment`. Card collections contain one `whole-card-link` block per card, with `layout: "cards"` on the owning section; do not flatten a collection into one Markdown block. Glossary Markdown retains semantic `<dl>`, `<dt>`, and `<dd>` tags through the sanitizer. Assessment lists retain native ordered-list semantics while displaying styled numbers. Skins can override `soft`, `quote-border`, and `assessment-number`. The presentation regression test compares component counts against all 46 publication snapshots, alongside the existing word-order and link checks.
