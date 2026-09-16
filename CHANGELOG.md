# Changelog

All notable changes to Obsidian Connector are documented in this file.

## [1.0.1] - 2026-09-16

### Fixed

- Show real English labels in the side panel instead of `[object Promise]` (iframe `translate()` can return a Promise)

### Changed

- Shorter, clearer copy for vault settings and linking

## [1.0.0] - 2026-09-16

First release.

### Features

- Link a Super Productivity project to a vault-relative Markdown file
- Open the note with `obsidian://open` (not a filesystem path)
- Create the note with `obsidian://new` and Super Productivity frontmatter
- Copy the Obsidian URI or a `[[wiki]]` link
- Project header button, side panel, and keyboard shortcuts
- Synced bindings via `persistDataSynced`
- English UI

[1.0.1]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.1
[1.0.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0
