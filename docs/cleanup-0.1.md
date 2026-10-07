# Wydgit 0.1 decisions and first cleanup

## Evidence and limits

Recovered from these accessible chats:

- [Create Generic Wydgit Boilerplate](chatgpt-conversation://6ac3ee74-39f0-83e9-933a-7ac118c3827e): clean platform/site separation and generic three-page target.
- [Promote Libertarian Abundance](chatgpt-conversation://6aa94330-9380-83e9-ac07-a8f05a5f6f9c): the user explicitly requested freezing 0.1 before going forward and keeping all Libundance content out; WydgiScript/runtime/API planning is for 0.2.
- Build Wydgine 0.1 alpha site (`01a0f915-fa8a-7f10-91e0-1c869f798e6e`): server-side Node/Express, nested JSON, Markdown sanitization, separate engine/adapter, no browser framework/database/CMS.
- Compare Wydgine and Libundance sites (`01a0f945-5e30-7b32-8e65-8743a168303c`): direct user decisions for `whole-card-link`, `linkToPage` using navigation page IDs, Skin references at Site/Page/Section/Block, columns, introduction placement, and navigation link states. Later fixes restored reusable glossary, assessment, callout, and related-link presentations.

The available chat list is bounded to recent chats; requesting larger listings was rejected. The local M3 site README/content was checked for Wydgit decisions and no matching architectural record was found. The M3 project is listed by the app, but its older relevant conversations and synced source files were not available here. This is a partial history recovery, not an exhaustive consolidation of M3 history.

The earlier conversation summary names DivDev (philosophy/SDK), Wydgit (component), Wydgit Host (mount), Wydgine (runtime), Wydgit Manifest (metadata), DivDev Studio (editor), and optional Wydgate. Treat these as recovered terminology from that summary, not implemented APIs verified here. The summary also proposes `v0.1.0`; the code remains `0.1.0-alpha.1`, and this cleanup does not declare a stable release or create a tag.

## Preserved 0.1 contract

Six prototype definitions remain byte-for-byte unchanged. Wydgine validates properties/defaults and fixed format enums, walks nested Page/Section/Block instances, sorts numeric order, and converts Markdown to sanitized HTML. Page IDs resolve to slugs and optional anchors; whole-card links use the same resolver and remove nested anchors. Skin tokens inherit from built-in defaults through Site → Page → Section → Block. Column groups preserve DOM reading order. Header introductions precede the sidebar grid. Desktop/mobile navigation and current-page markers remain.

The Express adapter, trusted-directory repository loader, skin validator/CSS generator, dependencies and reusable layout selectors remain. Local placeholders and 404/500 pages remain, as do live JSON reloads and the HTTP policy. Per-request repository reads are existing alpha behavior; earlier cache suggestions were not implemented here.

WydgiScript, behavior action trees, capability registries, search, external APIs, database/email, permissions, VMD, and editor/CMS work remain future scope. Contact has no functioning form or mail provider.

## Platform versus site

| Files | Classification | Cleanup |
| --- | --- | --- |
| `prototypes/*.json` | Platform contracts | Unchanged |
| `wydgine/repository.js`, `wydgine/skins.js`, `app.js` | Platform | Unchanged |
| `wydgine/index.js` | Platform with branded error link | Only changed error link to “Return to home” |
| `server.js` | Listener with branded startup log | Generic log; existing port/host behavior preserved |
| `public/css/site.css` | Reusable layout plus brand color choices | Preserved selectors/layout; neutralized default colors and tokenized branded card/button hover colors |
| `content/site.json`, `content/navigation.json` | Site instances | Generic title, footer, navigation and three-page registry |
| `content/pages/*.json` | Libundance editorial content | Replaced Home/About; removed other 44 pages; added Contact |
| `content/skins/libundance.json` | Site branding | Replaced with neutral `default.json` using the same supported tokens |
| `import/*` | Publication snapshots and site manifest | Removed all 47 files; recoverable from baseline |
| `scripts/import-published.js` | Site-specific migration | Removed; it hardcoded content/skin/layout choices and overwrote site instances |
| `scripts/check-content.js` | Generic checks plus publication fidelity | Preserved render/link/anchor checks; removed source publication comparison |
| `test/renderer.test.js` | Platform checks coupled to site fixtures | Updated references to generic fixture; removed publication snapshot count test |
| `package.json`, `package-lock.json` | Package identity and dependency metadata | Generic package name only; dependencies unchanged |
| `README.md`, `docs/model.md` | Documentation with branded examples | Generic instructions/examples |
| `.env` | Local deployment configuration | Preserved without reading its contents; excluded from baseline and ignored in git |

## Remaining separation work

The runtime still expects a single trusted root with `prototypes/`, `content/`, and `public/css/`; platform and example site are directory-separated, not separate distributable packages. Renderer document chrome and presentation-to-markup decisions remain explicit JavaScript. Several general presentation roles and tokens originated in the Libundance retrofit (glossary, assessment, relationship, etc.); they remain supported rather than being removed as unused features. CSS default token values still overlap skin instance values, and some interaction styling still uses fixed colors. Tests still load the example content as a fixture; a standalone platform fixture would decouple future site edits. Import conversion utilities and their development dependencies could be extracted into a separate migration package later; dependencies were intentionally retained in this pass.

No files in the original `/home/brian/Projects/libundance-site` or M3 site were edited. `/brian/Projects` does not exist on this host; the actual copy is `/home/brian/Projects/wydgit-platform`.

## Review

Baseline commit `7ad370a` contains the copied project excluding local `.env` and installed dependencies. Cleanup is left in the working tree. Use `git diff` for tracked modifications/removals and `git status` for the new Contact page, default skin, and this audit. See `changed-files.txt` for the full file inventory.
