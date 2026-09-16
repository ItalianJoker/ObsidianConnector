# Obsidian Connector

A [Super Productivity](https://github.com/super-productivity/super-productivity) plugin that **links a Super Productivity project to a Markdown file in your Obsidian vault**.

Opening a link uses the **Obsidian URI protocol** (`obsidian://open` / `obsidian://new`). It does **not** open a filesystem path (`/home/.../note.md` or `file://`). The plugin stores a vault-relative path such as `Projects/Website.md`, then turns it into:

```text
obsidian://open?vault=WorkVault&file=Projects%2FWebsite
```

This is not task sync. Bindings stay as project → note links. For checkbox sync, keep using `sync.md`.

## Features

- **Vault settings** — set the Obsidian vault name (as shown in Obsidian) and a default folder such as `Projects`
- **Project ↔ note binding** — attach each Super Productivity project to a vault-relative Markdown file (`Projects/Website.md`)
- **Open with `obsidian://open`** — launches that note in Obsidian; if the vault name is empty, Obsidian uses the last used vault
- **Create with `obsidian://new`** — creates the note if it is missing, with YAML frontmatter (`super-productivity-id`, `super-productivity-project`); existing notes are not overwritten
- **Copy Obsidian URI** — copies the `obsidian://open?...` link
- **Copy wiki link** — copies `[[Projects/Website]]`
- **Project header button** — **Obsidian** on the project view opens the linked note
- **Side panel** — manage vault settings and all bindings from one panel
- **Keyboard shortcuts** — open the linked note, or open the connector panel (bind keys in Super Productivity keyboard settings)
- **Synced bindings** — mappings persist with `persistDataSynced` and follow Super Productivity sync
- **Safe paths** — only vault-relative paths; absolute paths and `..` are rejected
- **No disk access** — does not request `nodeExecution`; Obsidian resolves the file inside the vault

## How linking works

| What | Format |
| --- | --- |
| Stored binding | Vault-relative file path, e.g. `Projects/Website.md` |
| Open | `obsidian://open?vault=VaultName&file=Projects%2FWebsite` |
| Create note | `obsidian://new?vault=VaultName&file=Projects%2FWebsite&content=...` |
| Wiki link | `[[Projects/Website]]` |

The `file` query parameter is the path inside the vault, without the `.md` suffix, URL-encoded.

## Install

1. Download the plugin ZIP from the latest [GitHub Release](https://github.com/ItalianJoker/ObsidianConnector/releases)
2. In Super Productivity open **Settings → Plugins → Choose Plugin File**
3. Select the ZIP and enable the plugin

The ZIP has `manifest.json` at its root, as required by the plugin installer.

Requires Super Productivity **14.0.0** or later. Works on desktop and the web app. Obsidian must be installed on the same machine to open notes.

To build the ZIP locally: `npm run zip` (writes `dist/obsidian-connector.zip` and `dist/obsidian-connector-1.0.0.zip`).

## Usage

1. Open the **Obsidian Connector** panel (plugin menu / side panel)
2. Enter the **vault name** as it appears in Obsidian (usually the folder name)
3. Choose a Super Productivity project
4. Enter the vault-relative note path, or click **Suggest path**
5. Click **Link**

When you are inside a linked project, the **Obsidian** header button opens the note. **Create note** uses `obsidian://new`. If the note already exists, Obsidian opens it without overwriting.

## Releases

Release ZIPs are published on [GitHub Releases](https://github.com/ItalianJoker/ObsidianConnector/releases). Pushing a `v*` tag runs CI, packs the plugin, and creates the release.

| Version | Notes |
| --- | --- |
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
- `test/` — Node tests for bindings and Obsidian URIs

The plugin uses only APIs from [Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin) and [`docs/plugin-development.md`](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md): projects, synced persistence, snacks/dialogs, side panel, project header button, and `obsidian://` URIs.

## License

MIT
