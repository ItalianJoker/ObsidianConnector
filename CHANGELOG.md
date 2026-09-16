# Changelog

All notable changes to Obsidian Connector are documented in this file.

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
