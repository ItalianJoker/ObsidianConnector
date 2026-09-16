# Changelog

All notable changes to Obsidian Connector are documented in this file.

## [1.2.0] - 2026-09-16

### Changed

- Link to **existing Obsidian pages** only. The plugin never creates a new Obsidian page (`obsidian://new` is unused) and never creates a Super Productivity project
- Desktop lists existing `.md` notes from the vault; mobile/web use a vault-relative path field for an existing page
- Opening still uses `obsidian://open` on desktop and mobile

### Added

- Mobile-friendly side panel layout and touch targets
- Plugin menu entry **Link Obsidian page…** and project header **Link Obsidian** to open the link window
- **⋮** actions menu on each linked project inside the panel (Open, Change page, Copy URI, Copy wiki, Unlink)

## [1.1.0] - 2026-09-16

### Changed

- Link existing Super Productivity projects to existing Obsidian **folders**. The plugin no longer suggests or creates notes, and it never creates a Super Productivity project
- Side panel lists every folder in the vault (desktop app, after allowing file access) so you can pick the matching folder
- Opening still uses `obsidian://open`, with the vault-relative folder as the `file` parameter
- Older note-file bindings (`Projects/Website.md`) migrate to the parent folder (`Projects`)

### Added

- Vault disk path setting and **Load folders**
- Folder search; folders that match the selected project title are listed first

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

[1.2.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.2.0
[1.1.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.1.0
[1.0.1]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.1
[1.0.0]: https://github.com/ItalianJoker/ObsidianConnector/releases/tag/v1.0.0
