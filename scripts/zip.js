#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pluginDir = path.join(root, 'plugin');
const distDir = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const unversionedZip = path.join(distDir, 'obsidian-connector.zip');
const versionedZip = path.join(distDir, `obsidian-connector-${pkg.version}.zip`);

fs.mkdirSync(distDir, { recursive: true });
for (const zipPath of [unversionedZip, versionedZip]) {
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
}

const python = `import os, shutil, zipfile
root = ${JSON.stringify(pluginDir)}
unversioned = ${JSON.stringify(unversionedZip)}
versioned = ${JSON.stringify(versionedZip)}
with zipfile.ZipFile(unversioned, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, files in os.walk(root):
        for name in files:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            zf.write(full, rel.replace(os.sep, '/'))
shutil.copyfile(unversioned, versioned)
print(unversioned)
print(versioned)
`;

execFileSync('python3', ['-c', python], { stdio: 'inherit' });
