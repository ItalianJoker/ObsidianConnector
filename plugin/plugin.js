/**
 * Shared, DOM-light helpers for the Obsidian Connector plugin.
 * Loaded in Node tests (CommonJS) and concatenated into plugin.js / index.html.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ObsidianConnectorCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_VERSION = 1;
  const DEFAULT_FOLDER = 'Projects';
  const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/g;

  function createEmptyState() {
    return {
      version: STORAGE_VERSION,
      vaultName: '',
      defaultFolder: DEFAULT_FOLDER,
      bindings: [],
    };
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function parseState(raw) {
    const empty = createEmptyState();
    if (raw == null || raw === '') {
      return empty;
    }

    let parsed = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return empty;
      }
    }
    if (!isPlainObject(parsed)) {
      return empty;
    }

    const vaultName = typeof parsed.vaultName === 'string' ? parsed.vaultName.trim() : '';
    const defaultFolder =
      typeof parsed.defaultFolder === 'string' && parsed.defaultFolder.trim()
        ? normalizeVaultFilePath(parsed.defaultFolder)
        : DEFAULT_FOLDER;

    const bindings = Array.isArray(parsed.bindings)
      ? parsed.bindings
          .map(normalizeBinding)
          .filter(Boolean)
      : [];

    const byProject = new Map();
    for (const binding of bindings) {
      byProject.set(binding.projectId, binding);
    }

    return {
      version: STORAGE_VERSION,
      vaultName,
      defaultFolder,
      bindings: Array.from(byProject.values()),
    };
  }

  function normalizeBinding(binding) {
    if (!isPlainObject(binding)) {
      return null;
    }
    const projectId = typeof binding.projectId === 'string' ? binding.projectId.trim() : '';
    if (!projectId) {
      return null;
    }
    const filePath = normalizeVaultFilePath(binding.filePath);
    if (!filePath) {
      return null;
    }
    const createdAt =
      typeof binding.createdAt === 'number' && Number.isFinite(binding.createdAt)
        ? binding.createdAt
        : Date.now();
    const updatedAt =
      typeof binding.updatedAt === 'number' && Number.isFinite(binding.updatedAt)
        ? binding.updatedAt
        : createdAt;
    return { projectId, filePath, createdAt, updatedAt };
  }

  function serializeState(state) {
    return JSON.stringify(parseState(state));
  }

  /**
   * Vault-relative path: forward slashes, no leading slash, no `..` segments.
   * Keeps a trailing `.md` if the user provided one.
   */
  function normalizeVaultFilePath(filePath) {
    if (typeof filePath !== 'string') {
      return '';
    }
    let path = filePath.trim().replace(/\\/g, '/');
    if (!path) {
      return '';
    }
    if (/^[a-zA-Z]:/.test(path) || path.startsWith('//')) {
      return '';
    }
    path = path.replace(/^\/+/, '');
    const parts = [];
    for (const part of path.split('/')) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        return '';
      }
      parts.push(part);
    }
    return parts.join('/');
  }

  function validateFilePath(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return {
        ok: false,
        message:
          'Enter a vault-relative path such as Projects/My note.md (no absolute paths or ..).',
      };
    }
    return { ok: true, path: normalized };
  }

  function stripMarkdownExtension(filePath) {
    return String(filePath || '').replace(/\.md$/i, '');
  }

  function withMarkdownExtension(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return '';
    }
    return /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
  }

  function sanitizeNoteTitle(title) {
    const cleaned = String(title || '')
      .trim()
      .replace(ILLEGAL_NAME_CHARS, '-')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .replace(/^\.+$/, '')
      .replace(/[. ]+$/g, '');
    return cleaned || 'Untitled';
  }

  function suggestFilePath(projectTitle, defaultFolder) {
    const folder = normalizeVaultFilePath(defaultFolder || DEFAULT_FOLDER);
    const name = `${sanitizeNoteTitle(projectTitle)}.md`;
    return folder ? `${folder}/${name}` : name;
  }

  function wikiLink(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return '';
    }
    return `[[${stripMarkdownExtension(normalized)}]]`;
  }

  function queryString(params) {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') {
        continue;
      }
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.join('&');
  }

  function buildOpenUri(state, binding) {
    const filePath = normalizeVaultFilePath(binding && binding.filePath);
    if (!filePath) {
      return null;
    }
    const vaultName = (state && state.vaultName) || '';
    return `obsidian://open?${queryString({
      vault: vaultName,
      file: stripMarkdownExtension(filePath),
    })}`;
  }

  function noteTemplate({ projectId, projectTitle }) {
    const title = projectTitle || 'Untitled project';
    return [
      '---',
      `super-productivity-id: ${projectId || ''}`,
      `super-productivity-project: ${title}`,
      '---',
      '',
      `# ${title}`,
      '',
      'This note is linked to a Super Productivity project.',
      '',
    ].join('\n');
  }

  function buildNewUri(state, binding, project) {
    const filePath = normalizeVaultFilePath(binding && binding.filePath);
    if (!filePath) {
      return null;
    }
    const vaultName = (state && state.vaultName) || '';
    const content = noteTemplate({
      projectId: binding.projectId || (project && project.id),
      projectTitle: (project && project.title) || stripMarkdownExtension(filePath),
    });
    return `obsidian://new?${queryString({
      vault: vaultName,
      file: stripMarkdownExtension(filePath),
      content,
    })}`;
  }

  function getBinding(state, projectId) {
    if (!state || !projectId) {
      return null;
    }
    return state.bindings.find((binding) => binding.projectId === projectId) || null;
  }

  function upsertBinding(state, projectId, filePath, now) {
    const next = parseState(state);
    const validated = validateFilePath(filePath);
    if (!projectId || !validated.ok) {
      return { ok: false, state: next, message: validated.message || 'Missing project.' };
    }
    const timestamp = typeof now === 'number' ? now : Date.now();
    const existing = getBinding(next, projectId);
    const binding = {
      projectId,
      filePath: validated.path,
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp,
    };
    next.bindings = next.bindings.filter((item) => item.projectId !== projectId);
    next.bindings.push(binding);
    next.bindings.sort((a, b) => a.filePath.localeCompare(b.filePath));
    return { ok: true, state: next, binding };
  }

  function removeBinding(state, projectId) {
    const next = parseState(state);
    next.bindings = next.bindings.filter((item) => item.projectId !== projectId);
    return next;
  }

  function updateVaultSettings(state, { vaultName, defaultFolder }) {
    const next = parseState(state);
    if (typeof vaultName === 'string') {
      next.vaultName = vaultName.trim();
    }
    if (typeof defaultFolder === 'string') {
      const folder = normalizeVaultFilePath(defaultFolder);
      next.defaultFolder = folder || DEFAULT_FOLDER;
    }
    return next;
  }

  function visibleProjects(projects) {
    return (projects || []).filter((project) => project && !project.isArchived && !project.isHiddenFromMenu);
  }

  function openExternalUri(uri) {
    if (!uri || typeof uri !== 'string') {
      return { ok: false, uri: '', copied: false };
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { ok: false, uri, copied: false };
    }

    try {
      const opened = window.open(uri, '_blank');
      if (opened) {
        return { ok: true, uri, copied: false };
      }
    } catch {
      // fall through
    }

    try {
      const anchor = document.createElement('a');
      anchor.href = uri;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return { ok: true, uri, copied: false };
    } catch {
      // fall through
    }

    return { ok: false, uri, copied: false };
  }

  async function copyText(text) {
    if (text == null) {
      return false;
    }
    const value = String(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // fall through
      }
    }
    if (typeof document === 'undefined') {
      return false;
    }
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  function t(api, key, fallback, params) {
    try {
      if (api && typeof api.translate === 'function') {
        const translated = api.translate(key, params);
        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch {
      // fall through
    }
    if (fallback && params) {
      return String(fallback).replace(/\{\{(\w+)\}\}/g, (_, name) =>
        params[name] == null ? '' : String(params[name]),
      );
    }
    return fallback || key;
  }

  return {
    STORAGE_VERSION,
    DEFAULT_FOLDER,
    createEmptyState,
    parseState,
    serializeState,
    normalizeVaultFilePath,
    validateFilePath,
    stripMarkdownExtension,
    withMarkdownExtension,
    sanitizeNoteTitle,
    suggestFilePath,
    wikiLink,
    buildOpenUri,
    buildNewUri,
    noteTemplate,
    getBinding,
    upsertBinding,
    removeBinding,
    updateVaultSettings,
    visibleProjects,
    openExternalUri,
    copyText,
    t,
  };
});

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

