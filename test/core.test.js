const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../src/core.js');

describe('parseState', () => {
  it('returns empty state for invalid input', () => {
    assert.deepEqual(Core.parseState(null).bindings, []);
    assert.equal(Core.parseState('not-json').vaultName, '');
    assert.equal(Core.parseState([]).defaultFolder, 'Projects');
  });

  it('keeps vault settings and note bindings', () => {
    const state = Core.parseState({
      vaultName: '  Work  ',
      vaultPath: '/home/you/Obsidian/Work/',
      defaultFolder: '\\Notes\\Projects\\',
      bindings: [
        { projectId: 'a', filePath: 'Projects/one.md', createdAt: 1, updatedAt: 1 },
        { projectId: 'a', filePath: 'Projects/two.md', createdAt: 2, updatedAt: 2 },
        { projectId: '', filePath: 'skip.md' },
      ],
    });
    assert.equal(state.vaultName, 'Work');
    assert.equal(state.vaultPath, '/home/you/Obsidian/Work');
    assert.equal(state.defaultFolder, 'Notes/Projects');
    assert.equal(state.bindings.length, 1);
    assert.equal(state.bindings[0].filePath, 'Projects/two.md');
    assert.equal(state.bindings[0].folderPath, 'Projects');
  });

  it('keeps legacy folder bindings openable without inventing a .md page', () => {
    const state = Core.parseState({
      bindings: [{ projectId: 'p1', folderPath: 'Work/Elmec', filePath: 'Work/Elmec' }],
    });
    assert.equal(state.bindings[0].filePath, 'Work/Elmec');
    assert.equal(Core.bindingTarget(state.bindings[0]), 'Work/Elmec');
  });
});

describe('normalizeVaultFilePath', () => {
  it('normalizes slashes and strips a leading slash', () => {
    assert.equal(Core.normalizeVaultFilePath('  Projects\\Note.md  '), 'Projects/Note.md');
    assert.equal(Core.normalizeVaultFilePath('/Projects/Note.md'), 'Projects/Note.md');
  });

  it('rejects absolute and parent paths', () => {
    assert.equal(Core.normalizeVaultFilePath('C:\\Vault\\Note.md'), '');
    assert.equal(Core.normalizeVaultFilePath('..\\secret.md'), '');
    assert.equal(Core.normalizeVaultFilePath('Projects/../../etc/passwd'), '');
  });
});

describe('normalizeVaultRootPath', () => {
  it('accepts absolute POSIX and Windows vault paths', () => {
    assert.equal(Core.normalizeVaultRootPath('/home/you/Vault/'), '/home/you/Vault');
    assert.equal(Core.normalizeVaultRootPath('C:\\Users\\you\\Vault'), 'C:/Users/you/Vault');
  });

  it('rejects relative and UNC paths', () => {
    assert.equal(Core.normalizeVaultRootPath('Obsidian/Work'), '');
    assert.equal(Core.normalizeVaultRootPath('//server/share'), '');
  });
});

describe('bindings', () => {
  it('upserts an existing note page binding', () => {
    let result = Core.upsertBinding({}, 'proj-1', 'Projects/Website.md', 1000);
    assert.equal(result.ok, true);
    assert.equal(result.binding.filePath, 'Projects/Website.md');
    assert.equal(result.binding.folderPath, 'Projects');
    assert.equal(result.binding.createdAt, 1000);

    result = Core.upsertBinding(result.state, 'proj-1', 'Work/Elmec', 2000);
    assert.equal(result.state.bindings.length, 1);
    assert.equal(result.state.bindings[0].filePath, 'Work/Elmec.md');
    assert.equal(result.state.bindings[0].createdAt, 1000);
    assert.equal(result.state.bindings[0].updatedAt, 2000);

    const removed = Core.removeBinding(result.state, 'proj-1');
    assert.equal(removed.bindings.length, 0);
  });

  it('rejects an empty project, empty path, or unsafe path', () => {
    assert.equal(Core.upsertBinding({}, '', 'Projects/A.md').ok, false);
    assert.equal(Core.upsertBinding({}, 'proj-1', '').ok, false);
    const result = Core.upsertBinding({}, 'proj-1', '../outside.md');
    assert.equal(result.ok, false);
    assert.equal(result.state.bindings.length, 0);
  });
});

