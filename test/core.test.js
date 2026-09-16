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

  it('keeps vault settings and drops duplicate project bindings', () => {
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
    assert.equal(state.bindings[0].folderPath, 'Projects');
    assert.equal(state.bindings[0].filePath, 'Projects');
  });

  it('migrates an old note file binding to its parent folder', () => {
    const state = Core.parseState({
      bindings: [{ projectId: 'p1', filePath: 'Work/Elmec.md' }],
    });
    assert.equal(state.bindings[0].folderPath, 'Work');
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
  it('upserts and removes a project folder binding', () => {
    let result = Core.upsertBinding({}, 'proj-1', 'Projects/Website.md', 1000);
    assert.equal(result.ok, true);
    assert.equal(result.binding.folderPath, 'Projects');
    assert.equal(result.binding.filePath, 'Projects');
    assert.equal(result.binding.createdAt, 1000);

    result = Core.upsertBinding(result.state, 'proj-1', 'Work/Elmec', 2000);
    assert.equal(result.state.bindings.length, 1);
    assert.equal(result.state.bindings[0].folderPath, 'Work/Elmec');
    assert.equal(result.state.bindings[0].createdAt, 1000);
    assert.equal(result.state.bindings[0].updatedAt, 2000);

    const removed = Core.removeBinding(result.state, 'proj-1');
    assert.equal(removed.bindings.length, 0);
  });

  it('allows the vault root as a folder', () => {
    const result = Core.upsertBinding({}, 'proj-1', '', 1000);
    assert.equal(result.ok, true);
    assert.equal(result.binding.folderPath, '');
  });

  it('rejects an empty project or an unsafe path', () => {
    assert.equal(Core.upsertBinding({}, '', 'Projects').ok, false);
    const result = Core.upsertBinding({}, 'proj-1', '../outside');
    assert.equal(result.ok, false);
    assert.equal(result.state.bindings.length, 0);
  });
});

describe('obsidian URIs', () => {
  it('builds an open URI for a folder, not a note file', () => {
    const state = { vaultName: 'My Vault' };
    const uri = Core.buildOpenUri(state, { folderPath: 'Work/Elmec' });
    assert.equal(uri, 'obsidian://open?vault=My%20Vault&file=Work%2FElmec');
  });

  it('migrates a .md binding to the parent folder in the open URI', () => {
    const uri = Core.buildOpenUri(
      { vaultName: 'My Vault' },
      { filePath: 'Projects/Website.md' },
    );
    assert.equal(uri, 'obsidian://open?vault=My%20Vault&file=Projects');
  });

  it('omits an empty vault name and an empty vault-root file', () => {
    const uri = Core.buildOpenUri({ vaultName: '' }, { folderPath: '' });
    assert.equal(uri, 'obsidian://open?');
  });
});

describe('folder ranking', () => {
  it('lists likely project-name matches first', () => {
    const folders = ['Inbox', 'Projects/Website', 'Work/Elmec', 'Archive'];
    const ranked = Core.filterFolders(folders, '', 'Elmec');
    assert.equal(ranked[0], 'Work/Elmec');
  });

  it('filters by search query then ranks remaining matches', () => {
    const folders = [
      { path: 'Work/Elmec', name: 'Elmec' },
      { path: 'Projects/Website', name: 'Website' },
      { path: 'Personal/Elm', name: 'Elm' },
    ];
    const ranked = Core.filterFolders(folders, 'elm', 'Elmec');
    assert.deepEqual(
      ranked.map((folder) => folder.path),
      ['Work/Elmec', 'Personal/Elm'],
    );
  });
});

describe('vault folder listing', () => {
  it('walks a real vault-like folder tree and skips .obsidian', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-vault-'));
    fs.mkdirSync(path.join(tmp, 'Projects', 'Website'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'Work', 'Elmec'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.obsidian'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'Projects', 'readme.md'), '# note');

    const script = Core.listVaultFoldersScript(tmp);
    const folders = new Function('require', script)(require);
    const paths = folders.map((folder) => folder.path).sort();

    assert.deepEqual(paths, ['', 'Projects', 'Projects/Website', 'Work', 'Work/Elmec']);
    assert.ok(script.includes('.obsidian'));
  });

  it('parses executeNodeScript folder results', () => {
    const parsed = Core.parseNodeFolderResult({
      success: true,
      result: [
        { path: '', name: '(vault root)' },
        { path: 'Work/Elmec', name: 'Elmec' },
        'Projects',
      ],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.folders.length, 3);
    assert.equal(parsed.folders[1].path, 'Work/Elmec');
  });

  it('surfaces node script failures', () => {
    const parsed = Core.parseNodeFolderResult({
      success: false,
      error: { message: 'Vault folder not found' },
    });
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /Vault folder not found/);
  });
});

describe('path helpers', () => {
  it('suggests a safe file path from the project title', () => {
    assert.equal(
      Core.suggestFilePath('Site / Launch*', 'Projects'),
      'Projects/Site - Launch-.md',
    );
  });

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
    assert.equal(String(result), 'Save');
  });

  it('uses a string translation when the host returns one', () => {
    const api = {
      translate(key) {
        return key === 'UI.SAVE' ? 'Save settings' : key;
      },
    };
    assert.equal(Core.t(api, 'UI.SAVE', 'Save'), 'Save settings');
  });

  it('interpolates fallback params', () => {
    assert.equal(
      Core.t(null, 'MSG.OPENING_NOTE', 'Opening {{file}}…', { file: 'Note.md' }),
      'Opening Note.md…',
    );
  });
});
