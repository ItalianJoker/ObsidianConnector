# Obsidian Connector

A [Super Productivity](https://github.com/super-productivity/super-productivity) plugin that links an **existing** Super Productivity project to an **existing** page in your Obsidian vault.

The plugin never creates Super Productivity projects and never creates Obsidian pages. Opening always uses `obsidian://open` (never `obsidian://new`).

```text
obsidian://open?vault=WorkVault&file=Work%2FElmec
```

This is not task sync. Bindings are project → page links only. For checkbox sync, keep using `sync.md`.

## Features

- **Existing projects only** — pick from Super Productivity projects that already exist
- **Existing Obsidian pages only** — pick or type a note that already exists; nothing new is created
- **Desktop folder tree** — set the vault folder on disk, **Load existing pages**, then browse folders → subfolders → `.md` files. Collapsed folders are not rendered until opened. Search filters the tree and auto-expands matching branches
- **On-demand linked projects** — the **Linked projects** list stays collapsed until you open it, then you can search by project name or page path
- **Refresh** — reload the cached vault tree and project bindings
- **Config warnings** — the panel flags a missing vault name or an invalid desktop vault path
- **Mobile / web** — type the vault-relative path of an existing page (e.g. `Work/Elmec.md`); open still uses `obsidian://` with Obsidian Mobile
- **Open with `obsidian://open`** — vault and file params are `encodeURIComponent`'d. On desktop Super Productivity, the plugin asks Electron `shell.openExternal` to launch Obsidian even when the app is closed
- **Link entry points** — side panel (also under mobile **Panels**), plugin menu **Link Obsidian page…**, project header **Obsidian** / **Link Obsidian**, and a **⋮** menu on each linked project inside the panel
- **Copy Obsidian URI** / **Copy [[wiki]]**
- **Synced bindings** via `persistDataSynced`
- **Safe paths** — vault-relative only; absolute paths and `..` are rejected

## How linking works

| What | Format |
| --- | --- |
| Stored binding | Vault-relative page, e.g. `Work/Elmec.md` |
| Open | `obsidian://open?vault=VaultName&file=Work%2FElmec` |
| Wiki link | `[[Work/Elmec]]` |

## Install

1. Download a plugin ZIP from the latest **1.1.0** release (`obsidian-connector.zip` or `obsidian-connector-1.1.0.zip`), or build this branch with `npm run zip`
2. In Super Productivity open **Settings → Plugins → Choose Plugin File**
3. Select the ZIP and enable the plugin
4. On desktop, allow file access when Super Productivity asks (needed only to list existing pages)

Requires Super Productivity **14.0.0** or later. Works on desktop, web, Android, and iOS. Listing pages from disk needs the desktop app. Obsidian (desktop or mobile) must be installed to open pages.

## Usage

### Desktop

1. Open **Obsidian Connector** (side panel, plugin menu, or **Link Obsidian** header button)
2. Enter vault name + vault folder on disk → **Save** → **Load existing pages** (later: **Refresh**)
3. Choose an existing Super Productivity project
4. Expand folders in the tree and select an existing `.md` page (or search; matching folders open themselves)
5. **Link to selected page**
6. **Open in Obsidian** (or the header **Obsidian** button) uses `obsidian://open`

### Mobile / web

1. Open **Obsidian Connector** from the **Panels** menu (or the plugin menu)
2. Enter the vault name (as shown in Obsidian)
3. Choose an existing Super Productivity project
4. Type the vault-relative path of a page that already exists (e.g. `Work/Elmec.md`)
5. **Link to selected page**
6. **Open in Obsidian** uses `obsidian://open` with the Obsidian Mobile app

Disk browsing is unavailable on mobile/web — you must type the path of an existing note. The plugin still does not create pages.

### Linked projects in the panel

**Linked projects** starts collapsed (no cards in the DOM). Open it to search and manage links. Each linked project has a **⋮** menu with: **Open in Obsidian**, **Change page**, **Copy URI**, **Copy [[wiki]]**, **Unlink**. Unlink removes the binding only; nothing in the vault is deleted.

## Limitations

- The plugin **cannot create** Obsidian pages or Super Productivity projects
- Super Productivity does not currently allow plugins to inject items into the project **⋮** work-context menu in the app chrome. Closest supported entry points: project header buttons (next to that menu), side panel / **Panels** (mobile), and plugin menu **Link Obsidian page…**
- Listing vault pages from disk requires the Super Productivity **desktop** app with file access allowed
- Cold-start open (Obsidian fully quit) needs the desktop app plus the plugin's **nodeExecution** / file-access consent so Electron can call `shell.openExternal`. If that path is unavailable, the plugin falls back to a hidden protocol iframe and copies the URI if launch still fails

## Release

This codebase is **1.1.0**. See [CHANGELOG.md](CHANGELOG.md). Publish a `v1.1.0` tag to cut the GitHub Release (assets: `obsidian-connector.zip` and `obsidian-connector-1.1.0.zip`).

## Development

```bash
npm test
npm run zip
npm run harness                 # desktop harness
# http://127.0.0.1:4173/?platform=android  # mobile UI mode
```

Shared logic lives in `src/core.js` (CommonJS + iframe). The host registers Super Productivity entry points in `src/plugin-host.js`. The side panel is `src/ui.js` + `src/index.template.html`. `npm run build` concatenates those into `plugin/`.

## License

MIT
