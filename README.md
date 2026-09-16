# Obsidian Connector

A [Super Productivity](https://github.com/super-productivity/super-productivity) plugin that **links an existing Super Productivity project to an existing page in your Obsidian vault**.

The plugin does **not** create Super Productivity projects and does **not** create Obsidian pages. On desktop it lists notes already in the vault; on mobile/web you enter the vault-relative path of an existing page. Opening uses `obsidian://open` only (never `obsidian://new`).

```text
obsidian://open?vault=WorkVault&file=Work%2FElmec
```

This is not task sync. Bindings stay as project → page links. For checkbox sync, keep using `sync.md`.

## Features

- **Existing projects only** — choose from Super Productivity projects that already exist
- **Existing Obsidian pages only** — pick a note that already exists; the plugin never creates a page
- **Desktop page browser** — set the vault folder on disk, **Load existing pages**, search and select
- **Mobile / web compatible** — enter the vault-relative path of an existing page; open still uses `obsidian://` (works with Obsidian Mobile). Disk browsing needs the desktop app
- **Open with `obsidian://open`** — launches that page in Obsidian
- **Link window entry points** — side panel (also under mobile **Panels**), plugin menu **Link Obsidian page…**, project header **Obsidian** / **Link Obsidian** buttons, and a **⋮** menu on each linked project inside the panel
- **Copy Obsidian URI** / **Copy wiki link**
- **Synced bindings** via `persistDataSynced`
- **Safe paths** — only vault-relative paths; absolute paths and `..` are rejected

> Super Productivity does not currently allow plugins to inject items into the project **⋮** work-context menu in the app chrome. The closest supported entry points are the project header buttons (next to that menu), the side panel / Panels menu (mobile), and the plugin menu entry **Link Obsidian page…**.

## How linking works

| What | Format |
| --- | --- |
| Stored binding | Vault-relative page, e.g. `Work/Elmec.md` |
| Open | `obsidian://open?vault=VaultName&file=Work%2FElmec` |
| Wiki link | `[[Work/Elmec]]` |

## Install

1. Download the plugin ZIP from the latest [GitHub Release](https://github.com/ItalianJoker/ObsidianConnector/releases)
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

### Mobile

1. Open **Obsidian Connector** from the **Panels** menu (or the plugin entry)
2. Enter the vault name
3. Choose an existing Super Productivity project
4. Type the vault-relative path of a page that already exists (e.g. `Work/Elmec.md`)
5. **Link to selected page**
6. **Open in Obsidian** uses `obsidian://open` with the Obsidian Mobile app

## Releases

| Version | Notes |
| --- | --- |
| [v1.2.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.2.0) | Existing pages only; mobile path entry; link-window entry points |
| [v1.1.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.1.0) | Browse vault folders |
| [v1.0.1](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.1) | Fix `[object Promise]` labels |
| [v1.0.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0) | First release |

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
