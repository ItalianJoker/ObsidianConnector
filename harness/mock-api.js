(function () {
  'use strict';

  const storeKey = 'obsidian-connector-harness';
  const opened = [];
  const snacks = [];

  const projects = [
    { id: 'p-website', title: 'Website', theme: { primary: '#5b7fff' }, taskIds: [], backlogTaskIds: [] },
    { id: 'p-thesis', title: 'Thesis', theme: {}, taskIds: [], backlogTaskIds: [] },
    { id: 'p-elmec', title: 'Elmec', theme: {}, taskIds: [], backlogTaskIds: [] },
    { id: 'p-inbox', title: 'Inbox', theme: {}, taskIds: [], backlogTaskIds: [] },
  ];

  const vaultFolders = [
    { path: '', name: '(vault root)' },
    { path: 'Personal', name: 'Personal' },
    { path: 'Projects', name: 'Projects' },
    { path: 'Projects/Thesis', name: 'Thesis' },
    { path: 'Projects/Website', name: 'Website' },
    { path: 'Work', name: 'Work' },
    { path: 'Work/Elmec', name: 'Elmec' },
  ];

  let context = {
    id: 'p-website',
    type: 'PROJECT',
    title: 'Website',
    taskIds: [],
  };

  window.__obsidianConnectorHarness = {
    opened,
    snacks,
    projects,
    vaultFolders,
    get context() {
      return context;
    },
    setContext(next) {
      context = next;
    },
  };

  window.open = function (url) {
    opened.push(String(url));
    const banner = document.getElementById('harness-opened');
    if (banner) {
      banner.textContent = String(url);
    }
    return { closed: false };
  };

  window.PluginAPI = {
    cfg: {
      theme: 'light',
      appVersion: '18.0.0',
      platform: 'desktop',
      isDev: true,
      lang: { code: 'en' },
    },
    Hooks: {
      PERSISTED_DATA_CHANGED: 'persistedDataChanged',
      PROJECT_LIST_UPDATE: 'projectListUpdate',
      WORK_CONTEXT_CHANGE: 'workContextChange',
      LANGUAGE_CHANGE: 'languageChange',
    },
    translate(key) {
      return key;
    },
    getCurrentLanguage() {
      return 'en';
    },
    async getAllProjects() {
      return projects.slice();
    },
    async getActiveWorkContext() {
      return context;
    },
    async persistDataSynced(data) {
      localStorage.setItem(storeKey, data);
    },
    async loadSyncedData() {
      return localStorage.getItem(storeKey);
    },
    async executeNodeScript() {
      return { success: true, result: vaultFolders.slice() };
    },
    showSnack(cfg) {
      snacks.push(cfg);
    },
    async openDialog(cfg) {
      const unlink = (cfg.buttons || []).find((button) => button.color === 'warn');
      return unlink ? unlink.label : undefined;
    },
    registerHook() {},
    showIndexHtmlAsView() {},
  };

  function installBar() {
    if (!document.body || document.getElementById('harness-bar')) {
      return;
    }
    document.documentElement.style.background = '#f4f5f7';
    document.body.style.background = '#f4f5f7';
    const bar = document.createElement('div');
    bar.id = 'harness-bar';
    bar.style.cssText =
      'position:sticky;top:0;z-index:9;padding:8px 12px;background:#1e1e1e;color:#fff;font:12px/1.4 sans-serif;';
    bar.innerHTML =
      '<strong>Harness</strong> · Opened URIs: <code id="harness-opened">none</code>';
    document.body.prepend(bar);
  }

  if (document.body) {
    installBar();
  }
  document.addEventListener('DOMContentLoaded', installBar);
})();
