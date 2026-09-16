/* Host-side Super Productivity plugin. Concatenated after core.js. */
(function () {
  'use strict';

  const Core = globalThis.ObsidianConnectorCore;
  const api = globalThis.PluginAPI;

  if (!api || !Core) {
    return;
  }

  function t(key, fallback, params) {
    return Core.t(api, key, fallback, params);
  }

  async function loadState() {
    try {
      const raw = await api.loadSyncedData();
      return Core.parseState(raw);
    } catch {
      return Core.createEmptyState();
    }
  }

  function openPanel() {
    if (typeof api.showIndexHtmlAsView === 'function') {
      api.showIndexHtmlAsView();
    }
  }

  async function openLinkedNote(context) {
    const ctx =
      context ||
      (typeof api.getActiveWorkContext === 'function'
        ? await api.getActiveWorkContext()
        : null);

    if (!ctx || ctx.type !== 'PROJECT') {
      api.showSnack({
        msg: t(
          'MSG.NO_PROJECT_CONTEXT',
          'Open a project first, then try again.',
        ),
        type: 'INFO',
      });
      openPanel();
      return;
    }

    const state = await loadState();
    const binding = Core.getBinding(state, ctx.id);
    if (!binding) {
      api.showSnack({
        msg: t(
          'MSG.PROJECT_NOT_LINKED',
          'This project is not linked to an Obsidian file yet.',
        ),
        type: 'INFO',
      });
      openPanel();
      return;
    }

    const uri = Core.buildOpenUri(state, binding);
    const result = Core.openExternalUri(uri);
    if (!result.ok) {
      const copied = await Core.copyText(uri);
      api.showSnack({
        msg: copied
          ? t(
              'MSG.URI_COPIED',
              'Could not open Obsidian automatically. The URI was copied to the clipboard.',
            )
          : t('MSG.OPEN_FAILED', 'Could not open Obsidian. URI: ') + uri,
        type: copied ? 'INFO' : 'ERROR',
      });
      return;
    }

    api.showSnack({
      msg: t('MSG.OPENING_NOTE', 'Opening {{file}} in Obsidian…', {
        file: binding.filePath,
      }),
      type: 'SUCCESS',
      ico: 'menu_book',
    });
  }

  function boot() {
    try {
      api.registerMenuEntry({
        label: t('PLUGIN.NAME', 'Obsidian Connector'),
        icon: 'menu_book',
        onClick: openPanel,
      });
    } catch {
      // Host already added a default menu entry from the manifest.
    }

    if (typeof api.registerConfigHandler === 'function') {
      api.registerConfigHandler(openPanel);
    }

    if (typeof api.registerShortcut === 'function') {
      api.registerShortcut({
        id: 'obsidian-connector-open-note',
        label: t('SHORTCUT.OPEN_LINKED_NOTE', 'Open linked Obsidian note'),
        onExec: () => {
          openLinkedNote();
        },
      });
      api.registerShortcut({
        id: 'obsidian-connector-open-panel',
        label: t('SHORTCUT.OPEN_PANEL', 'Open Obsidian Connector'),
        onExec: openPanel,
      });
    }

    const headerCfg = {
      label: t('HEADER.OPEN_NOTE', 'Obsidian'),
      icon: 'menu_book',
      onClick: (ctx) => {
        openLinkedNote(ctx);
      },
    };

    if (typeof api.registerWorkContextHeaderButton === 'function') {
      api.registerWorkContextHeaderButton({
        ...headerCfg,
        showFor: ['PROJECT'],
      });
    } else if (typeof api.registerHeaderButton === 'function') {
      api.registerHeaderButton(headerCfg);
    }
  }

  if (typeof api.onReady === 'function') {
    api.onReady(boot);
  } else {
    boot();
  }
})();
