# Obsidian Connector

A [Super Productivity](https://github.com/super-productivity/super-productivity) plugin that **links an existing Super Productivity project to an existing folder in your Obsidian vault**.

The plugin does **not** create Super Productivity projects and does **not** invent new notes. It lists the folders already in the vault so you can pick the one that matches the project.

Opening a link uses the **Obsidian URI protocol** (`obsidian://open`). It does **not** open a filesystem path (`/home/.../folder` or `file://`). The plugin stores a vault-relative folder such as `Work/Elmec`, then turns it into:

```text
obsidian://open?vault=WorkVault&file=Work%2FElmec
```

This is not task sync. Bindings stay as project → folder links. For checkbox sync, keep using `sync.md`.

## Features

- **Existing projects only** — choose from Super Productivity projects that already exist. The plugin never calls `addProject`
- **Vault folder browser** — set the vault folder on disk, then **Load folders** to list every folder in the vault (desktop app, with file access allowed)
- **Search and match** — filter the folder list; folders whose names match the selected project (for example `Elmec`) are listed first
- **Project ↔ folder binding** — attach each Super Productivity project to one existing vault folder
- **Open with `obsidian://open`** — launches that folder in Obsidian; if the vault name is empty, Obsidian uses the last used vault
- **Copy Obsidian URI** — copies the `obsidian://open?...` link
- **Copy wiki link** — copies `[[Work/Elmec]]`
- **Project header button** — **Obsidian** on the project view opens the linked folder
- **Side panel** — manage vault settings and all bindings from one panel
- **Keyboard shortcuts** — open the linked folder, or open the connector panel (bind keys in Super Productivity keyboard settings)
- **Synced bindings** — mappings persist with `persistDataSynced` and follow Super Productivity sync
- **Safe paths** — only vault-relative folders; absolute paths and `..` are rejected

## How linking works

| What | Format |
| --- | --- |
| Stored binding | Vault-relative folder, e.g. `Work/Elmec` |
| Open | `obsidian://open?vault=VaultName&file=Work%2FElmec` |
| Wiki link | `[[Work/Elmec]]` |

The `file` query parameter is the path inside the vault, URL-encoded. For a folder it is the folder path, not a `.md` file.

Listing folders uses `executeNodeScript` in the Super Productivity **desktop** app. Allow the plugin file-access prompt when Super Productivity asks. The web app cannot read your disk, so the folder list is desktop-only.

## Install

1. Download the plugin ZIP from the latest [GitHub Release](https://github.com/ItalianJoker/ObsidianConnector/releases)
2. In Super Productivity open **Settings → Plugins → Choose Plugin File**
3. Select the ZIP and enable the plugin
4. When Super Productivity asks to allow file access, allow it so the plugin can list vault folders

The ZIP has `manifest.json` at its root, as required by the plugin installer.

Requires Super Productivity **14.0.0** or later. Folder listing needs the desktop app. Obsidian must be installed on the same machine to open folders.

To build the ZIP locally: `npm run zip` (writes `dist/obsidian-connector.zip` and a versioned `dist/obsidian-connector-<version>.zip`).

## Usage

1. Open the **Obsidian Connector** panel (plugin menu / side panel)
2. Enter the **vault name** as it appears in Obsidian (usually the folder name)
3. Enter the **vault folder on this computer** (absolute path, e.g. `/home/you/Obsidian/Work`)
4. Click **Save**, then **Load folders**
5. Choose an existing Super Productivity project
6. Select the matching Obsidian folder from the list (use search if the vault is large)
7. Click **Link to selected folder**

When you are inside a linked project, the **Obsidian** header button opens that folder.

Older bindings that pointed at a `.md` note are migrated to the note’s parent folder.

## Releases

Release ZIPs are published on [GitHub Releases](https://github.com/ItalianJoker/ObsidianConnector/releases). Pushing a `v*` tag runs CI, packs the plugin, and creates the release.

| Version | Notes |
| --- | --- |
| [v1.1.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.1.0) | Browse vault folders and link existing projects (no create flow) |
| [v1.0.1](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.1) | Fix side-panel labels (`[object Promise]`) |
| [v1.0.0](https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0) | First release: project ↔ Obsidian note linking via `obsidian://` |

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Development

```bash
npm test
npm run zip
npm run harness   # UI preview at http://127.0.0.1:4173/
```

- `src/` — source (shared logic, host `plugin.js`, iframe UI)
- `plugin/` — packagable plugin files
- `test/` — Node tests for bindings, folder listing, and Obsidian URIs

The plugin uses APIs from [Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin) and [`docs/plugin-development.md`](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md): projects, synced persistence, snacks/dialogs, side panel, project header button, `executeNodeScript` (desktop folder listing), and `obsidian://` URIs.

## License

MIT
