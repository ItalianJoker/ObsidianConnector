/**
 * Shared helpers for the Obsidian Connector plugin.
 * Used by Node tests (CommonJS) and concatenated into plugin.js / index.html.
 *
 * Linking model: existing Super Productivity project → existing Obsidian page.
 * Opening uses obsidian://open only. This module does not create pages or projects.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ObsidianConnectorCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_VERSION = 3;
  /** Kept in persisted state for older installs; not used by the page-link UI. */
  const DEFAULT_FOLDER = 'Projects';
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

  function getPlatform(api) {
    const platform =
      api && api.cfg && typeof api.cfg.platform === 'string' ? api.cfg.platform : '';
    return platform || 'web';
  }

  function isDesktopPlatform(api) {
    return getPlatform(api) === 'desktop';
  }

  function isMobilePlatform(api) {
    const platform = getPlatform(api);
    return platform === 'android' || platform === 'ios';
  }

  /** True when the host can list vault files via executeNodeScript (desktop only). */
  function canBrowseVault(api) {
    return isDesktopPlatform(api) && typeof (api && api.executeNodeScript) === 'function';
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Parse persisted plugin JSON into a normalized state object.
   * @param {unknown} raw
   * @returns {{ version: number, vaultName: string, vaultPath: string, defaultFolder: string, bindings: object[] }}
   */
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
      ? parsed.bindings.map(normalizeBinding).filter(Boolean)
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
    const filePath = notePathFromBinding(binding);
    if (filePath == null) {
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
      filePath,
      folderPath: isNoteTarget(filePath) ? parentFolderOf(filePath) : filePath,
      createdAt,
      updatedAt,
    };
  }

  function parentFolderOf(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return '';
    }
    const parts = normalized.split('/');
    if (parts.length <= 1) {
      return '';
    }
    parts.pop();
    return parts.join('/');
  }

  /**
   * Vault-relative target for a binding.
   * Prefers an existing note path; keeps legacy folder-only bindings openable.
   */
  function notePathFromBinding(binding) {
    if (!isPlainObject(binding)) {
      return null;
    }
    const rawFile = typeof binding.filePath === 'string' ? binding.filePath : null;
    const rawFolder = typeof binding.folderPath === 'string' ? binding.folderPath : null;

    if (rawFile != null && rawFile.trim()) {
      const filePath = normalizeVaultFilePath(rawFile);
      if (!filePath) {
        return null;
      }
      if (/\.md$/i.test(filePath)) {
        return withMarkdownExtension(filePath);
      }
      const folder = rawFolder != null ? normalizeVaultFilePath(rawFolder) : null;
      // v1.1 stored folder bindings with filePath === folderPath (no .md).
      if (folder != null && folder === filePath) {
        return filePath;
      }
      return withMarkdownExtension(filePath);
    }

    if (rawFolder != null) {
      const folder = normalizeVaultFilePath(rawFolder);
      if (rawFolder.trim() && !folder) {
        return null;
      }
      return folder;
    }
    return null;
  }

  function isNoteTarget(path) {
    return /\.md$/i.test(String(path || ''));
  }

  function bindingTarget(binding) {
    if (!binding) {
      return '';
    }
    const target = notePathFromBinding(binding);
    return target == null ? '' : target;
  }

  /** Absolute path to the vault folder on disk (desktop). Empty if unset. */
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
   * Keeps a trailing `.md` when present. Returns `''` for unsafe paths.
   * @param {unknown} filePath
   * @returns {string}
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
        message: 'Choose an existing page inside the vault (no absolute paths or ..).',
      };
    }
    return { ok: true, path: normalized };
  }

  /** Normalize and require a vault-relative note path (adds .md when missing). */
  function validateExistingNotePath(filePath) {
    const validated = validateFilePath(filePath);
    if (!validated.ok) {
      return validated;
    }
    return { ok: true, path: withMarkdownExtension(validated.path) };
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

  function wikiLink(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return '';
    }
    return `[[${stripMarkdownExtension(normalized)}]]`;
  }

  /**
   * Build an `application/x-www-form-urlencoded` query with encodeURIComponent
   * on every key and value. Empty values are omitted.
   * @param {Record<string, string|number|null|undefined>} params
   * @returns {string}
   */
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

  /**
   * Build `obsidian://open` for an existing binding. Never uses `obsidian://new`.
   * Vault and file params are always encodeURIComponent'd.
   * @param {{ vaultName?: string }|null} state
   * @param {{ filePath?: string, folderPath?: string }|null} binding
   * @returns {string|null}
   */
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

  /**
   * True when `uri` is a plugin-built `obsidian://open?…` (encoded query only).
   * @param {unknown} uri
   * @returns {boolean}
   */
  function isSafeObsidianOpenUri(uri) {
    return typeof uri === 'string' && /^obsidian:\/\/open\?[A-Za-z0-9\-_.!~*'()%&=+]*$/.test(uri);
  }

  function getBinding(state, projectId) {
    if (!state || !projectId) {
      return null;
    }
    return state.bindings.find((binding) => binding.projectId === projectId) || null;
  }

  /**
   * Bind an existing Super Productivity project to an existing vault-relative page.
   * @returns {{ ok: boolean, state: object, binding?: object, message?: string }}
   */
  function upsertBinding(state, projectId, filePath, now) {
    const next = parseState(state);
    if (!projectId) {
      return {
        ok: false,
        state: next,
        message: 'Choose an existing Super Productivity project.',
      };
    }
    const validated = validateExistingNotePath(filePath);
    if (!validated.ok) {
      return { ok: false, state: next, message: validated.message };
    }
    const path = validated.path;
    const timestamp = typeof now === 'number' ? now : Date.now();
    const existing = getBinding(next, projectId);
    const binding = {
      projectId,
      filePath: path,
      folderPath: parentFolderOf(path),
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

  function rankPath(pathValue, projectTitle) {
    if (!projectTitle) {
      return 0;
    }
    const hay = String(pathValue || '').toLowerCase();
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

  function rankPage(pagePath, projectTitle) {
    return rankPath(stripMarkdownExtension(pagePath), projectTitle);
  }

  /**
   * Filter/search existing pages and rank likely project-name matches first.
   * @param {Array<string|{path?: string, name?: string}>} pages
   * @param {string} query
   * @param {string} [projectTitle]
   * @returns {Array<string|{path?: string, name?: string}>}
   */
  function filterPages(pages, query, projectTitle) {
    const list = Array.isArray(pages) ? pages.slice() : [];
    const needle = String(query || '').trim().toLowerCase();
    const filtered = needle
      ? list.filter((page) => {
          const path = typeof page === 'string' ? page : page && page.path;
          const name = typeof page === 'string' ? page : page && page.name;
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
      const rank = rankPage(pathB, projectTitle) - rankPage(pathA, projectTitle);
      if (rank !== 0) {
        return rank;
      }
      return pathA.localeCompare(pathB);
    });
    return filtered;
  }

  /**
   * Debounce `fn` by `waitMs` (default 150). `.cancel()` clears a pending call.
   * @template {(...args: any[]) => void} F
   * @param {F} fn
   * @param {number} [waitMs]
   * @returns {F & { cancel: () => void }}
   */
  function debounce(fn, waitMs) {
    const wait = typeof waitMs === 'number' && waitMs >= 0 ? waitMs : 150;
    let timer = 0;
    const wrapped = function debounced() {
      const ctx = this;
      const args = arguments;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = 0;
        fn.apply(ctx, args);
      }, wait);
    };
    wrapped.cancel = function cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    return wrapped;
  }

  /**
   * Filter linked bindings by project title or vault-relative path.
   * @param {Array<{projectId: string, filePath?: string, folderPath?: string}>} bindings
   * @param {string} query
   * @param {(projectId: string) => string} [titleOf]
   * @returns {Array<object>}
   */
  function filterBindings(bindings, query, titleOf) {
    const list = Array.isArray(bindings) ? bindings.slice() : [];
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
      return list;
    }
    return list.filter((binding) => {
      const title = typeof titleOf === 'function' ? titleOf(binding.projectId) : '';
      const path = bindingTarget(binding);
      return (
        String(title || '')
          .toLowerCase()
          .includes(needle) ||
        String(path || '')
          .toLowerCase()
          .includes(needle) ||
        String(binding.projectId || '')
          .toLowerCase()
          .includes(needle)
      );
    });
  }

  function pagePathOf(page) {
    if (typeof page === 'string') {
      return withMarkdownExtension(page);
    }
    if (page && typeof page === 'object') {
      return withMarkdownExtension(page.path || page.name || '');
    }
    return '';
  }

  /**
   * Parse vault-relative `.md` paths into a sorted folder → file tree.
   * @param {Array<string|{path?: string, name?: string}>} pages
   * @returns {{ type: 'folder', name: string, path: string, children: Array<object> }}
   */
  function buildNoteTree(pages) {
    const root = { type: 'folder', name: '', path: '', children: [] };
    const folders = new Map([['', root]]);

    for (const page of Array.isArray(pages) ? pages : []) {
      const notePath = pagePathOf(page);
      if (!notePath) {
        continue;
      }
      const parts = notePath.split('/');
      let parentPath = '';
      for (let i = 0; i < parts.length - 1; i += 1) {
        const name = parts[i];
        const folderPath = parentPath ? `${parentPath}/${name}` : name;
        if (!folders.has(folderPath)) {
          const node = { type: 'folder', name, path: folderPath, children: [] };
          folders.get(parentPath).children.push(node);
          folders.set(folderPath, node);
        }
        parentPath = folderPath;
      }
      const fileName = parts[parts.length - 1];
      folders.get(parentPath).children.push({
        type: 'file',
        name: stripMarkdownExtension(fileName),
        path: notePath,
      });
    }

    function sortNode(node) {
      if (!node.children) {
        return;
      }
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNode);
    }
    sortNode(root);
    return root;
  }

  /**
   * Ancestor folder paths of a vault-relative file (root omitted).
   * @param {string} filePath
   * @returns {string[]}
   */
  function ancestorFolderPaths(filePath) {
    const normalized = normalizeVaultFilePath(filePath);
    if (!normalized) {
      return [];
    }
    const parts = normalized.split('/');
    parts.pop();
    const out = [];
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      out.push(acc);
    }
    return out;
  }

  function expandAllFolders(node, expanded) {
    if (!node || node.type !== 'folder') {
      return;
    }
    if (node.path) {
      expanded.add(node.path);
    }
    for (const child of node.children || []) {
      expandAllFolders(child, expanded);
    }
  }

  /**
   * Filter a note tree by name/path. Matching folder branches are returned
   * and listed in `expanded` so the UI can auto-open them.
   * @param {object} root
   * @param {string} query
   * @returns {{ tree: object, expanded: Set<string> }}
   */
  function filterNoteTree(root, query) {
    const empty = root && typeof root === 'object'
      ? root
      : { type: 'folder', name: '', path: '', children: [] };
    const needle = String(query || '').trim().toLowerCase();
    const expanded = new Set();
    if (!needle) {
      return { tree: empty, expanded };
    }

    function visit(node) {
      if (!node) {
        return null;
      }
      if (node.type === 'file') {
        const path = String(node.path || '').toLowerCase();
        const name = String(node.name || '').toLowerCase();
        return path.includes(needle) || name.includes(needle) ? node : null;
      }
      const kept = [];
      for (const child of node.children || []) {
        const next = visit(child);
        if (next) {
          kept.push(next);
        }
      }
      if (kept.length) {
        if (node.path) {
          expanded.add(node.path);
        }
        return { type: 'folder', name: node.name, path: node.path, children: kept };
      }
      if (node.name && String(node.name).toLowerCase().includes(needle)) {
        expandAllFolders(node, expanded);
        return node;
      }
      return null;
    }

    const filtered = visit(empty);
    return {
      tree: filtered || { type: 'folder', name: '', path: '', children: [] },
      expanded,
    };
  }

  /**
   * Visible tree rows only — children of collapsed folders are omitted (lazy DOM).
   * @param {object} root
   * @param {Set<string>|string[]} expanded
   * @returns {Array<{type: string, name: string, path: string, depth: number}>}
   */
  function flattenVisibleTree(root, expanded) {
    const open = expanded instanceof Set ? expanded : new Set(expanded || []);
    const rows = [];
    function walk(nodes, depth) {
      for (const node of nodes || []) {
        rows.push({
          type: node.type,
          name: node.name,
          path: node.path,
          depth,
        });
        if (node.type === 'folder' && open.has(node.path) && node.children) {
          walk(node.children, depth + 1);
        }
      }
    }
    walk((root && root.children) || [], 0);
    return rows;
  }

  /**
   * Lightweight vault config check for UI warnings.
   * @param {object} state
   * @param {{ requirePath?: boolean }} [opts]
   * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
   */
  function vaultConfigStatus(state, opts) {
    const requirePath = !!(opts && opts.requirePath);
    const errors = [];
    const warnings = [];
    const vaultName =
      state && typeof state.vaultName === 'string' ? state.vaultName.trim() : '';
    const vaultPath = state ? normalizeVaultRootPath(state.vaultPath) : '';

    if (requirePath && !vaultPath) {
      errors.push(
        'Vault folder path is missing or invalid. Enter an absolute path to the vault on this computer.',
      );
    }
    if (!vaultName) {
      warnings.push('Vault name is empty. Obsidian will open the last-used vault.');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  /**
   * Node script string for executeNodeScript: list existing .md pages under the vault.
   * Does not create files.
   */
  function listVaultPagesScript(vaultRoot) {
    const root = normalizeVaultRootPath(vaultRoot);
    return `
const fs = require('fs');
const path = require('path');
const root = path.resolve(${JSON.stringify(root)});
if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error('Vault folder not found');
}
const skip = new Set(${JSON.stringify(SKIP_VAULT_DIRS)});
const pages = [];
function walk(dir, rel, depth) {
  if (depth > 10 || pages.length >= 5000) {
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
    if (st.isDirectory()) {
      const relative = rel ? rel + '/' + name : name;
      walk(full, relative, depth + 1);
      continue;
    }
    if (!st.isFile() || !/\\.md$/i.test(name)) {
      continue;
    }
    const relative = rel ? rel + '/' + name : name;
    pages.push({
      path: relative.replace(/\\\\/g, '/'),
      name: name.replace(/\\.md$/i, ''),
    });
  }
}
walk(root, '', 0);
return pages;
`;
  }

  /** Parse executeNodeScript results into { ok, pages, error }. */
  function parseNodePageResult(result) {
    if (!result || result.success === false) {
      const error =
        (result && result.error && result.error.message) ||
        (result && result.error) ||
        'Could not read the vault folder.';
      return { ok: false, pages: [], error: String(error) };
    }
    const raw = result.result;
    if (!Array.isArray(raw)) {
      return {
        ok: false,
        pages: [],
        error: 'Unexpected page list from the desktop app.',
      };
    }

    const pages = [];
    for (const item of raw) {
      let pathValue = '';
      let name = '';
      if (typeof item === 'string') {
        pathValue = normalizeVaultFilePath(item);
        name = item.split('/').pop() || item;
      } else if (item && typeof item === 'object') {
        pathValue = normalizeVaultFilePath(item.path || '');
        name =
          typeof item.name === 'string' && item.name
            ? item.name
            : pathValue.split('/').pop() || '';
      } else {
        continue;
      }
      if (!pathValue && !name) {
        continue;
      }
      const notePath = withMarkdownExtension(pathValue || name);
      if (!notePath) {
        continue;
      }
      pages.push({
        path: notePath,
        name: stripMarkdownExtension(name || notePath.split('/').pop() || notePath),
      });
    }
    return { ok: true, pages, error: '' };
  }

  function visibleProjects(projects) {
    return (projects || []).filter(
      (project) => project && !project.isArchived && !project.isHiddenFromMenu,
    );
  }

  /**
   * Node script for executeNodeScript: hand `obsidian://open` to the OS.
   * Prefers Electron `shell.openExternal` (starts Obsidian when it is closed)
   * and falls back to `open` / `xdg-open` / `cmd start`. Returns immediately.
   * @param {string} uri
   * @returns {string}
   */
  function openObsidianUriScript(uri) {
    return `
const uri = ${JSON.stringify(uri)};
if (!/^obsidian:\\/\\/open\\?/.test(uri)) {
  throw new Error('Refusing to open a non-obsidian URI');
}
try {
  const electron = require('electron');
  const shell = electron && (electron.shell || (electron.default && electron.default.shell));
  if (shell && typeof shell.openExternal === 'function') {
    const opened = shell.openExternal(uri);
    if (opened && typeof opened.then === 'function') {
      opened.catch(function () {});
    }
    return { ok: true, via: 'electron' };
  }
} catch (e) {}
const { spawn } = require('child_process');
const plat = process.platform;
let child;
if (plat === 'darwin') {
  child = spawn('open', [uri], { detached: true, stdio: 'ignore' });
} else if (plat === 'win32') {
  child = spawn('cmd', ['/c', 'start', '', uri], { detached: true, stdio: 'ignore' });
} else {
  child = spawn('xdg-open', [uri], { detached: true, stdio: 'ignore' });
}
if (child && typeof child.unref === 'function') {
  child.unref();
}
return { ok: true, via: 'os' };
`;
  }

  function tryHostOpenExternal(uri) {
    try {
      const ea = typeof window !== 'undefined' ? window.ea : null;
      if (ea && typeof ea.openExternalUrl === 'function') {
        ea.openExternalUrl(uri);
        return true;
      }
    } catch {
      // Host API not available (iframe / web).
    }
    return false;
  }

  function tryHiddenIframe(uri) {
    if (typeof document === 'undefined') {
      return false;
    }
    try {
      const frame = document.createElement('iframe');
      frame.setAttribute('hidden', '');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute';
      frame.src = uri;
      document.body.appendChild(frame);
      setTimeout(() => {
        if (frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      }, 2000);
      return true;
    } catch {
      return false;
    }
  }

  function tryProtocolAnchor(uri) {
    if (typeof document === 'undefined') {
      return false;
    }
    try {
      const anchor = document.createElement('a');
      anchor.href = uri;
      // No target=_blank: Electron treats that as a new BrowserWindow and
      // often fails to hand a custom protocol to the OS when the app is closed.
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }

  /** Delay before re-sending `obsidian://open` so a cold-started app can take the file. */
  const OPEN_RETRY_DELAY_MS = 2200;
  let pendingOpenRetry = 0;

  function cancelScheduledOpenRetry() {
    if (pendingOpenRetry) {
      clearTimeout(pendingOpenRetry);
      pendingOpenRetry = 0;
    }
  }

  /**
   * Fire the URI once. Does not schedule a retry.
   * @param {string} uri
   * @param {{ executeNodeScript?: Function }|null} [api]
   * @returns {Promise<{ok: boolean, uri: string, copied: boolean, via?: string}>}
   */
  async function dispatchOpenUri(uri, api) {
    if (!isSafeObsidianOpenUri(uri)) {
      return { ok: false, uri: typeof uri === 'string' ? uri : '', copied: false };
    }

    if (api && typeof api.executeNodeScript === 'function') {
      try {
        const result = await api.executeNodeScript({
          script: openObsidianUriScript(uri),
          timeout: 4000,
        });
        if (result && result.success) {
          return { ok: true, uri, copied: false, via: 'electron' };
        }
      } catch {
        // Node bridge unavailable or consent denied — try renderer fallbacks.
      }
    }

    if (tryHostOpenExternal(uri)) {
      return { ok: true, uri, copied: false, via: 'ea' };
    }

    if (tryHiddenIframe(uri)) {
      return { ok: true, uri, copied: false, via: 'iframe' };
    }

    if (tryProtocolAnchor(uri)) {
      return { ok: true, uri, copied: false, via: 'anchor' };
    }

    return { ok: false, uri, copied: false };
  }

  function scheduleOpenRetry(uri, api, delayMs) {
    cancelScheduledOpenRetry();
    const wait = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : OPEN_RETRY_DELAY_MS;
    pendingOpenRetry = setTimeout(() => {
      pendingOpenRetry = 0;
      dispatchOpenUri(uri, api);
    }, wait);
  }

  /**
   * Launch an `obsidian://open` URI without blocking the Super Productivity UI.
   * Desktop (most reliable cold-start): `executeNodeScript` → Electron
   * `shell.openExternal`, then `window.ea.openExternalUrl`.
   * Fallback: hidden iframe / in-place protocol link (no `window.open`).
   * After a successful first launch, re-sends the same encoded URI once
   * (default 2200ms) so a just-started Obsidian instance opens the file.
   * @param {string} uri
   * @param {{ executeNodeScript?: Function }|null} [api]
   * @param {{ retry?: boolean, retryDelayMs?: number }} [options]
   * @returns {Promise<{ok: boolean, uri: string, copied: boolean, via?: string}>}
   */
  async function openExternalUri(uri, api, options) {
    const retry = !options || options.retry !== false;
    const result = await dispatchOpenUri(uri, api);
    if (result.ok && retry) {
      scheduleOpenRetry(uri, api, options && options.retryDelayMs);
    }
    return result;
  }

  async function copyText(text) {
    if (text == null) {
      return false;
    }
    const value = String(text);
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
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
        // iframe translate() can return a Promise — never write that into the DOM.
        if (typeof translated === 'string' && translated && translated !== key) {
          return interpolate(translated, params);
        }
      }
    } catch {
      // English fallback
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
    validateExistingNotePath,
    stripMarkdownExtension,
    withMarkdownExtension,
    wikiLink,
    buildOpenUri,
    getBinding,
    bindingTarget,
    notePathFromBinding,
    upsertBinding,
    removeBinding,
    updateVaultSettings,
    visibleProjects,
    filterPages,
    filterBindings,
    filterNoteTree,
    buildNoteTree,
    flattenVisibleTree,
    ancestorFolderPaths,
    debounce,
    vaultConfigStatus,
    rankPage,
    listVaultPagesScript,
    parseNodePageResult,
    getPlatform,
    isDesktopPlatform,
    isMobilePlatform,
    canBrowseVault,
    isNoteTarget,
    isSafeObsidianOpenUri,
    openObsidianUriScript,
    OPEN_RETRY_DELAY_MS,
    cancelScheduledOpenRetry,
    dispatchOpenUri,
    openExternalUri,
    copyText,
    t,
  };
});

/* Host-side Super Productivity plugin. Concatenated after core.js into plugin.js.
 * Registers menu / header / side-panel entry points that open the link panel
 * or an existing linked page via obsidian://open.
 */
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

  /** Open the connector panel so the user can pick an existing Obsidian page. */
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

  /** Open the linked page, or the link panel when the project is not linked yet. */
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
    const result = await Core.openExternalUri(uri, api);
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
    // SP cannot inject into the project ⋮ work-context menu yet.
    // Supported entry points: plugin menu, header buttons, side panel / Panels.
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

