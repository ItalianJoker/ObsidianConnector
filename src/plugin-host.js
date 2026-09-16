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
    // Prefer the side panel when available; fall back to the full iframe view.
    if (typeof api.showIndexHtmlAsView === 'function') {
      api.showIndexHtmlAsView();
    }
  }

  async function openLinkWindow(context) {
    const ctx =
      context ||
      (typeof api.getActiveWorkContext === 'function'
        ? await api.getActiveWorkContext()
        : null);

    if (ctx && ctx.type === 'PROJECT') {
      api.showSnack({
        msg: t(
          'MSG.OPENING_LINK_WINDOW',
          'Open the Obsidian Connector panel to link "{{title}}" to an existing page.',
          { title: ctx.title || '' },
        ),
        type: 'INFO',
      });
    }
    openPanel();
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
      await openLinkWindow();
      return;
    }

    const state = await loadState();
    const binding = Core.getBinding(state, ctx.id);
    if (!binding) {
      api.showSnack({
        msg: t(
          'MSG.PROJECT_NOT_LINKED',
          'This project is not linked to an Obsidian page yet.',
        ),
        type: 'INFO',
      });
      await openLinkWindow(ctx);
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
        file: Core.bindingTarget(binding),
      }),
      type: 'SUCCESS',
      ico: 'menu_book',
    });
  }

  function boot() {
    // Side-nav / plugin menu entry — opens the link window.
    // Super Productivity does not yet let plugins inject into the project ⋮
    // work-context menu; this entry plus the header button are the supported
    // entry points (and on mobile the side-panel button appears in Panels).
    try {
      api.registerMenuEntry({
        label: t('MENU.LINK_PAGE', 'Link Obsidian page…'),
        icon: 'menu_book',
        onClick: () => {
          openLinkWindow();
        },
      });
    } catch {
      // Host may already add a default menu entry from the manifest.
    }

    try {
      api.registerMenuEntry({
        label: t('PLUGIN.NAME', 'Obsidian Connector'),
        icon: 'menu_book',
        onClick: openPanel,
      });
    } catch {
      // Ignore duplicate registration.
    }

    if (typeof api.registerConfigHandler === 'function') {
      api.registerConfigHandler(openPanel);
    }

    if (typeof api.registerShortcut === 'function') {
      api.registerShortcut({
        id: 'obsidian-connector-open-note',
        label: t('SHORTCUT.OPEN_LINKED_NOTE', 'Open linked Obsidian page'),
        onExec: () => {
          openLinkedNote();
        },
      });
      api.registerShortcut({
        id: 'obsidian-connector-open-panel',
        label: t('SHORTCUT.OPEN_PANEL', 'Open Obsidian Connector'),
        onExec: openPanel,
      });
      api.registerShortcut({
        id: 'obsidian-connector-link-page',
        label: t('SHORTCUT.LINK_PAGE', 'Link project to Obsidian page'),
        onExec: () => {
          openLinkWindow();
        },
      });
    }

    // Header button next to the project title actions (near the ⋮ menu).
    // Opens the linked page when set; otherwise opens the link window.
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
      // Second header action dedicated to opening the link window.
      try {
        api.registerWorkContextHeaderButton({
          label: t('HEADER.LINK_PAGE', 'Link Obsidian'),
          icon: 'link',
          showFor: ['PROJECT'],
          onClick: (ctx) => {
            openLinkWindow(ctx);
          },
        });
      } catch {
        // Older hosts may only allow one work-context header button.
      }
    } else if (typeof api.registerHeaderButton === 'function') {
      api.registerHeaderButton(headerCfg);
    }

    if (typeof api.registerSidePanelButton === 'function') {
      try {
        api.registerSidePanelButton({
          label: t('PLUGIN.NAME', 'Obsidian Connector'),
          icon: 'menu_book',
          onClick: openPanel,
        });
      } catch {
        // Manifest sidePanel may already register one.
      }
    }
  }

  if (typeof api.onReady === 'function') {
    api.onReady(boot);
  } else {
    boot();
  }
})();
