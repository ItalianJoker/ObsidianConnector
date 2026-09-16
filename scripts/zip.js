#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pluginDir = path.join(root, 'plugin');
const distDir = path.join(root, 'dist');
const zipPath = path.join(distDir, 'obsidian-connector.zip');

fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const python = `import os, zipfile
root = ${JSON.stringify(pluginDir)}
out = ${JSON.stringify(zipPath)}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, files in os.walk(root):
        for name in files:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            zf.write(full, rel.replace(os.sep, '/'))
print(out)
`;

execFileSync('python3', ['-c', python], { stdio: 'inherit' });
