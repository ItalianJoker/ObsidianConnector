# Changelog

All notable changes to Obsidian Connector are documented in this file.

## [1.1.1] - 2026-10-18

Patch after 1.1.0: audit remediation (blockers + UX + teardown). Not a feature release.

### Fixed

- Desktop **Link** is blocked until existing vault pages are loaded (no unverified `.md` invent)
- Unlink always confirms (`openDialog`, else `window.confirm`; abort if neither)
- Confirm before overwriting an existing project binding
- Overflow containment (from #7) and cold-start **file** retry (~2.2s, same encoded URI)
- Vault errors mapped to i18n; Load/Save/Refresh `disabled` + `aria-busy`
- Search copy: matches are **highlighted**, not “listed first”
- Snacks only on user actions; passive hook refresh stays inline
- `destroy()` on `pagehide` / `beforeunload` (debounce, open retry, listeners)
- Dead `filterPages` removed; `defaultFolder` documented as deprecated persisted field

[1.1.1]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.1.1

## [1.1.0] - 2026-10-13

Minor bump: user-facing panel behavior changes (tree view, on-demand linked list, Refresh, cold-start open). Product invariants are unchanged — existing projects → existing pages, `obsidian://open` only.

### Features

- Hierarchical collapsible vault tree (folders → subfolders → `.md` files) with lazy DOM for collapsed folders
- Linked Projects collapsed by default; expand to render cards and search by name/path (150ms debounce)
- Manual **Refresh** reloads cached vault pages and project bindings
- Filtering `.md` files auto-expands matching tree branches
- Vault name/path warnings when config is missing or invalid
- Desktop open uses Electron `shell.openExternal` via `executeNodeScript` so a closed Obsidian app can still launch (`encodeURIComponent` on URI params)

### Performance

- Batched DOM updates (`DocumentFragment` / `replaceChildren`)
- Event delegation for the tree and linked-project cards; listeners are detached on teardown

[1.1.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.1.0

## [1.0.0] - 2026-09-16

First release.

### Features

- Link an existing Super Productivity project to an existing Obsidian page
- Never creates Super Productivity projects or Obsidian pages (`obsidian://open` only)
- Desktop: list existing `.md` notes from the vault folder and pick one
- Mobile / web: enter the vault-relative path of an existing page
- Open with `obsidian://open` (desktop and Obsidian Mobile)
- Plugin menu **Link Obsidian page…**, project header **Obsidian** / **Link Obsidian**, side panel / Panels
- **⋮** actions on linked projects in the panel (Open, Change page, Copy URI, Copy wiki, Unlink)
- Synced bindings via `persistDataSynced`
- English UI; side-panel labels safe when `translate()` returns a Promise

[1.0.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0
