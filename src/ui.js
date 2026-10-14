/* Iframe UI for Obsidian Connector. Concatenated after core.js inside index.html.
 * Desktop: browse existing .md pages as a folder tree. Mobile/web: type an
 * existing vault-relative path. Never creates Obsidian pages or SP projects.
 */
(function () {
  'use strict';

  const Core = globalThis.ObsidianConnectorCore;
  const SEARCH_DEBOUNCE_MS = 150;

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function waitForPluginApi() {
    if (typeof PluginAPI !== 'undefined' && Core) {
      start();
      return;
    }
    setTimeout(waitForPluginApi, 50);
  }

  async function start() {
    const ui = new ConnectorUi();
    await ui.init();
  }

  class ConnectorUi {
    constructor() {
      this.state = Core.createEmptyState();
      this.projects = [];
      this.context = null;
      this.pages = [];
      this.tree = null;
      this.pageCache = { vaultPath: '', pages: [], tree: null };
      this.selectedPage = '';
      this.pageQuery = '';
      this.pagePicked = false;
      this.lastProjectId = '';
      this.expandedFolders = new Set();
      this.linkedOpen = false;
      this.linkedQuery = '';
      this.listeners = [];
      this.pageSearchDebounced = Core.debounce(() => {
        this.pageQuery = qs('page-search').value;
        this.renderPageTree();
      }, SEARCH_DEBOUNCE_MS);
      this.linkedSearchDebounced = Core.debounce(() => {
        this.linkedQuery = qs('linked-search').value;
        if (this.linkedOpen) {
          this.renderBindings();
        }
      }, SEARCH_DEBOUNCE_MS);
    }

    /**
     * Bind a listener and remember it so the panel can detach on teardown.
     * @param {EventTarget} target
     * @param {string} type
     * @param {EventListener} handler
     * @param {boolean|AddEventListenerOptions} [opts]
     */
    on(target, type, handler, opts) {
      if (!target) {
        return;
      }
      target.addEventListener(type, handler, opts);
      this.listeners.push(() => target.removeEventListener(type, handler, opts));
    }

    destroy() {
      this.pageSearchDebounced.cancel();
      this.linkedSearchDebounced.cancel();
      for (const off of this.listeners) {
        off();
      }
      this.listeners = [];
    }

    t(key, fallback, params) {
      const value = Core.t(PluginAPI, key, fallback, params);
      return typeof value === 'string' && value ? value : fallback || key;
    }

    canBrowse() {
      return Core.canBrowseVault(PluginAPI);
    }

    async init() {
      this.bindEvents();
      this.applyStaticText();
      this.applyPlatformMode();
      await this.refresh();
      this.setupHooks();
      if (this.canBrowse() && this.state.vaultPath) {
        await this.loadPages();
      } else {
        this.renderVaultWarning();
      }
    }

    applyPlatformMode() {
      const desktopPicker = qs('desktop-page-picker');
      const mobileEntry = qs('mobile-page-entry');
      const vaultPathBlock = qs('vault-path-block');
      const loadBtn = qs('load-pages');
      const refreshBtn = qs('refresh-pages');
      const banner = qs('platform-banner');

      if (this.canBrowse()) {
        desktopPicker.classList.remove('hidden');
        mobileEntry.classList.add('hidden');
        vaultPathBlock.classList.remove('hidden');
        loadBtn.classList.remove('hidden');
        if (this.pageCache.tree) {
          refreshBtn.classList.remove('hidden');
        } else {
          refreshBtn.classList.add('hidden');
        }
        banner.textContent = this.t(
          'UI.PLATFORM_DESKTOP',
          'Desktop: load existing pages from the vault folder, then pick one. The plugin never creates a page.',
        );
      } else {
        desktopPicker.classList.add('hidden');
        mobileEntry.classList.remove('hidden');
        vaultPathBlock.classList.add('hidden');
        loadBtn.classList.add('hidden');
        refreshBtn.classList.add('hidden');
        banner.textContent = this.t(
          'UI.PLATFORM_MOBILE',
          'Mobile / web: enter the vault-relative path of an existing Obsidian page. Disk browsing needs the desktop app. Opening still uses obsidian://.',
        );
      }
    }

    applyStaticText() {
      document.title = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('title').textContent = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('title').title = qs('title').textContent;
      qs('lede').textContent = this.t(
        'UI.LEDE',
        'Pick an existing Super Productivity project and link it to an existing page in your Obsidian vault. The plugin never creates a new page.',
      );
      qs('vault-heading').textContent = this.t('UI.VAULT', 'Obsidian vault');
      qs('vault-heading').title = qs('vault-heading').textContent;
      qs('vault-name-label').textContent = this.t('UI.VAULT_NAME', 'Vault name');
      qs('vault-name-hint').textContent = this.t(
        'UI.VAULT_NAME_HINT',
        'The name shown in Obsidian. Used only to open the page with obsidian://',
      );
      qs('vault-path-label').textContent = this.t(
        'UI.VAULT_PATH',
        'Vault folder on this computer',
      );
      qs('vault-path-hint').textContent = this.t(
        'UI.VAULT_PATH_HINT',
        'Absolute path to the vault. Desktop only — used to list existing pages.',
      );
      qs('save-vault').textContent = this.t('UI.SAVE', 'Save');
      qs('load-pages').textContent = this.t('UI.LOAD_PAGES', 'Load existing pages');
      qs('refresh-pages').textContent = this.t('UI.REFRESH', 'Refresh');
      qs('link-heading').textContent = this.t(
        'UI.NEW_LINK',
        'Link an existing project',
      );
      qs('link-heading').title = qs('link-heading').textContent;
      qs('project-label').textContent = this.t(
        'UI.PROJECT',
        'Super Productivity project',
      );
      qs('project-hint').textContent = this.t(
        'UI.PROJECT_HINT',
        'Only projects that already exist in Super Productivity are listed. This plugin never creates a project.',
      );
      qs('page-label').textContent = this.t(
        'UI.PAGE',
        'Existing Obsidian page',
      );
      qs('page-hint').textContent = this.t(
        'UI.PAGE_HINT',
        'Choose a page that already exists in the vault. Nothing new is created.',
      );
      qs('page-search').placeholder = this.t(
        'UI.PAGE_SEARCH',
        'Search existing pages…',
      );
      qs('manual-page-label').textContent = this.t(
        'UI.MANUAL_PAGE',
        'Existing page path',
      );
      qs('manual-page-hint').textContent = this.t(
        'UI.MANUAL_PAGE_HINT',
        'Enter the vault-relative path of a page that already exists. On mobile, browsing the vault disk is unavailable — type the path of an existing note.',
      );
      qs('save-binding').textContent = this.t('UI.LINK', 'Link to selected page');
      qs('selected-page-label').textContent = this.t(
        'UI.SELECTED_PAGE',
        'Selected page',
      );
      qs('list-heading').textContent = this.t('UI.LINKED', 'Linked projects');
      qs('list-heading').title = qs('list-heading').textContent;
      qs('linked-search').placeholder = this.t(
        'UI.LINKED_SEARCH',
        'Search linked projects…',
      );
      qs('linked-search-label').textContent = this.t(
        'UI.LINKED_SEARCH',
        'Search linked projects…',
      );
      qs('banner-open').textContent = this.t('UI.OPEN', 'Open in Obsidian');
      this.renderLinkedCount();
    }

    bindEvents() {
      this.on(qs('save-vault'), 'click', () => this.saveVault());
      this.on(qs('load-pages'), 'click', () => this.loadPages({ force: true }));
      this.on(qs('refresh-pages'), 'click', () => this.refreshAll());
      this.on(qs('save-binding'), 'click', () => this.saveBinding());
      this.on(qs('project-select'), 'change', () => this.onProjectChange());
      this.on(qs('page-search'), 'input', () => {
        qs('page-search').title = qs('page-search').value;
        this.pageSearchDebounced();
      });
      this.on(qs('manual-page'), 'input', () => {
        this.selectedPage = qs('manual-page').value.trim();
        this.pagePicked = !!this.selectedPage;
        this.renderSelectedPage();
      });
      this.on(qs('banner-open'), 'click', () => this.openCurrent());
      this.on(qs('banner-link'), 'click', () => this.prefillCurrent());
      this.on(qs('linked-toggle'), 'click', () => this.toggleLinked());
      this.on(qs('linked-search'), 'input', () => {
        qs('linked-search').title = qs('linked-search').value;
        this.linkedSearchDebounced();
      });
      this.on(qs('page-list'), 'click', (event) => this.onPageTreeClick(event));
      this.on(qs('bindings'), 'click', (event) => this.onBindingsClick(event));
      this.on(document, 'click', (event) => this.onDocumentClick(event));
    }

    setupHooks() {
      const hooks = PluginAPI.Hooks || {};
      const refresh = () => this.refresh();
      [
        hooks.PERSISTED_DATA_CHANGED,
        hooks.PROJECT_LIST_UPDATE,
        hooks.WORK_CONTEXT_CHANGE,
        hooks.LANGUAGE_CHANGE,
      ]
        .filter(Boolean)
        .forEach((hook) => {
          try {
            PluginAPI.registerHook(hook, refresh);
          } catch {
            // Older hosts may reject unknown hooks.
          }
        });
    }

    async refresh() {
      try {
        const [raw, projects, context] = await Promise.all([
          PluginAPI.loadSyncedData(),
          PluginAPI.getAllProjects(),
          typeof PluginAPI.getActiveWorkContext === 'function'
            ? PluginAPI.getActiveWorkContext()
            : Promise.resolve(null),
        ]);
        this.state = Core.parseState(raw);
        this.projects = Core.visibleProjects(projects);
        this.context = context;
        this.render();
      } catch (error) {
        this.setStatus(
          this.t('MSG.LOAD_ERROR', 'Could not load plugin data.'),
          'error',
        );
        console.error(error);
      }
    }

    /** Reload projects/bindings and, on desktop, the vault page tree from disk. */
    async refreshAll() {
      await this.refresh();
      if (this.canBrowse()) {
        await this.loadPages({ force: true });
      }
    }

    projectById(id) {
      return this.projects.find((project) => project.id === id) || null;
    }

    selectedProject() {
      return this.projectById(qs('project-select').value);
    }

    render() {
      qs('vault-name').value = this.state.vaultName;
      qs('vault-name').title = this.state.vaultName;
      qs('vault-path').value = this.state.vaultPath;
      qs('vault-path').title = this.state.vaultPath;
      this.applyPlatformMode();
      this.renderVaultWarning();
      this.renderProjectSelect();
      this.renderBanner();
      this.renderLinkedChrome();
      if (this.linkedOpen) {
        this.renderBindings();
      }
    }

    renderVaultWarning() {
      const el = qs('vault-config-status');
      if (!el) {
        return;
      }
      const status = Core.vaultConfigStatus(this.state, {
        requirePath: this.canBrowse(),
      });
      const messages = status.errors.concat(status.warnings);
      if (!messages.length) {
        el.textContent = '';
        el.classList.add('hidden');
        el.dataset.tone = '';
        return;
      }
      el.textContent = messages.join(' ');
      el.classList.remove('hidden');
      el.dataset.tone = status.errors.length ? 'error' : 'info';
    }

    renderProjectSelect() {
      const select = qs('project-select');
      const previous = select.value;
      const linkedIds = new Set(this.state.bindings.map((item) => item.projectId));
      const fragment = document.createDocumentFragment();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = this.t('UI.CHOOSE_PROJECT', 'Choose an existing project…');
      fragment.appendChild(placeholder);

      this.projects
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .forEach((project) => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = linkedIds.has(project.id)
            ? `${project.title} ${this.t('UI.ALREADY_LINKED', '(linked)')}`
            : project.title;
          fragment.appendChild(option);
        });

      select.replaceChildren(fragment);

      if (previous && this.projectById(previous)) {
        select.value = previous;
      } else if (this.context && this.context.type === 'PROJECT') {
        select.value = this.context.id;
      }
      const chosen = select.selectedOptions && select.selectedOptions[0];
      select.title = chosen ? chosen.textContent : '';
      this.onProjectChange();
    }

    renderBanner() {
      const banner = qs('current-banner');
      const ctx = this.context;
      if (!ctx || ctx.type !== 'PROJECT') {
        banner.classList.add('hidden');
        return;
      }
      banner.classList.remove('hidden');
      const binding = Core.getBinding(this.state, ctx.id);
      qs('banner-title').textContent = ctx.title;
      qs('banner-title').title = ctx.title;
      const openBtn = qs('banner-open');
      const linkBtn = qs('banner-link');
      if (binding) {
        qs('banner-detail').textContent = Core.bindingTarget(binding);
        qs('banner-detail').title = Core.bindingTarget(binding);
        openBtn.classList.remove('hidden');
        linkBtn.textContent = this.t('UI.EDIT_LINK', 'Change page');
      } else {
        qs('banner-detail').textContent = this.t(
          'UI.CURRENT_UNLINKED',
          'Not linked to an Obsidian page yet.',
        );
        qs('banner-detail').removeAttribute('title');
        openBtn.classList.add('hidden');
        linkBtn.textContent = this.t('UI.LINK_THIS', 'Link this project');
      }
    }

    /**
     * Render only the visible tree rows (collapsed folders omit children).
     * Filtering auto-expands matching branches.
     */
    renderPageTree() {
      const root = qs('page-list');
      if (!root || !this.canBrowse()) {
        this.renderSelectedPage();
        return;
      }
      this.renderSelectedPage();

      if (!this.pages.length) {
        root.replaceChildren(this.emptyNote(
          this.t(
            'UI.PAGES_EMPTY',
            'Set the vault path and click Load existing pages to list notes already in the vault.',
          ),
        ));
        return;
      }

      const sourceTree = this.tree || Core.buildNoteTree(this.pages);
      const { tree, expanded } = Core.filterNoteTree(sourceTree, this.pageQuery);
      if (this.pageQuery) {
        this.expandedFolders = new Set(expanded);
      }
      if (this.selectedPage) {
        Core.ancestorFolderPaths(this.selectedPage).forEach((folder) => {
          this.expandedFolders.add(folder);
        });
      }

      const visible = Core.flattenVisibleTree(tree, this.expandedFolders);
      if (!visible.length) {
        root.replaceChildren(this.emptyNote(
          this.t('UI.PAGES_NONE', 'No existing pages match this search.'),
        ));
        return;
      }

      const project = this.selectedProject();
      const fragment = document.createDocumentFragment();
      for (const item of visible) {
        fragment.appendChild(this.createTreeRow(item, project));
      }
      root.replaceChildren(fragment);
    }

    emptyNote(text) {
      const p = document.createElement('p');
      p.className = 'empty text-muted';
      p.textContent = text;
      return p;
    }

    createTreeRow(item, project) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = item.type === 'folder' ? 'tree-row tree-folder' : 'tree-row tree-file';
      btn.style.setProperty('--depth', String(item.depth || 0));
      btn.title = item.path;

      const icon = document.createElement('span');
      icon.className =
        item.type === 'folder' ? 'tree-icon tree-icon-folder' : 'tree-icon tree-icon-file';
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = item.type === 'folder' ? item.name : `${item.name}.md`;

      if (item.type === 'folder') {
        const isOpen = this.expandedFolders.has(item.path);
        btn.setAttribute('data-folder', item.path);
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.setAttribute('role', 'treeitem');
        if (isOpen) {
          btn.classList.add('expanded');
        }
      } else {
        btn.setAttribute('data-page', item.path);
        btn.setAttribute('role', 'option');
        if (item.path === this.selectedPage) {
          btn.classList.add('selected');
        }
        if (Core.rankPage(item.path, project && project.title) >= 3) {
          btn.classList.add('match');
        }
      }

      btn.append(icon, label);
      return btn;
    }

    onPageTreeClick(event) {
      const list = qs('page-list');
      const folderBtn = event.target.closest('[data-folder]');
      if (folderBtn && list.contains(folderBtn)) {
        const folder = folderBtn.getAttribute('data-folder');
        if (this.expandedFolders.has(folder)) {
          this.expandedFolders.delete(folder);
        } else {
          this.expandedFolders.add(folder);
        }
        this.renderPageTree();
        return;
      }
      const pageBtn = event.target.closest('[data-page]');
      if (pageBtn && list.contains(pageBtn)) {
        this.selectedPage = pageBtn.getAttribute('data-page') || '';
        this.pagePicked = true;
        this.renderPageTree();
      }
    }

    renderSelectedPage() {
      const el = qs('selected-page');
      if (!el) {
        return;
      }
      const value = this.pagePicked && this.selectedPage
        ? this.selectedPage
        : this.t('UI.NO_PAGE_SELECTED', 'No page selected');
      el.textContent = value;
      if (this.pagePicked && this.selectedPage) {
        el.title = this.selectedPage;
      } else {
        el.removeAttribute('title');
      }
    }

    toggleLinked() {
      this.linkedOpen = !this.linkedOpen;
      this.renderLinkedChrome();
      if (this.linkedOpen) {
        this.renderBindings();
      } else {
        this.closeAllMenus();
        qs('bindings').replaceChildren();
      }
    }

    renderLinkedCount() {
      const countEl = qs('linked-count');
      if (!countEl) {
        return;
      }
      const n = this.state.bindings.length;
      countEl.textContent = this.t('UI.LINKED_COUNT', '({{count}})', { count: n });
    }

    renderLinkedChrome() {
      const toggle = qs('linked-toggle');
      const panel = qs('linked-panel');
      this.renderLinkedCount();
      toggle.setAttribute('aria-expanded', this.linkedOpen ? 'true' : 'false');
      toggle.classList.toggle('open', this.linkedOpen);
      if (this.linkedOpen) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }

    renderBindings() {
      const root = qs('bindings');
      if (!this.linkedOpen) {
        root.replaceChildren();
        return;
      }
      if (!this.state.bindings.length) {
        root.replaceChildren(this.emptyNote(
          this.t(
            'UI.EMPTY',
            'No links yet. Choose an existing project, pick an existing Obsidian page, then click Link.',
          ),
        ));
        return;
      }

      const visible = Core.filterBindings(
        this.state.bindings,
        this.linkedQuery,
        (id) => {
          const project = this.projectById(id);
          return project ? project.title : '';
        },
      );
      if (!visible.length) {
        root.replaceChildren(this.emptyNote(
          this.t('UI.LINKED_NONE', 'No linked projects match this search.'),
        ));
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const binding of visible) {
        fragment.appendChild(this.createBindingCard(binding));
      }
      root.replaceChildren(fragment);
    }

    createBindingCard(binding) {
      const project = this.projectById(binding.projectId);
      const title = project
        ? project.title
        : this.t('UI.MISSING_PROJECT', 'Missing project ({{id}})', {
            id: binding.projectId,
          });
      const page = Core.bindingTarget(binding);
      const article = document.createElement('article');
      article.className = 'card binding';
      article.setAttribute('data-project-id', binding.projectId);
      article.innerHTML = `
              <div class="binding-head">
                <div class="binding-title${project ? '' : ' text-muted'}">
                  <span class="dot"></span>
                  <span class="binding-name" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                </div>
                <div class="menu-wrap">
                  <button
                    type="button"
                    class="icon-btn menu-trigger"
                    data-action="toggle-menu"
                    aria-label="${escapeHtml(this.t('UI.MORE_ACTIONS', 'More actions'))}"
                    title="${escapeHtml(this.t('UI.MORE_ACTIONS', 'More actions'))}"
                  >⋮</button>
                  <div class="menu-panel hidden" role="menu">
                    <button type="button" data-action="open" role="menuitem">${escapeHtml(
                      this.t('UI.OPEN', 'Open in Obsidian'),
                    )}</button>
                    <button type="button" data-action="edit" role="menuitem">${escapeHtml(
                      this.t('UI.EDIT_LINK', 'Change page'),
                    )}</button>
                    <button type="button" data-action="copy-uri" role="menuitem">${escapeHtml(
                      this.t('UI.COPY_URI', 'Copy URI'),
                    )}</button>
                    <button type="button" data-action="copy-wiki" role="menuitem">${escapeHtml(
                      this.t('UI.COPY_WIKI', 'Copy [[wiki]]'),
                    )}</button>
                    <button type="button" class="danger" data-action="unlink" role="menuitem">${escapeHtml(
                      this.t('UI.UNLINK', 'Unlink'),
                    )}</button>
                  </div>
                </div>
              </div>
              <div class="path text-muted" title="${escapeHtml(page)}">${escapeHtml(page)}</div>
              <div class="actions">
                <button type="button" class="primary" data-action="open">${escapeHtml(
                  this.t('UI.OPEN', 'Open in Obsidian'),
                )}</button>
              </div>
          `;
      return article;
    }

    onBindingsClick(event) {
      const button = event.target.closest('[data-action]');
      const root = qs('bindings');
      if (!button || !root.contains(button)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const article = button.closest('[data-project-id]');
      const projectId = article && article.getAttribute('data-project-id');
      const action = button.getAttribute('data-action');
      if (action === 'toggle-menu') {
        this.toggleBindingMenu(article);
        return;
      }
      this.closeAllMenus();
      this.handleBindingAction(action, projectId);
    }

    onDocumentClick(event) {
      if (event.target && event.target.closest && event.target.closest('.menu-wrap')) {
        return;
      }
      this.closeAllMenus();
    }

    toggleBindingMenu(article) {
      if (!article) {
        return;
      }
      const panel = article.querySelector('.menu-panel');
      const wasOpen = panel && !panel.classList.contains('hidden');
      this.closeAllMenus();
      if (panel && !wasOpen) {
        panel.classList.remove('hidden');
      }
    }

    closeAllMenus() {
      document.querySelectorAll('.menu-panel').forEach((panel) => {
        panel.classList.add('hidden');
      });
    }

    onProjectChange() {
      const project = this.selectedProject();
      const projectId = project ? project.id : '';
      if (this.lastProjectId !== projectId) {
        this.lastProjectId = projectId;
        const binding = project ? Core.getBinding(this.state, project.id) : null;
        if (binding) {
          this.selectedPage = Core.bindingTarget(binding);
          this.pagePicked = true;
          qs('manual-page').value = this.selectedPage;
        } else {
          this.selectedPage = '';
          this.pagePicked = false;
          qs('manual-page').value = '';
        }
      }
      if (project && !this.pageQuery) {
        qs('page-search').placeholder = this.t(
          'UI.PAGE_SEARCH_FOR',
          'Search existing pages… (matches for "{{title}}" are listed first)',
          { title: project.title },
        );
      }
      this.renderPageTree();
    }

    prefillCurrent() {
      if (!this.context || this.context.type !== 'PROJECT') {
        return;
      }
      qs('project-select').value = this.context.id;
      this.pageQuery = '';
      qs('page-search').value = '';
      this.onProjectChange();
      const target = this.canBrowse() ? qs('page-list') : qs('manual-page');
      if (target) {
        target.scrollIntoView({ block: 'nearest' });
      }
    }

    async persist(nextState) {
      this.state = nextState;
      await PluginAPI.persistDataSynced(Core.serializeState(nextState));
      this.render();
    }

    invalidatePageCache() {
      this.pageCache = { vaultPath: '', pages: [], tree: null };
      this.pages = [];
      this.tree = null;
      this.expandedFolders = new Set();
    }

    async saveVault() {
      const next = Core.updateVaultSettings(this.state, {
        vaultName: qs('vault-name').value,
        vaultPath: qs('vault-path').value,
      });
      if (next.vaultPath !== this.pageCache.vaultPath) {
        this.invalidatePageCache();
      }
      await this.persist(next);
      this.setStatus(this.t('MSG.VAULT_SAVED', 'Vault settings saved.'), 'success');
      this.renderVaultWarning();
      if (this.canBrowse() && next.vaultPath) {
        await this.loadPages({ force: true });
      }
    }

    async loadPages(opts) {
      const force = !!(opts && opts.force);
      if (!this.canBrowse()) {
        this.setStatus(
          this.t(
            'MSG.DESKTOP_ONLY',
            'Listing existing Obsidian pages needs the Super Productivity desktop app, with file access allowed for this plugin.',
          ),
          'error',
        );
        return;
      }
      const vaultPath = Core.normalizeVaultRootPath(
        qs('vault-path').value || this.state.vaultPath,
      );
      if (!vaultPath) {
        this.setStatus(
          this.t(
            'MSG.VAULT_PATH_REQUIRED',
            'Enter the vault folder path on this computer, then load existing pages.',
          ),
          'error',
        );
        this.renderVaultWarning();
        this.renderPageTree();
        return;
      }

      if (!force && this.pageCache.tree && this.pageCache.vaultPath === vaultPath) {
        this.pages = this.pageCache.pages;
        this.tree = this.pageCache.tree;
        qs('refresh-pages').classList.remove('hidden');
        this.renderPageTree();
        this.setStatus(
          this.t('MSG.PAGES_CACHED', 'Showing {{count}} cached pages. Click Refresh to reload.', {
            count: this.pages.length,
          }),
          'info',
        );
        return;
      }

      this.setStatus(this.t('MSG.LOADING_PAGES', 'Reading existing vault pages…'), 'info');
      try {
        const result = await PluginAPI.executeNodeScript({
          script: Core.listVaultPagesScript(vaultPath),
          timeout: 20000,
        });
        const parsed = Core.parseNodePageResult(result);
        if (!parsed.ok) {
          this.invalidatePageCache();
          this.setStatus(parsed.error, 'error');
          this.renderPageTree();
          return;
        }
        this.pages = parsed.pages;
        this.tree = Core.buildNoteTree(parsed.pages);
        this.pageCache = { vaultPath, pages: parsed.pages, tree: this.tree };
        qs('refresh-pages').classList.remove('hidden');
        this.renderPageTree();
        this.setStatus(
          this.t('MSG.PAGES_LOADED', 'Loaded {{count}} existing pages.', {
            count: this.pages.length,
          }),
          'success',
        );
      } catch (error) {
        this.invalidatePageCache();
        this.setStatus(
          error && error.message
            ? String(error.message)
            : this.t('MSG.PAGES_FAILED', 'Could not read existing vault pages.'),
          'error',
        );
        this.renderPageTree();
      }
    }

    resolveSelectedPagePath() {
      if (this.canBrowse()) {
        return this.pagePicked ? this.selectedPage : '';
      }
      return (qs('manual-page').value || '').trim();
    }

    async saveBinding() {
      const projectId = qs('project-select').value;
      if (!projectId || !this.projectById(projectId)) {
        this.setStatus(
          this.t(
            'MSG.CHOOSE_PROJECT_FIRST',
            'Choose an existing Super Productivity project first.',
          ),
          'error',
        );
        return;
      }

      const pagePath = this.resolveSelectedPagePath();
      if (!pagePath) {
        this.setStatus(
          this.t(
            'MSG.CHOOSE_PAGE',
            'Select an existing Obsidian page (or enter its vault-relative path).',
          ),
          'error',
        );
        return;
      }

      if (this.canBrowse() && this.pages.length) {
        const exists = this.pages.some(
          (page) => (page.path || '') === Core.withMarkdownExtension(pagePath),
        );
        if (!exists) {
          this.setStatus(
            this.t(
              'MSG.PAGE_MUST_EXIST',
              'Pick a page from the list of existing vault notes. The plugin cannot create a new Obsidian page.',
            ),
            'error',
          );
          return;
        }
      }

      const result = Core.upsertBinding(this.state, projectId, pagePath);
      if (!result.ok) {
        this.setStatus(this.t('MSG.INVALID_PATH', result.message), 'error');
        return;
      }
      await this.persist(result.state);
      this.setStatus(
        this.t('MSG.LINKED', 'Project linked to the selected Obsidian page.'),
        'success',
      );
    }

    async handleBindingAction(action, projectId) {
      const binding = Core.getBinding(this.state, projectId);
      if (!binding && action !== 'unlink') {
        return;
      }

      if (action === 'edit') {
        qs('project-select').value = projectId;
        this.onProjectChange();
        const target = this.canBrowse() ? qs('page-list') : qs('manual-page');
        if (target) {
          target.scrollIntoView({ block: 'nearest' });
        }
        return;
      }

      if (action === 'unlink') {
        const confirmed = await this.confirmUnlink(projectId);
        if (!confirmed) {
          return;
        }
        await this.persist(Core.removeBinding(this.state, projectId));
        this.setStatus(this.t('MSG.UNLINKED', 'Project unlinked.'), 'success');
        return;
      }

      const page = Core.bindingTarget(binding);
      if (action === 'open') {
        await this.openUri(Core.buildOpenUri(this.state, binding), page);
        return;
      }

      if (action === 'copy-uri') {
        const uri = Core.buildOpenUri(this.state, binding);
        const copied = await Core.copyText(uri);
        this.setStatus(
          copied ? this.t('MSG.COPIED', 'Copied to clipboard.') : uri,
          copied ? 'success' : 'error',
        );
        return;
      }

      if (action === 'copy-wiki') {
        const wiki = page ? Core.wikiLink(page) : '';
        const copied = wiki ? await Core.copyText(wiki) : false;
        this.setStatus(
          copied ? this.t('MSG.COPIED', 'Copied to clipboard.') : wiki,
          copied ? 'success' : 'error',
        );
      }
    }

    async confirmUnlink(projectId) {
      const project = this.projectById(projectId);
      const title = project ? project.title : projectId;
      if (typeof PluginAPI.openDialog === 'function') {
        const result = await PluginAPI.openDialog({
          title: this.t('UI.UNLINK', 'Unlink'),
          htmlContent: `<p>${escapeHtml(
            this.t(
              'MSG.CONFIRM_UNLINK',
              'Remove the Obsidian page link for "{{title}}"? Nothing in the vault is deleted.',
              { title },
            ),
          )}</p>`,
          buttons: [
            { label: this.t('UI.CANCEL', 'Cancel') },
            { label: this.t('UI.UNLINK', 'Unlink'), color: 'warn', raised: true },
          ],
        });
        return result === this.t('UI.UNLINK', 'Unlink');
      }
      return true;
    }

    async openCurrent() {
      if (!this.context || this.context.type !== 'PROJECT') {
        return;
      }
      const binding = Core.getBinding(this.state, this.context.id);
      if (!binding) {
        this.prefillCurrent();
        return;
      }
      await this.openUri(Core.buildOpenUri(this.state, binding), Core.bindingTarget(binding));
    }

    async openUri(uri, page) {
      if (!uri) {
        this.setStatus(this.t('MSG.OPEN_FAILED', 'Could not build the Obsidian URI.'), 'error');
        return;
      }
      const config = Core.vaultConfigStatus(this.state, { requirePath: false });
      if (config.warnings.length && !this.state.vaultName) {
        this.renderVaultWarning();
      }
      const result = await Core.openExternalUri(uri, PluginAPI);
      if (result.ok) {
        this.setStatus(
          this.t('MSG.OPENING_NOTE', 'Opening {{file}} in Obsidian…', {
            file: page || '',
          }),
          'success',
        );
        return;
      }
      const copied = await Core.copyText(uri);
      this.setStatus(
        copied
          ? this.t(
              'MSG.URI_COPIED',
              'Could not open Obsidian automatically. The URI was copied to the clipboard.',
            )
          : uri,
        copied ? 'success' : 'error',
      );
    }

    setStatus(message, tone) {
      const el = qs('status');
      el.textContent = message || '';
      el.dataset.tone = tone || '';
      if (message && PluginAPI.showSnack) {
        PluginAPI.showSnack({
          msg: message,
          type: tone === 'error' ? 'ERROR' : tone === 'success' ? 'SUCCESS' : 'INFO',
        });
      }
    }
  }

  waitForPluginApi();
})();