describe('obsidian URIs', () => {
  it('builds an open URI for an existing page', () => {
    const state = { vaultName: 'My Vault' };
    const uri = Core.buildOpenUri(state, { filePath: 'Work/Elmec.md' });
    assert.equal(uri, 'obsidian://open?vault=My%20Vault&file=Work%2FElmec');
  });

  it('opens existing pages with obsidian://open only', () => {
    const open = Core.buildOpenUri({ vaultName: 'Work' }, { filePath: 'A.md' });
    assert.match(open, /^obsidian:\/\/open\?/);
    assert.doesNotMatch(open, /obsidian:\/\/new/);
    assert.equal(typeof Core.buildNewUri, 'undefined');
  });

  it('omits an empty vault name', () => {
    const uri = Core.buildOpenUri({ vaultName: '' }, { filePath: 'Inbox.md' });
    assert.equal(uri, 'obsidian://open?file=Inbox');
  });

  it('encodeURIComponent-encodes vault and file params', () => {
    const uri = Core.buildOpenUri(
      { vaultName: 'Work & Home' },
      { filePath: 'Projects/A & B?.md' },
    );
    assert.equal(
      uri,
      'obsidian://open?vault=Work%20%26%20Home&file=Projects%2FA%20%26%20B%3F',
    );
    assert.equal(Core.isSafeObsidianOpenUri(uri), true);
    assert.equal(Core.isSafeObsidianOpenUri('https://evil.example'), false);
    assert.equal(Core.isSafeObsidianOpenUri('obsidian://new?file=X'), false);
    assert.equal(Core.isSafeObsidianOpenUri('javascript:alert(1)'), false);
  });
});

