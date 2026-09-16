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

  const STORAGE_VERSION = 2;
  const DEFAULT_FOLDER = 'Projects';
  const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/g;
  const SKIP_VAULT_DIRS = ['.obsidian', '.trash', '.git', 'node_modules'];

  function createEmptyState() {
    return {
      version: STORAGE_VERSION,
      vaultName: '',
      vaultPath: '',
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
    const vaultPath = normalizeVaultRootPath(parsed.vaultPath);
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
      vaultPath,
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
    const folderPath = folderPathFromBinding(binding);
    if (folderPath == null) {
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
    return {
      projectId,
      folderPath,
      filePath: folderPath,
      createdAt,
      updatedAt,
    };
  }

  function folderPathFromBinding(binding) {
    const raw =
      typeof binding.folderPath === 'string'
        ? binding.folderPath
        : typeof binding.filePath === 'string'
          ? binding.filePath
          : null;
    if (raw == null) {
      return null;
    }
    const filePath = normalizeVaultFilePath(raw);
    if (raw.trim() && !filePath) {
      return null;
    }
    if (/\.md$/i.test(filePath)) {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/');
    }
    return filePath;
  }

  function bindingTarget(binding) {
    if (!binding) {
      return '';
    }
    const migrated = folderPathFromBinding(binding);
    return migrated == null ? '' : migrated;
  }

  /**
   * Absolute path to the vault folder on disk (desktop). Empty if unset.
   */
  function normalizeVaultRootPath(filePath) {
    if (typeof filePath !== 'string') {
      return '';
    }
    let path = filePath.trim().replace(/\\/g, '/');
    if (!path) {
      return '';
    }
    if (path.startsWith('//')) {
      return '';
    }
    const isWindows = /^[a-zA-Z]:\//.test(path);
    const isPosix = path.startsWith('/');
    if (!isWindows && !isPosix) {
      return '';
    }
    return path.replace(/\/+$/, '');
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
          'Choose an existing folder inside the vault (no absolute paths or ..).',
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
    if (!binding) {
      return null;
    }
    const target = bindingTarget(binding);
    const vaultName = (state && state.vaultName) || '';
    return `obsidian://open?${queryString({
      vault: vaultName,
      file: stripMarkdownExtension(target),
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

  function asFolderPath(folderPath) {
    if (folderPath == null || String(folderPath).trim() === '') {
      return { ok: true, path: '' };
    }
    const validated = validateFilePath(folderPath);
    if (!validated.ok) {
      return validated;
    }
    let path = validated.path;
    if (/\.md$/i.test(path)) {
      const parts = path.split('/');
      parts.pop();
      path = parts.join('/');
    }
    return { ok: true, path };
  }

  function upsertBinding(state, projectId, folderPath, now) {
    const next = parseState(state);
    if (!projectId) {
      return { ok: false, state: next, message: 'Choose an existing Super Productivity project.' };
    }
    const validated = asFolderPath(folderPath);
    if (!validated.ok) {
      return { ok: false, state: next, message: validated.message };
    }
    const path = validated.path;
    const timestamp = typeof now === 'number' ? now : Date.now();
    const existing = getBinding(next, projectId);
    const binding = {
      projectId,
      folderPath: path,
      filePath: path,
      createdAt: existing ? existing.createdAt : timestamp,
      updatedAt: timestamp,
    };
    next.bindings = next.bindings.filter((item) => item.projectId !== projectId);
    next.bindings.push(binding);
    next.bindings.sort((a, b) => a.folderPath.localeCompare(b.folderPath));
    return { ok: true, state: next, binding };
  }

  function removeBinding(state, projectId) {
    const next = parseState(state);
    next.bindings = next.bindings.filter((item) => item.projectId !== projectId);
    return next;
  }

  function updateVaultSettings(state, { vaultName, vaultPath, defaultFolder }) {
    const next = parseState(state);
    if (typeof vaultName === 'string') {
      next.vaultName = vaultName.trim();
    }
    if (typeof vaultPath === 'string') {
      next.vaultPath = normalizeVaultRootPath(vaultPath);
    }
    if (typeof defaultFolder === 'string') {
      const folder = normalizeVaultFilePath(defaultFolder);
      next.defaultFolder = folder || DEFAULT_FOLDER;
    }
    return next;
  }

  function rankFolder(folderPath, projectTitle) {
    if (!projectTitle) {
      return 0;
    }
    const hay = String(folderPath || '').toLowerCase();
    const title = String(projectTitle).toLowerCase().trim();
    if (!title) {
      return 0;
    }
    const leaf = hay.split('/').pop() || hay;
    if (leaf === title || hay === title) {
      return 5;
    }
    if (leaf.includes(title) || hay.endsWith('/' + title)) {
      return 4;
    }
    if (hay.includes(title)) {
      return 3;
    }
    const words = title.split(/[^a-z0-9]+/i).filter((word) => word.length > 2);
    if (!words.length) {
      return 0;
    }
    const hits = words.filter((word) => hay.includes(word)).length;
    return hits ? 1 + hits / words.length : 0;
  }

  function filterFolders(folders, query, projectTitle) {
    const list = Array.isArray(folders) ? folders.slice() : [];
    const needle = String(query || '').trim().toLowerCase();
    const filtered = needle
      ? list.filter((folder) => {
          const path = typeof folder === 'string' ? folder : folder && folder.path;
          const name = typeof folder === 'string' ? folder : folder && folder.name;
          return (
            String(path || '')
              .toLowerCase()
              .includes(needle) ||
            String(name || '')
              .toLowerCase()
              .includes(needle)
          );
        })
      : list;
    filtered.sort((a, b) => {
      const pathA = typeof a === 'string' ? a : a.path || '';
      const pathB = typeof b === 'string' ? b : b.path || '';
      const rank = rankFolder(pathB, projectTitle) - rankFolder(pathA, projectTitle);
      if (rank !== 0) {
        return rank;
      }
      return pathA.localeCompare(pathB);
    });
    return filtered;
  }

  function listVaultFoldersScript(vaultRoot) {
    const root = normalizeVaultRootPath(vaultRoot);
    return `
const fs = require('fs');
const path = require('path');
const root = path.resolve(${JSON.stringify(root)});
if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error('Vault folder not found');
}
const skip = new Set(${JSON.stringify(SKIP_VAULT_DIRS)});
const folders = [{ path: '', name: '(vault root)' }];
function walk(dir, rel, depth) {
  if (depth > 8 || folders.length >= 1500) {
    return;
  }
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const name of names) {
    if (!name || name.charAt(0) === '.' || skip.has(name)) {
      continue;
    }
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch (e) {
      continue;
    }
    if (!st.isDirectory()) {
      continue;
    }
    const relative = rel ? rel + '/' + name : name;
    folders.push({ path: relative.replace(/\\\\/g, '/'), name: name });
    walk(full, relative, depth + 1);
  }
}
walk(root, '', 0);
return folders;
`;
  }

  function parseNodeFolderResult(result) {
    if (!result || result.success === false) {
      const error =
        (result && result.error && result.error.message) ||
        (result && result.error) ||
        'Could not read the vault folder.';
      return { ok: false, folders: [], error: String(error) };
    }
    const raw = result.result;
    if (!Array.isArray(raw)) {
      return { ok: false, folders: [], error: 'Unexpected folder list from the desktop app.' };
    }
    const folders = raw
      .map((item) => {
        if (typeof item === 'string') {
          return { path: normalizeVaultFilePath(item), name: item.split('/').pop() || item };
        }
        if (item && typeof item === 'object') {
          const folderPath = normalizeVaultFilePath(item.path || '');
          const name = typeof item.name === 'string' && item.name ? item.name : folderPath.split('/').pop() || '(vault root)';
          return { path: folderPath, name };
        }
        return null;
      })
      .filter(Boolean);
    return { ok: true, folders, error: '' };
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

  function interpolate(template, params) {
    if (template == null) {
      return '';
    }
    const text = String(template);
    if (!params) {
      return text;
    }
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      params[name] == null ? '' : String(params[name]),
    );
  }

  function t(api, key, fallback, params) {
    try {
      if (api && typeof api.translate === 'function') {
        const translated = api.translate(key, params);
        // Super Productivity's iframe translate() can return a Promise.
        // Never write that into the DOM — it becomes "[object Promise]".
        if (typeof translated === 'string' && translated && translated !== key) {
          return interpolate(translated, params);
        }
      }
    } catch {
      // fall through to the English fallback
    }
    return interpolate(fallback || key, params);
  }

  return {
    STORAGE_VERSION,
    DEFAULT_FOLDER,
    SKIP_VAULT_DIRS,
    createEmptyState,
    parseState,
    serializeState,
    normalizeVaultFilePath,
    normalizeVaultRootPath,
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
    bindingTarget,
    asFolderPath,
    upsertBinding,
    removeBinding,
    updateVaultSettings,
    visibleProjects,
    filterFolders,
    rankFolder,
    listVaultFoldersScript,
    parseNodeFolderResult,
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
          'This project is not linked to an Obsidian folder yet.',
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
        file: Core.bindingTarget(binding) || t('UI.VAULT_ROOT', '(vault root)'),
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
        label: t('SHORTCUT.OPEN_LINKED_NOTE', 'Open linked Obsidian folder'),
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

