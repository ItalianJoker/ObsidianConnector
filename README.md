# Obsidian Connector

A [Super Productivity](https://github.com/super-productivity/super-productivity) plugin that **links a project to a file in your Obsidian vault**.

It does not sync tasks. It stores a stable project → note mapping, then opens that note in Obsidian with `obsidian://open`. For checkbox sync, keep using `sync.md`.

## Features

- Set the Obsidian **vault name**
- Link each Super Productivity project to a vault-relative Markdown file, for example `Projects/Website.md`
- Open the note from a project header button, a shortcut, or the side panel
- Create the note in the vault if it does not exist yet (`obsidian://new`)
- Copy the Obsidian URI or a `[[Projects/Website]]` wiki link

## Install

1. Download `dist/obsidian-connector.zip` (or run `npm run zip` in this repo)
2. In Super Productivity open **Settings → Plugins → Choose Plugin File**
3. Select the ZIP and enable the plugin

The ZIP has `manifest.json` at its root, as required by the plugin installer.

Requires Super Productivity **14.0.0** or later. Works on desktop and the web app. Obsidian must be installed on the same machine to open notes.

## Usage

1. Open the **Obsidian Connector** panel (plugin menu / side panel)
2. Enter the **vault name** as it appears in Obsidian (usually the folder name)
3. Choose a Super Productivity project
4. Enter the vault-relative note path, or click **Suggest path**
5. Click **Link**

When you are inside a linked project, the **Obsidian** header button opens the note. **Create note** uses `obsidian://new` and writes frontmatter with the Super Productivity project id. If the note already exists, Obsidian opens it without overwriting.

You can leave the vault name empty: Obsidian then opens the most recently used vault.

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

It does not request `nodeExecution` and does not read the disk. The note path is vault-relative and Obsidian opens it.

## License

MIT
