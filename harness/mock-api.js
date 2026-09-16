(function () {
  'use strict';

  const translations = {
    en: null,
    it: {
      'PLUGIN.NAME': 'Obsidian Connector',
      'UI.LEDE':
        'Aggancia ogni progetto di Super Productivity a un file Markdown del vault Obsidian.',
      'UI.VAULT': 'Vault Obsidian',
      'UI.VAULT_NAME': 'Nome del vault',
      'UI.SAVE': 'Salva',
      'UI.NEW_LINK': 'Collega un progetto',
      'UI.PROJECT': 'Progetto',
      'UI.FILE_PATH': 'Percorso della nota nel vault',
      'UI.SUGGEST': 'Suggerisci percorso',
      'UI.LINK': 'Collega',
      'UI.LINKED': 'Progetti collegati',
      'UI.OPEN': 'Apri in Obsidian',
      'UI.CREATE': 'Crea nota',
      'UI.COPY_URI': 'Copia URI',
      'UI.COPY_WIKI': 'Copia [[wiki]]',
      'UI.UNLINK': 'Scollega',
      'UI.CANCEL': 'Annulla',
      'UI.CHOOSE_PROJECT': 'Scegli un progetto…',
      'UI.ALREADY_LINKED': '(collegato)',
      'UI.EMPTY':
        'Nessun progetto collegato. Scegli un progetto e un percorso nel vault, poi premi Collega.',
      'UI.CURRENT_UNLINKED': 'Questo progetto non è ancora collegato.',
      'UI.EDIT_LINK': 'Modifica collegamento',
      'UI.LINK_THIS': 'Collega questo progetto',
      'MSG.VAULT_SAVED': 'Impostazioni del vault salvate.',
      'MSG.LINKED': 'Progetto collegato al file Obsidian.',
      'MSG.UNLINKED': 'Progetto scollegato.',
      'MSG.COPIED': 'Copiato negli appunti.',
      'MSG.OPENING_NOTE': 'Apertura di {{file}} in Obsidian…',
      'MSG.CHOOSE_PROJECT_FIRST': 'Scegli prima un progetto.',
      'MSG.CONFIRM_UNLINK':
        'Rimuovere il collegamento Obsidian per "{{title}}"? La nota nel vault non viene cancellata.',
    },
  };

  const storeKey = 'obsidian-connector-harness';
  const opened = [];
  const snacks = [];

  const projects = [
    { id: 'p-website', title: 'Sito web', theme: { primary: '#5b7fff' }, taskIds: [], backlogTaskIds: [] },
    { id: 'p-thesis', title: 'Tesi', theme: {}, taskIds: [], backlogTaskIds: [] },
    { id: 'p-inbox', title: 'Inbox', theme: {}, taskIds: [], backlogTaskIds: [] },
  ];

  let context = {
    id: 'p-website',
    type: 'PROJECT',
    title: 'Sito web',
    taskIds: [],
  };

  function lookup(map, key) {
    if (!map) {
      return null;
    }
    const parts = key.split('.');
    let current = { PLUGIN: { NAME: 'Obsidian Connector' } };
    // Flattened map is used for IT; EN falls through to UI fallbacks.
    return map[key] || null;
  }

  window.__obsidianConnectorHarness = {
    opened,
    snacks,
    projects,
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
      platform: 'web',
      isDev: true,
      lang: { code: 'it' },
    },
    Hooks: {
      PERSISTED_DATA_CHANGED: 'persistedDataChanged',
      PROJECT_LIST_UPDATE: 'projectListUpdate',
      WORK_CONTEXT_CHANGE: 'workContextChange',
      LANGUAGE_CHANGE: 'languageChange',
    },
    translate(key, params) {
      let value = lookup(translations.it, key) || key;
      if (params) {
        value = String(value).replace(/\{\{(\w+)\}\}/g, (_, name) =>
          params[name] == null ? '' : String(params[name]),
        );
      }
      return value === key ? key : value;
    },
    getCurrentLanguage() {
      return 'it';
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
      '<strong>Harness</strong> · URI aperti: <code id="harness-opened">nessuno</code>';
    document.body.prepend(bar);
  }

  if (document.body) {
    installBar();
  }
  document.addEventListener('DOMContentLoaded', installBar);
})();
