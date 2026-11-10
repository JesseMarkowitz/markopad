#!/usr/bin/env node
// Joins the files in src/ and vendor/ into one self-contained page: dist/index.html.
// Needs Node 18 or later and nothing else. Run:  node build.mjs
//
// The page's content security policy lists the hash of its one script and its one style
// sheet, so the browser runs exactly what this script wrote and nothing a document adds.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
const fail = (msg) => { console.error('build failed: ' + msg); process.exit(1); };

const version = JSON.parse(read('package.json')).version;
const howto = (await import('./src/howto.mjs')).default;

// The libraries, exactly as published. Checked against the hashes recorded in vendor/README.md.
const VENDOR = [
  ['vendor/marked.umd.js', 'c34a221dc89e91833a88822e7717b8a0cf27118f8c9a8779dffb48a6be31f97a'],
  ['vendor/purify.min.js', 'cd37898f9782adf54820c413191b5691803f0f137c799d6edcfd38523b4c2c31'],
];
const libs = VENDOR.map(([file, want]) => {
  const text = read(file);
  const got = createHash('sha256').update(text, 'utf8').digest('hex');
  if (got !== want) fail(`${file} does not match its recorded hash.\n  expected ${want}\n  found    ${got}`);
  return text.replace(/^\/\/# sourceMappingURL=.*$/m, '').trimEnd();
});

const mdCss = read('src/markdown.css');
const css = read('src/style.css') + '\n' + mdCss;
const help = read('src/help.md').replaceAll('{{VERSION}}', version);

// Data for the page. "<" is written as < so no document text can end the script early.
const data = JSON.stringify({ version, help, howto, mdCss }).replace(/</g, '\\u003c');
const js = [
  ...libs,
  `window.MP_BUILD = ${data};`,
  read('src/app.js').trimEnd(),
].join('\n;\n');

if (/<\/script/i.test(js) || /<script/i.test(js)) fail('the joined script contains a script tag; an inline script must not.');
if (/<\/style/i.test(css)) fail('the style sheet contains a closing style tag.');

const csp = [
  "default-src 'none'",
  `script-src 'sha256-${sha256(js)}'`,
  `style-src 'sha256-${sha256(css)}'`,
  'img-src data: https: http:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

const licenses = `<!--
  MarkoPad ${version} — https://github.com/JesseMarkowitz/markopad — MIT License.

  This file includes:
  * marked v18.1.3 — Copyright (c) 2018-2026 MarkedJS, Copyright (c) 2011-2018 Christopher Jeffrey.
    MIT License. https://github.com/markedjs/marked
  * DOMPurify 3.4.17 — (c) Cure53 and other contributors. Used under the Mozilla Public License 2.0
    (it is offered under Apache-2.0 or MPL-2.0). Unmodified. Source code: https://github.com/cure53/DOMPurify
  The full license texts are in the vendor folder of the MarkoPad repository.
-->`;

let page = read('src/index.html');
const put = (marker, value) => {
  if (page.split(marker).length !== 2) fail(`marker ${marker} must appear exactly once in src/index.html`);
  page = page.replace(marker, () => value);
};
put('<!--LICENSES-->', licenses);
put('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
put('/*CSS*/', css);
put('/*JS*/', js);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), page);
const kb = (Buffer.byteLength(page) / 1024).toFixed(1);
console.log(`dist/index.html  ${kb} KB  version ${version}`);
