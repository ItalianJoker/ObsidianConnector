const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

describe('plugin package', () => {
  it('builds a ZIP with manifest.json at the root', () => {
    execFileSync('npm', ['run', 'zip'], { cwd: root, stdio: 'pipe' });
    const zipPath = path.join(root, 'dist/obsidian-connector.zip');
    assert.equal(fs.existsSync(zipPath), true);

    const listing = execFileSync('python3', [
      '-c',
      `import zipfile; z=zipfile.ZipFile(${JSON.stringify(zipPath)}); print('\\n'.join(z.namelist()))`,
    ], { encoding: 'utf8' });

    const files = listing.trim().split('\n');
    assert.ok(files.includes('manifest.json'));
    assert.ok(files.includes('plugin.js'));
    assert.ok(files.includes('index.html'));
    assert.ok(files.includes('icon.svg'));
    assert.ok(files.includes('i18n/en.json'));
    assert.ok(!files.some((name) => name.startsWith('plugin/')));
  });

  it('declares the required Super Productivity manifest fields', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'plugin/manifest.json'), 'utf8'),
    );
    assert.equal(manifest.id, 'obsidian-connector');
    assert.equal(manifest.manifestVersion, 1);
    assert.equal(manifest.iFrame, true);
    assert.equal(manifest.sidePanel, true);
    assert.ok(Array.isArray(manifest.hooks));
    assert.ok(Array.isArray(manifest.permissions));
    assert.ok(manifest.permissions.includes('getAllProjects'));
    assert.ok(manifest.permissions.includes('persistDataSynced'));
  });
});
