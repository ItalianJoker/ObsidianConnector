#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const pluginDir = path.join(root, 'plugin');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

const core = read(path.join(src, 'core.js'));
const host = read(path.join(src, 'plugin-host.js'));
const ui = read(path.join(src, 'ui.js'));
const styles = read(path.join(src, 'styles.css'));
const template = read(path.join(src, 'index.template.html'));

write(path.join(pluginDir, 'plugin.js'), `${core}\n${host}\n`);

const html = template
  .replace('/*__STYLES__*/', styles)
  .replace('/*__CORE__*/', core)
  .replace('/*__UI__*/', ui);

write(path.join(pluginDir, 'index.html'), html);

console.log('Built plugin/plugin.js and plugin/index.html');