describe('openExternalUri', () => {
  it('hands a safe URI to executeNodeScript (Electron cold-start path)', async () => {
    const calls = [];
    const api = {
      async executeNodeScript(req) {
        calls.push(req);
        return { success: true, result: { ok: true, via: 'electron' } };
      },
    };
    const uri = Core.buildOpenUri({ vaultName: 'My Vault' }, { filePath: 'Work/A & B.md' });
    const result = await Core.openExternalUri(uri, api, { retry: false });
    assert.equal(result.ok, true);
    assert.equal(result.via, 'electron');
    assert.equal(calls.length, 1);
    assert.match(calls[0].script, /shell\.openExternal/);
    assert.match(calls[0].script, /obsidian:\/\/open\?vault=My%20Vault&file=Work%2FA%20%26%20B/);
    assert.match(Core.openObsidianUriScript(uri), /spawn\('open'/);
  });

  it('refuses non-obsidian URIs even when a node bridge is present', async () => {
    let called = false;
    const result = await Core.openExternalUri('https://evil.example', {
      async executeNodeScript() {
        called = true;
        return { success: true };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });

  it('returns not-ok in Node when no launcher is available', async () => {
    const uri = Core.buildOpenUri({ vaultName: 'V' }, { filePath: 'Inbox.md' });
    const result = await Core.openExternalUri(uri, null, { retry: false });
    assert.equal(result.ok, false);
    assert.equal(result.uri, uri);
  });

  it('retries the same encoded URI once after launch without blocking', async () => {
    const calls = [];
    const api = {
      async executeNodeScript(req) {
        calls.push(req.script);
        return { success: true, result: { ok: true, via: 'electron' } };
      },
    };
    const uri = Core.buildOpenUri(
      { vaultName: 'Work & Home' },
      { filePath: 'Projects/A & B.md' },
    );
    const started = Date.now();
    const result = await Core.openExternalUri(uri, api, { retryDelayMs: 20 });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.ok(Date.now() - started < 100);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(calls.length, 2);
    assert.equal(calls[0], calls[1]);
    assert.match(calls[1], /obsidian:\/\/open\?vault=Work%20%26%20Home&file=Projects%2FA%20%26%20B/);
    Core.cancelScheduledOpenRetry();
  });
});

describe('debounce', () => {
  it('collapses rapid calls and exposes cancel', async () => {
    let n = 0;
    const fn = Core.debounce(() => {
      n += 1;
    }, 20);
    fn();
    fn();
    fn();
    assert.equal(n, 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(n, 1);
    fn();
    fn.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(n, 1);
  });
});

describe('note tree', () => {
  const pages = [
    'Inbox.md',
    'Projects/Client/Alpha.md',
    'Projects/Website.md',
    'Work/Elmec.md',
  ];

  it('parses vault-relative paths into folders then files', () => {
    const tree = Core.buildNoteTree(pages);
    const names = tree.children.map((node) => `${node.type}:${node.name}`);
    assert.deepEqual(names, ['folder:Projects', 'folder:Work', 'file:Inbox']);
    const projects = tree.children[0];
    assert.equal(projects.children[0].type, 'folder');
    assert.equal(projects.children[0].name, 'Client');
    assert.equal(projects.children[0].children[0].path, 'Projects/Client/Alpha.md');
    assert.equal(projects.children[1].path, 'Projects/Website.md');
  });

  it('omits children of collapsed folders from visible rows', () => {
    const tree = Core.buildNoteTree(pages);
    const collapsed = Core.flattenVisibleTree(tree, new Set());
    assert.deepEqual(
      collapsed.map((row) => row.path),
      ['Projects', 'Work', 'Inbox.md'],
    );
    const opened = Core.flattenVisibleTree(tree, new Set(['Projects']));
    assert.ok(opened.some((row) => row.path === 'Projects/Website.md'));
    assert.ok(opened.some((row) => row.path === 'Projects/Client'));
    assert.equal(
      opened.some((row) => row.path === 'Projects/Client/Alpha.md'),
      false,
    );
  });

  it('auto-expands matching tree branches when filtering', () => {
    const tree = Core.buildNoteTree(pages);
    const { tree: filtered, expanded } = Core.filterNoteTree(tree, 'Alpha');
    assert.equal(expanded.has('Projects'), true);
    assert.equal(expanded.has('Projects/Client'), true);
    const rows = Core.flattenVisibleTree(filtered, expanded);
    assert.ok(rows.some((row) => row.path === 'Projects/Client/Alpha.md'));
    assert.equal(
      rows.some((row) => row.path === 'Work/Elmec.md'),
      false,
    );
  });

  it('lists ancestor folders of a selected file', () => {
    assert.deepEqual(Core.ancestorFolderPaths('Projects/Client/Alpha.md'), [
      'Projects',
      'Projects/Client',
    ]);
  });
});

describe('filterBindings', () => {
  it('filters linked projects by title or path', () => {
    const bindings = [
      { projectId: 'p1', filePath: 'Work/Elmec.md' },
      { projectId: 'p2', filePath: 'Projects/Website.md' },
    ];
    const titles = { p1: 'Elmec', p2: 'Website' };
    const byTitle = Core.filterBindings(bindings, 'web', (id) => titles[id]);
    assert.deepEqual(
      byTitle.map((b) => b.projectId),
      ['p2'],
    );
    const byPath = Core.filterBindings(bindings, 'work/', (id) => titles[id]);
    assert.deepEqual(
      byPath.map((b) => b.projectId),
      ['p1'],
    );
  });
});

describe('vaultConfigStatus', () => {
  it('flags a missing desktop vault path and an empty vault name', () => {
    const missing = Core.vaultConfigStatus({ vaultName: '', vaultPath: 'relative' }, {
      requirePath: true,
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.errors.length, 1);
    assert.equal(missing.warnings.length, 1);

    const ok = Core.vaultConfigStatus(
      { vaultName: 'Work', vaultPath: '/home/you/Vault' },
      { requirePath: true },
    );
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(ok.warnings, []);
  });
});

describe('page ranking', () => {
  it('lists likely project-name matches first', () => {
    const pages = [
      'Inbox.md',
      'Projects/Website.md',
      'Work/Elmec.md',
      'Archive.md',
    ];
    const ranked = Core.filterPages(pages, '', 'Elmec');
    assert.equal(ranked[0], 'Work/Elmec.md');
  });
});

describe('vault page listing', () => {
  it('walks a real vault-like tree and lists existing .md pages only', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-vault-'));
    fs.mkdirSync(path.join(tmp, 'Projects'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'Work'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.obsidian'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'Projects', 'Website.md'), '# Website');
    fs.writeFileSync(path.join(tmp, 'Work', 'Elmec.md'), '# Elmec');
    fs.writeFileSync(path.join(tmp, '.obsidian', 'app.json'), '{}');
    fs.writeFileSync(path.join(tmp, 'readme.txt'), 'ignore');

    const script = Core.listVaultPagesScript(tmp);
    const pages = new Function('require', script)(require);
    const paths = pages.map((page) => page.path).sort();

    assert.deepEqual(paths, ['Projects/Website.md', 'Work/Elmec.md']);
  });

  it('parses executeNodeScript page results', () => {
    const parsed = Core.parseNodePageResult({
      success: true,
      result: [
        { path: 'Work/Elmec.md', name: 'Elmec' },
        { path: 'Projects/Website.md', name: 'Website' },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.pages.length, 2);
    assert.equal(parsed.pages[0].path, 'Work/Elmec.md');
  });
});

describe('platform helpers', () => {
  it('detects desktop browse capability and mobile platforms', () => {
    assert.equal(Core.isDesktopPlatform({ cfg: { platform: 'desktop' } }), true);
    assert.equal(Core.isMobilePlatform({ cfg: { platform: 'android' } }), true);
    assert.equal(Core.isMobilePlatform({ cfg: { platform: 'ios' } }), true);
    assert.equal(
      Core.canBrowseVault({
        cfg: { platform: 'desktop' },
        executeNodeScript() {},
      }),
      true,
    );
    assert.equal(
      Core.canBrowseVault({
        cfg: { platform: 'android' },
        executeNodeScript() {},
      }),
      false,
    );
  });
});

describe('path helpers', () => {
  it('builds a wiki link without the .md suffix', () => {
    assert.equal(Core.wikiLink('Projects/Website.md'), '[[Projects/Website]]');
  });

  it('filters archived and hidden projects', () => {
    const visible = Core.visibleProjects([
      { id: '1', title: 'A', isArchived: true },
      { id: '2', title: 'B', isHiddenFromMenu: true },
      { id: '3', title: 'C' },
    ]);
    assert.deepEqual(
      visible.map((p) => p.id),
      ['3'],
    );
  });
});

describe('t', () => {
  it('uses the English fallback when translate returns a Promise', () => {
    const api = {
      translate() {
        return Promise.resolve('Translated');
      },
    };
    const result = Core.t(api, 'UI.SAVE', 'Save');
    assert.equal(result, 'Save');
  });

  it('uses a string translation when the host returns one', () => {
    const api = {
      translate(key) {
        return key === 'UI.SAVE' ? 'Save settings' : key;
      },
    };
    assert.equal(Core.t(api, 'UI.SAVE', 'Save'), 'Save settings');
  });
});
