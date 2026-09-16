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
