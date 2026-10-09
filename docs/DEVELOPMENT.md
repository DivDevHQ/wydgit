# Repository Development Rules

## Repository discipline
- Work from the active development branch.
- Preserve unrelated local changes.
- Do not rewrite history or modify release branches without explicit approval.
- Do not modify downstream/reference projects.

## Architecture
- Preserve KISS/KICK.
- Wydgine owns server execution and transport.
- WydClient owns client adaptation and presentation.
- SEAM owns authority.
- Identity and application permissions do not grant SEAM capabilities.
- Prefer semantic, renderer-independent abstractions.
- Do not expose raw Node, DOM, filesystem, process, SQL, or arbitrary package access to ordinary Wydgit code.

## Quality
- Use existing abstractions before creating parallel systems.
- Keep public APIs small and intention-revealing.
- Update version metadata and CHANGELOG when required.
- Run `npm test` and `npm run check` before considering work complete.