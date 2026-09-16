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
    }

    t(key, fallback, params) {
      return Core.t(PluginAPI, key, fallback, params);
    }

    async init() {
      this.bindEvents();
      this.applyStaticText();
      await this.refresh();
      this.setupHooks();
    }

    applyStaticText() {
      document.title = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('title').textContent = this.t('PLUGIN.NAME', 'Obsidian Connector');
      qs('lede').textContent = this.t(
        'UI.LEDE',
        'Link each Super Productivity project to a Markdown file in your Obsidian vault. Opening the link launches that note in Obsidian.',
      );
      qs('vault-heading').textContent = this.t('UI.VAULT', 'Obsidian vault');
      qs('vault-name-label').textContent = this.t('UI.VAULT_NAME', 'Vault name');
      qs('vault-name-hint').textContent = this.t(
        'UI.VAULT_NAME_HINT',
        'Use the name shown in Obsidian (usually the vault folder name). Leave empty to open the most recently used vault.',
      );
      qs('default-folder-label').textContent = this.t(
        'UI.DEFAULT_FOLDER',
        'Default folder',
      );
      qs('default-folder-hint').textContent = this.t(
        'UI.DEFAULT_FOLDER_HINT',
        'Used when suggesting a path for a new link, for example Projects/My project.md.',
      );
      qs('save-vault').textContent = this.t('UI.SAVE', 'Save');
      qs('link-heading').textContent = this.t('UI.NEW_LINK', 'Link a project');
      qs('project-label').textContent = this.t('UI.PROJECT', 'Project');
      qs('file-path-label').textContent = this.t(
        'UI.FILE_PATH',
        'Note path in the vault',
      );
      qs('file-path-hint').textContent = this.t(
        'UI.FILE_PATH_HINT',
        'Relative to the vault root. Example: Projects/Website.md',
      );
      qs('suggest-path').textContent = this.t('UI.SUGGEST', 'Suggest path');
      qs('save-binding').textContent = this.t('UI.LINK', 'Link');
      qs('list-heading').textContent = this.t('UI.LINKED', 'Linked projects');
      qs('banner-open').textContent = this.t('UI.OPEN', 'Open in Obsidian');
    }

    bindEvents() {
      qs('save-vault').addEventListener('click', () => this.saveVault());
      qs('suggest-path').addEventListener('click', () => this.suggestPath());
      qs('save-binding').addEventListener('click', () => this.saveBinding());
      qs('project-select').addEventListener('change', () => this.onProjectChange());
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

    render() {
      qs('vault-name').value = this.state.vaultName;
      qs('default-folder').value = this.state.defaultFolder;
      this.renderProjectSelect();
      this.renderBanner();
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
          this.t('UI.CHOOSE_PROJECT', 'Choose a project…'),
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
        qs('banner-detail').textContent = binding.filePath;
        openBtn.classList.remove('hidden');
        linkBtn.textContent = this.t('UI.EDIT_LINK', 'Edit link');
      } else {
        qs('banner-detail').textContent = this.t(
          'UI.CURRENT_UNLINKED',
          'This project is not linked yet.',
        );
        openBtn.classList.add('hidden');
        linkBtn.textContent = this.t('UI.LINK_THIS', 'Link this project');
      }
    }

    renderBindings() {
      const root = qs('bindings');
      if (!this.state.bindings.length) {
        root.innerHTML = `<p class="empty text-muted">${escapeHtml(
          this.t(
            'UI.EMPTY',
            'No projects linked yet. Pick a project and a vault file path, then click Link.',
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
          const missingClass = project ? '' : ' text-muted';
          return `
            <article class="card binding" data-project-id="${escapeHtml(
              binding.projectId,
            )}">
              <div class="binding-title${missingClass}">
                <span class="dot"></span>
                <span>${escapeHtml(title)}</span>
              </div>
              <div class="path text-muted">${escapeHtml(binding.filePath)}</div>
              <div class="actions">
                <button type="button" data-action="open">${escapeHtml(
                  this.t('UI.OPEN', 'Open in Obsidian'),
                )}</button>
                <button type="button" data-action="create">${escapeHtml(
                  this.t('UI.CREATE', 'Create note'),
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
      const projectId = qs('project-select').value;
      const binding = Core.getBinding(this.state, projectId);
      if (binding) {
        qs('file-path').value = binding.filePath;
      }
    }

    suggestPath() {
      const project = this.projectById(qs('project-select').value);
      if (!project) {
        this.setStatus(
          this.t('MSG.CHOOSE_PROJECT_FIRST', 'Choose a project first.'),
          'error',
        );
        return;
      }
      qs('file-path').value = Core.suggestFilePath(
        project.title,
        qs('default-folder').value || this.state.defaultFolder,
      );
    }

    prefillCurrent() {
      if (!this.context || this.context.type !== 'PROJECT') {
        return;
      }
      qs('project-select').value = this.context.id;
      this.onProjectChange();
      if (!qs('file-path').value) {
        this.suggestPath();
      }
      qs('file-path').focus();
    }

    async persist(nextState) {
      this.state = nextState;
      await PluginAPI.persistDataSynced(Core.serializeState(nextState));
      this.render();
    }

    async saveVault() {
      const next = Core.updateVaultSettings(this.state, {
        vaultName: qs('vault-name').value,
        defaultFolder: qs('default-folder').value,
      });
      await this.persist(next);
      this.setStatus(this.t('MSG.VAULT_SAVED', 'Vault settings saved.'), 'success');
    }

    async saveBinding() {
      const projectId = qs('project-select').value;
      const filePath = qs('file-path').value;
      const result = Core.upsertBinding(this.state, projectId, filePath);
      if (!result.ok) {
        this.setStatus(
          this.t('MSG.INVALID_PATH', result.message),
          'error',
        );
        return;
      }
      await this.persist(result.state);
      this.setStatus(this.t('MSG.LINKED', 'Project linked to Obsidian file.'), 'success');
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

      if (action === 'open') {
        await this.openUri(Core.buildOpenUri(this.state, binding), binding.filePath);
        return;
      }

      if (action === 'create') {
        await this.openUri(
          Core.buildNewUri(this.state, binding, this.projectById(projectId)),
          binding.filePath,
        );
        return;
      }

      if (action === 'copy-uri') {
        const uri = Core.buildOpenUri(this.state, binding);
        const copied = await Core.copyText(uri);
        this.setStatus(
          copied
            ? this.t('MSG.COPIED', 'Copied to clipboard.')
            : uri,
          copied ? 'success' : 'error',
        );
        return;
      }

      if (action === 'copy-wiki') {
        const copied = await Core.copyText(Core.wikiLink(binding.filePath));
        this.setStatus(
          copied
            ? this.t('MSG.COPIED', 'Copied to clipboard.')
            : Core.wikiLink(binding.filePath),
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
              'Remove the Obsidian link for "{{title}}"? The note in the vault is not deleted.',
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
      await this.openUri(Core.buildOpenUri(this.state, binding), binding.filePath);
    }

    async openUri(uri, filePath) {
      if (!uri) {
        this.setStatus(this.t('MSG.OPEN_FAILED', 'Could not build the Obsidian URI.'), 'error');
        return;
      }
      const result = Core.openExternalUri(uri);
      if (result.ok) {
        this.setStatus(
          this.t('MSG.OPENING_NOTE', 'Opening {{file}} in Obsidian…', {
            file: filePath || '',
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
