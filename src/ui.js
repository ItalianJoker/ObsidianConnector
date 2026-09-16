/* Iframe UI. Concatenated after core.js inside index.html. */
(function () {
  'use strict';

  const Core = globalThis.ObsidianConnectorCore;

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
      this.selectedPage = '';
      this.pageQuery = '';
      this.pagePicked = false;
      this.lastProjectId = '';
    }

    t(key, fallback, params) {
      const value = Core.t(PluginAPI, key, fallback, params);
      return typeof value === 'string' && value ? value : fallback || key;
    }

    canBrowse() {
      return Core.canBrowseVault(PluginAPI);
    }

    isMobile() {
      return Core.isMobilePlatform(PluginAPI);
    }

    async init() {
      this.bindEvents();
      this.applyStaticText();
      this.applyPlatformMode();
      await this.refresh();
      this.setupHooks();
      if (this.canBrowse() && this.state.vaultPath) {
        await this.loadPages();
      }
    }

    applyPlatformMode() {
      const desktopPicker = qs('desktop-page-picker');
      const mobileEntry = qs('mobile-page-entry');
      const vaultPathBlock = qs('vault-path-block');
      const loadBtn = qs('load-pages');
      const banner = qs('platform-banner');

      if (this.canBrowse()) {
        desktopPicker.classList.remove('hidden');
        mobileEntry.classList.add('hidden');
        vaultPathBlock.classList.remove('hidden');
        loadBtn.classList.remove('hidden');
        banner.textContent = this.t(
          'UI.PLATFORM_DESKTOP',
          'Desktop: load existing pages from the vault folder, then pick one. The plugin never creates a page.',
        );
      } else {
        desktopPicker.classList.add('hidden');
        mobileEntry.classList.remove('hidden');
        vaultPathBlock.classList.add('hidden');
        loadBtn.classList.add('hidden');
        banner.textContent = this.t(
          'UI.PLATFORM_MOBILE',
          'Mobile / web: enter the vault-relative path of an existing Obsidian page. Disk browsing needs the desktop app. Opening still uses obsidian://.',
        );
      }
    }

    applyStaticText() {
      document.title = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('title').textContent = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('lede').textContent = this.t(
        'UI.LEDE',
        'Pick an existing Super Productivity project and link it to an existing page in your Obsidian vault. The plugin never creates a new page.',
      );
      qs('vault-heading').textContent = this.t('UI.VAULT', 'Obsidian vault');
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
      qs('link-heading').textContent = this.t(
        'UI.NEW_LINK',
        'Link an existing project',
      );
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
      qs('banner-open').textContent = this.t('UI.OPEN', 'Open in Obsidian');
    }

    bindEvents() {
      qs('save-vault').addEventListener('click', () => this.saveVault());
      qs('load-pages').addEventListener('click', () => this.loadPages());
      qs('save-binding').addEventListener('click', () => this.saveBinding());
      qs('project-select').addEventListener('change', () => this.onProjectChange());
      qs('page-search').addEventListener('input', () => {
        this.pageQuery = qs('page-search').value;
        this.renderPageList();
      });
      qs('manual-page').addEventListener('input', () => {
        this.selectedPage = qs('manual-page').value.trim();
        this.pagePicked = !!this.selectedPage;
        this.renderSelectedPage();
      });
      qs('banner-open').addEventListener('click', () => this.openCurrent());
      qs('banner-link').addEventListener('click', () => this.prefillCurrent());
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

    projectById(id) {
      return this.projects.find((project) => project.id === id) || null;
    }

    selectedProject() {
      return this.projectById(qs('project-select').value);
    }

    render() {
      qs('vault-name').value = this.state.vaultName;
      qs('vault-path').value = this.state.vaultPath;
      this.applyPlatformMode();
      this.renderProjectSelect();
      this.renderBanner();
      this.renderPageList();
      this.renderBindings();
      this.renderSelectedPage();
    }

    renderProjectSelect() {
      const select = qs('project-select');
      const previous = select.value;
      const linkedIds = new Set(this.state.bindings.map((item) => item.projectId));
      const options = this.projects
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((project) => {
          const linked = linkedIds.has(project.id)
            ? ` ${this.t('UI.ALREADY_LINKED', '(linked)')}`
            : '';
          return `<option value="${escapeHtml(project.id)}">${escapeHtml(
            project.title + linked,
          )}</option>`;
        });
      select.innerHTML =
        `<option value="">${escapeHtml(
          this.t('UI.CHOOSE_PROJECT', 'Choose an existing project…'),
        )}</option>` + options.join('');

      if (previous && this.projectById(previous)) {
        select.value = previous;
      } else if (this.context && this.context.type === 'PROJECT') {
        select.value = this.context.id;
      }
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
      const openBtn = qs('banner-open');
      const linkBtn = qs('banner-link');
      if (binding) {
        qs('banner-detail').textContent = Core.bindingTarget(binding);
        openBtn.classList.remove('hidden');
        linkBtn.textContent = this.t('UI.EDIT_LINK', 'Change page');
      } else {
        qs('banner-detail').textContent = this.t(
          'UI.CURRENT_UNLINKED',
          'Not linked to an Obsidian page yet.',
        );
        openBtn.classList.add('hidden');
        linkBtn.textContent = this.t('UI.LINK_THIS', 'Link this project');
      }
    }

    renderPageList() {
      const root = qs('page-list');
      if (!root || !this.canBrowse()) {
        this.renderSelectedPage();
        return;
      }
      const project = this.selectedProject();
      const visible = Core.filterPages(this.pages, this.pageQuery, project && project.title);
      this.renderSelectedPage();
      if (!this.pages.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t(
            'UI.PAGES_EMPTY',
            'Set the vault path and click Load existing pages to list notes already in the vault.',
          ),
        )}</p>`;
        return;
      }
      if (!visible.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t('UI.PAGES_NONE', 'No existing pages match this search.'),
        )}</p>`;
        return;
      }

      root.innerHTML = visible
        .map((page) => {
          const path = page.path || '';
          const selected = path === this.selectedPage ? ' selected' : '';
          const rank = Core.rankPage(path, project && project.title);
          const match = rank >= 3 ? ' match' : '';
          return `<button type="button" class="folder-item${selected}${match}" data-page="${escapeHtml(
            path,
          )}" title="${escapeHtml(path)}">${escapeHtml(path)}</button>`;
        })
        .join('');

      root.querySelectorAll('[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
          this.selectedPage = button.getAttribute('data-page') || '';
          this.pagePicked = true;
          this.renderPageList();
        });
      });
    }

    renderSelectedPage() {
      const el = qs('selected-page');
      if (!el) {
        return;
      }
      el.textContent = this.pagePicked && this.selectedPage
        ? this.selectedPage
        : this.t('UI.NO_PAGE_SELECTED', 'No page selected');
    }

    renderBindings() {
      const root = qs('bindings');
      if (!this.state.bindings.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t(
            'UI.EMPTY',
            'No links yet. Choose an existing project, pick an existing Obsidian page, then click Link.',
          ),
        )}</p>`;
        return;
      }

      root.innerHTML = this.state.bindings
        .map((binding) => {
          const project = this.projectById(binding.projectId);
          const title = project
            ? project.title
            : this.t('UI.MISSING_PROJECT', 'Missing project ({{id}})', {
                id: binding.projectId,
              });
          const page = Core.bindingTarget(binding);
          const missingClass = project ? '' : ' text-muted';
          return `
            <article class="card binding" data-project-id="${escapeHtml(
              binding.projectId,
            )}">
              <div class="binding-head">
                <div class="binding-title${missingClass}">
                  <span class="dot"></span>
                  <span>${escapeHtml(title)}</span>
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
              <div class="path text-muted">${escapeHtml(page)}</div>
            </article>
          `;
        })
        .join('');

      root.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const article = event.currentTarget.closest('[data-project-id]');
          const projectId = article && article.getAttribute('data-project-id');
          const action = event.currentTarget.getAttribute('data-action');
          if (action === 'toggle-menu') {
            this.toggleBindingMenu(article);
            return;
          }
          this.closeAllMenus();
          this.handleBindingAction(action, projectId);
        });
      });
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
      this.renderPageList();
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

    async saveVault() {
      const next = Core.updateVaultSettings(this.state, {
        vaultName: qs('vault-name').value,
        vaultPath: qs('vault-path').value,
      });
      await this.persist(next);
      this.setStatus(this.t('MSG.VAULT_SAVED', 'Vault settings saved.'), 'success');
      if (this.canBrowse() && next.vaultPath) {
        await this.loadPages();
      }
    }

    async loadPages() {
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
          this.pages = [];
          this.setStatus(parsed.error, 'error');
          this.renderPageList();
          return;
        }
        this.pages = parsed.pages;
        this.renderPageList();
        this.setStatus(
          this.t('MSG.PAGES_LOADED', 'Loaded {{count}} existing pages.', {
            count: this.pages.length,
          }),
          'success',
        );
      } catch (error) {
        this.pages = [];
        this.setStatus(
          error && error.message
            ? String(error.message)
            : this.t('MSG.PAGES_FAILED', 'Could not read existing vault pages.'),
          'error',
        );
        this.renderPageList();
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
      const result = Core.openExternalUri(uri);
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

  document.addEventListener('click', () => {
    document.querySelectorAll('.menu-panel').forEach((panel) => {
      panel.classList.add('hidden');
    });
  });

  waitForPluginApi();
})();
