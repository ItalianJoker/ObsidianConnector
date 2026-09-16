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
      this.folders = [];
      this.selectedFolder = '';
      this.folderQuery = '';
      this.folderPicked = false;
      this.lastProjectId = '';
    }

    t(key, fallback, params) {
      const value = Core.t(PluginAPI, key, fallback, params);
      return typeof value === 'string' && value ? value : fallback || key;
    }

    canScanVault() {
      return typeof PluginAPI.executeNodeScript === 'function';
    }

    async init() {
      this.bindEvents();
      this.applyStaticText();
      await this.refresh();
      this.setupHooks();
      if (this.state.vaultPath) {
        await this.loadFolders();
      }
    }

    applyStaticText() {
      document.title = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('title').textContent = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('lede').textContent = this.t(
        'UI.LEDE',
        'Pick an existing Super Productivity project and link it to an existing folder in your Obsidian vault. Nothing new is created.',
      );
      qs('vault-heading').textContent = this.t('UI.VAULT', 'Obsidian vault');
      qs('vault-name-label').textContent = this.t('UI.VAULT_NAME', 'Vault name');
      qs('vault-name-hint').textContent = this.t(
        'UI.VAULT_NAME_HINT',
        'The name shown in Obsidian. Used only to open the folder with obsidian://',
      );
      qs('vault-path-label').textContent = this.t(
        'UI.VAULT_PATH',
        'Vault folder on this computer',
      );
      qs('vault-path-hint').textContent = this.t(
        'UI.VAULT_PATH_HINT',
        'Absolute path to the vault, e.g. /home/you/Obsidian/Work. Needed to list folders. Desktop app only.',
      );
      qs('save-vault').textContent = this.t('UI.SAVE', 'Save');
      qs('load-folders').textContent = this.t('UI.LOAD_FOLDERS', 'Load folders');
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
      qs('folder-label').textContent = this.t(
        'UI.FOLDER',
        'Obsidian folder',
      );
      qs('folder-hint').textContent = this.t(
        'UI.FOLDER_HINT',
        'Choose the vault folder that matches this project. Load folders after setting the vault path.',
      );
      qs('folder-search').placeholder = this.t(
        'UI.FOLDER_SEARCH',
        'Search folders…',
      );
      qs('save-binding').textContent = this.t('UI.LINK', 'Link to selected folder');
      qs('selected-folder-label').textContent = this.t(
        'UI.SELECTED_FOLDER',
        'Selected folder',
      );
      qs('list-heading').textContent = this.t('UI.LINKED', 'Linked projects');
      qs('banner-open').textContent = this.t('UI.OPEN', 'Open in Obsidian');
    }

    bindEvents() {
      qs('save-vault').addEventListener('click', () => this.saveVault());
      qs('load-folders').addEventListener('click', () => this.loadFolders());
      qs('save-binding').addEventListener('click', () => this.saveBinding());
      qs('project-select').addEventListener('change', () => this.onProjectChange());
      qs('folder-search').addEventListener('input', () => {
        this.folderQuery = qs('folder-search').value;
        this.renderFolderList();
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
      this.renderProjectSelect();
      this.renderBanner();
      this.renderFolderList();
      this.renderBindings();
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
        const folder = Core.bindingTarget(binding);
        qs('banner-detail').textContent = folder
          ? folder
          : this.t('UI.VAULT_ROOT', '(vault root)');
        openBtn.classList.remove('hidden');
        linkBtn.textContent = this.t('UI.EDIT_LINK', 'Change folder');
      } else {
        qs('banner-detail').textContent = this.t(
          'UI.CURRENT_UNLINKED',
          'Not linked to an Obsidian folder yet.',
        );
        openBtn.classList.add('hidden');
        linkBtn.textContent = this.t('UI.LINK_THIS', 'Link this project');
      }
    }

    renderFolderList() {
      const root = qs('folder-list');
      const project = this.selectedProject();
      const visible = Core.filterFolders(this.folders, this.folderQuery, project && project.title);
      this.renderSelectedFolder();
      if (!this.folders.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t(
            'UI.FOLDERS_EMPTY',
            'Set the vault path and click Load folders to see every folder in the vault.',
          ),
        )}</p>`;
        return;
      }
      if (!visible.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t('UI.FOLDERS_NONE', 'No folders match this search.'),
        )}</p>`;
        return;
      }

      root.innerHTML = visible
        .map((folder) => {
          const path = folder.path || '';
          const label = path || this.t('UI.VAULT_ROOT', '(vault root)');
          const selected = path === this.selectedFolder ? ' selected' : '';
          const rank = Core.rankFolder(path, project && project.title);
          const match = rank >= 3 ? ' match' : '';
          return `<button type="button" class="folder-item${selected}${match}" data-folder="${escapeHtml(
            path,
          )}" title="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
        })
        .join('');

      root.querySelectorAll('[data-folder]').forEach((button) => {
        button.addEventListener('click', () => {
          this.selectedFolder = button.getAttribute('data-folder') || '';
          this.folderPicked = true;
          this.renderFolderList();
        });
      });
      this.renderSelectedFolder();
    }

    renderSelectedFolder() {
      const el = qs('selected-folder');
      if (!el) {
        return;
      }
      el.textContent = this.folderPicked
        ? this.selectedFolder || this.t('UI.VAULT_ROOT', '(vault root)')
        : this.t('UI.NO_FOLDER_SELECTED', 'No folder selected');
    }

    renderBindings() {
      const root = qs('bindings');
      if (!this.state.bindings.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t(
            'UI.EMPTY',
            'No links yet. Choose an existing project, pick an Obsidian folder, then click Link.',
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
          const folder = Core.bindingTarget(binding);
          const folderLabel = folder || this.t('UI.VAULT_ROOT', '(vault root)');
          const missingClass = project ? '' : ' text-muted';
          return `
            <article class="card binding" data-project-id="${escapeHtml(
              binding.projectId,
            )}">
              <div class="binding-title${missingClass}">
                <span class="dot"></span>
                <span>${escapeHtml(title)}</span>
              </div>
              <div class="path text-muted">${escapeHtml(folderLabel)}</div>
              <div class="actions">
                <button type="button" data-action="open">${escapeHtml(
                  this.t('UI.OPEN', 'Open in Obsidian'),
                )}</button>
                <button type="button" data-action="copy-uri">${escapeHtml(
                  this.t('UI.COPY_URI', 'Copy URI'),
                )}</button>
                <button type="button" data-action="copy-wiki">${escapeHtml(
                  this.t('UI.COPY_WIKI', 'Copy [[wiki]]'),
                )}</button>
                <button type="button" class="danger" data-action="unlink">${escapeHtml(
                  this.t('UI.UNLINK', 'Unlink'),
                )}</button>
              </div>
            </article>
          `;
        })
        .join('');

      root.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const article = event.currentTarget.closest('[data-project-id]');
          const projectId = article && article.getAttribute('data-project-id');
          this.handleBindingAction(event.currentTarget.getAttribute('data-action'), projectId);
        });
      });
    }

    onProjectChange() {
      const project = this.selectedProject();
      const projectId = project ? project.id : '';
      if (this.lastProjectId !== projectId) {
        this.lastProjectId = projectId;
        const binding = project ? Core.getBinding(this.state, project.id) : null;
        if (binding) {
          this.selectedFolder = Core.bindingTarget(binding);
          this.folderPicked = true;
        } else {
          this.selectedFolder = '';
          this.folderPicked = false;
        }
      }
      if (project && !this.folderQuery) {
        qs('folder-search').placeholder = this.t(
          'UI.FOLDER_SEARCH_FOR',
          'Search folders… (matches for "{{title}}" are listed first)',
          { title: project.title },
        );
      }
      this.renderFolderList();
    }

    prefillCurrent() {
      if (!this.context || this.context.type !== 'PROJECT') {
        return;
      }
      qs('project-select').value = this.context.id;
      this.folderQuery = '';
      qs('folder-search').value = '';
      this.onProjectChange();
      qs('folder-list').scrollIntoView({ block: 'nearest' });
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
      if (next.vaultPath) {
        await this.loadFolders();
      }
    }

    async loadFolders() {
      const vaultPath = Core.normalizeVaultRootPath(qs('vault-path').value || this.state.vaultPath);
      if (!vaultPath) {
        this.setStatus(
          this.t(
            'MSG.VAULT_PATH_REQUIRED',
            'Enter the vault folder path on this computer, then load folders.',
          ),
          'error',
        );
        return;
      }
      if (!this.canScanVault()) {
        this.setStatus(
          this.t(
            'MSG.DESKTOP_ONLY',
            'Listing Obsidian folders needs the Super Productivity desktop app, with file access allowed for this plugin.',
          ),
          'error',
        );
        return;
      }

      this.setStatus(this.t('MSG.LOADING_FOLDERS', 'Reading vault folders…'), 'info');
      try {
        const result = await PluginAPI.executeNodeScript({
          script: Core.listVaultFoldersScript(vaultPath),
          timeout: 15000,
        });
        const parsed = Core.parseNodeFolderResult(result);
        if (!parsed.ok) {
          this.folders = [];
          this.setStatus(parsed.error, 'error');
          this.renderFolderList();
          return;
        }
        this.folders = parsed.folders;
        this.renderFolderList();
        this.setStatus(
          this.t('MSG.FOLDERS_LOADED', 'Loaded {{count}} folders.', {
            count: this.folders.length,
          }),
          'success',
        );
      } catch (error) {
        this.folders = [];
        this.setStatus(
          error && error.message
            ? String(error.message)
            : this.t('MSG.FOLDERS_FAILED', 'Could not read the vault folders.'),
          'error',
        );
        this.renderFolderList();
      }
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
      if (!this.folders.length) {
        this.setStatus(
          this.t(
            'MSG.LOAD_FOLDERS_FIRST',
            'Load the vault folders first, then select the folder that matches this project.',
          ),
          'error',
        );
        return;
      }
      if (!this.folderPicked || !this.hasExplicitFolderSelection()) {
        this.setStatus(
          this.t('MSG.CHOOSE_FOLDER', 'Select an Obsidian folder from the list.'),
          'error',
        );
        return;
      }

      const result = Core.upsertBinding(this.state, projectId, this.selectedFolder || '');
      if (!result.ok) {
        this.setStatus(this.t('MSG.INVALID_PATH', result.message), 'error');
        return;
      }
      await this.persist(result.state);
      this.setStatus(
        this.t('MSG.LINKED', 'Project linked to the selected Obsidian folder.'),
        'success',
      );
    }

    hasExplicitFolderSelection() {
      if (!this.folders.length) {
        return false;
      }
      return this.folders.some((folder) => (folder.path || '') === (this.selectedFolder || ''));
    }

    async handleBindingAction(action, projectId) {
      const binding = Core.getBinding(this.state, projectId);
      if (!binding && action !== 'unlink') {
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

      const folder = Core.bindingTarget(binding);
      if (action === 'open') {
        await this.openUri(Core.buildOpenUri(this.state, binding), folder);
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
        const wiki = folder ? Core.wikiLink(folder) : '';
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
              'Remove the Obsidian folder link for "{{title}}"? Nothing in the vault is deleted.',
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

    async openUri(uri, folder) {
      if (!uri) {
        this.setStatus(this.t('MSG.OPEN_FAILED', 'Could not build the Obsidian URI.'), 'error');
        return;
      }
      const result = Core.openExternalUri(uri);
      if (result.ok) {
        this.setStatus(
          this.t('MSG.OPENING_NOTE', 'Opening {{file}} in Obsidian…', {
            file: folder || this.t('UI.VAULT_ROOT', '(vault root)'),
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
