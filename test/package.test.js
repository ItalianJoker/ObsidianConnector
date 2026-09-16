const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

describe('plugin package', () => {
  it('builds a ZIP with manifest.json at the root', () => {
    execFileSync('npm', ['run', 'zip'], { cwd: root, stdio: 'pipe' });
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const zipPath = path.join(root, 'dist/obsidian-connector.zip');
    const versionedZip = path.join(root, `dist/obsidian-connector-${pkg.version}.zip`);
    assert.equal(fs.existsSync(zipPath), true);
    assert.equal(fs.existsSync(versionedZip), true);

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
    assert.ok(manifest.permissions.includes('nodeExecution'));
  });

  it('ships an existing-page picker with mobile fallback and no create flow', () => {
    const html = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
    assert.match(html, /id="page-list"/);
    assert.match(html, /id="manual-page"/);
    assert.match(html, /id="load-pages"/);
    assert.match(html, /never creates a new page/i);
    assert.doesNotMatch(html, /id="suggest-path"/);
    assert.doesNotMatch(html, /id="create-note"/);
    assert.doesNotMatch(html, /obsidian:\/\/new/);
  });
});
