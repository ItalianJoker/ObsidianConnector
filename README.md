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
- **Desktop page browser** — set the vault folder on disk, **Load existing pages**, search and select a `.md` note
- **Mobile / web** — type the vault-relative path of an existing page (e.g. `Work/Elmec.md`); open still uses `obsidian://` with Obsidian Mobile
- **Open with `obsidian://open`** — launches that page in Obsidian (desktop or mobile)
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

1. Download a plugin ZIP from the latest release: **[v1.0.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0)**
   - `obsidian-connector.zip` or `obsidian-connector-1.0.0.zip` (same build)
2. In Super Productivity open **Settings → Plugins → Choose Plugin File**
3. Select the ZIP and enable the plugin
4. On desktop, allow file access when Super Productivity asks (needed only to list existing pages)

Requires Super Productivity **14.0.0** or later. Works on desktop, web, Android, and iOS. Listing pages from disk needs the desktop app. Obsidian (desktop or mobile) must be installed to open pages.

## Usage

### Desktop

1. Open **Obsidian Connector** (side panel, plugin menu, or **Link Obsidian** header button)
2. Enter vault name + vault folder on disk → **Save** → **Load existing pages**
3. Choose an existing Super Productivity project
4. Select an existing Obsidian page from the list
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

Each linked project has a **⋮** menu with: **Open in Obsidian**, **Change page**, **Copy URI**, **Copy [[wiki]]**, **Unlink**. Unlink removes the binding only; nothing in the vault is deleted.

## Limitations

- The plugin **cannot create** Obsidian pages or Super Productivity projects
- Super Productivity does not currently allow plugins to inject items into the project **⋮** work-context menu in the app chrome. Closest supported entry points: project header buttons (next to that menu), side panel / **Panels** (mobile), and plugin menu **Link Obsidian page…**
- Listing vault pages from disk requires the Super Productivity **desktop** app with file access allowed

## Release

Sole current release: **[v1.0.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0)**

See [CHANGELOG.md](CHANGELOG.md).

## Development

```bash
npm test
npm run zip
npm run harness                 # desktop harness
# http://127.0.0.1:4173/?platform=android  # mobile UI mode
```

## License

MIT
