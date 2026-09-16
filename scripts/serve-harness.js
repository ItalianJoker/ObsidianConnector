#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const pluginDir = path.join(root, 'plugin');
const harnessDir = path.join(root, 'harness');
const port = Number(process.env.PORT || 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
};

const mockSnippet = fs.readFileSync(path.join(harnessDir, 'mock-api.js'), 'utf8');

function injectMock(html) {
  return html.replace('<body>', `<body>\n<script>\n${mockSnippet}\n</script>`);
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  if (pathname === '/index.html') {
    const html = fs.readFileSync(path.join(pluginDir, 'index.html'), 'utf8');
    send(res, 200, injectMock(html), types['.html']);
    return;
  }

  const relative = pathname.replace(/^\/+/, '');
  const file = path.join(pluginDir, relative);
  if (!file.startsWith(pluginDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    send(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(file);
  send(res, 200, fs.readFileSync(file), types[ext] || 'application/octet-stream');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Harness: http://127.0.0.1:${port}/`);
});
