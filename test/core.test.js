const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
      defaultFolder: '\\Notes\\Projects\\',
      bindings: [
        { projectId: 'a', filePath: 'one.md', createdAt: 1, updatedAt: 1 },
        { projectId: 'a', filePath: 'two.md', createdAt: 2, updatedAt: 2 },
        { projectId: '', filePath: 'skip.md' },
      ],
    });
    assert.equal(state.vaultName, 'Work');
    assert.equal(state.defaultFolder, 'Notes/Projects');
    assert.equal(state.bindings.length, 1);
    assert.equal(state.bindings[0].filePath, 'two.md');
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

describe('bindings', () => {
  it('upserts and removes a project binding', () => {
    let result = Core.upsertBinding({}, 'proj-1', 'Projects/Website.md', 1000);
    assert.equal(result.ok, true);
    assert.equal(result.binding.filePath, 'Projects/Website.md');
    assert.equal(result.binding.createdAt, 1000);

    result = Core.upsertBinding(result.state, 'proj-1', 'Projects/Site.md', 2000);
    assert.equal(result.state.bindings.length, 1);
    assert.equal(result.state.bindings[0].filePath, 'Projects/Site.md');
    assert.equal(result.state.bindings[0].createdAt, 1000);
    assert.equal(result.state.bindings[0].updatedAt, 2000);

    const removed = Core.removeBinding(result.state, 'proj-1');
    assert.equal(removed.bindings.length, 0);
  });

  it('rejects an empty or unsafe path', () => {
    const result = Core.upsertBinding({}, 'proj-1', '../outside.md');
    assert.equal(result.ok, false);
    assert.equal(result.state.bindings.length, 0);
  });
});

describe('obsidian URIs', () => {
  it('builds an open URI with encoded vault and file', () => {
    const state = { vaultName: 'My Vault' };
    const uri = Core.buildOpenUri(state, { filePath: 'Projects/Sito web.md' });
    assert.equal(
      uri,
      'obsidian://open?vault=My%20Vault&file=Projects%2FSito%20web',
    );
  });

  it('omits an empty vault name', () => {
    const uri = Core.buildOpenUri({ vaultName: '' }, { filePath: 'Inbox.md' });
    assert.equal(uri, 'obsidian://open?file=Inbox');
  });

  it('builds a new-note URI with frontmatter content', () => {
    const uri = Core.buildNewUri(
      { vaultName: 'Work' },
      { projectId: 'abc', filePath: 'Projects/Tesi.md' },
      { id: 'abc', title: 'Tesi' },
      'it',
    );
    assert.match(uri, /^obsidian:\/\/new\?/);
    assert.match(uri, /vault=Work/);
    assert.match(uri, /file=Projects%2FTesi/);
    assert.match(uri, /content=/);
    assert.match(decodeURIComponent(uri), /super-productivity-id: abc/);
    assert.match(decodeURIComponent(uri), /Nota collegata/);
  });
});

describe('path helpers', () => {
  it('suggests a safe file path from the project title', () => {
    assert.equal(
      Core.suggestFilePath('Sito / Launch*', 'Projects'),
      'Projects/Sito - Launch-.md',
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
