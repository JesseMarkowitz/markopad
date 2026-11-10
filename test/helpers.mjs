import { expect } from '@playwright/test';

// Where the page under test lives: a hosted copy if MARKOPAD_URL is set, else the local test server.
export const BASE = (process.env.MARKOPAD_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

// A 1x1 PNG, served by the tests in place of "remote" images.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Records anything that would show the page misbehaving: script errors and policy violations.
export async function watch(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__violations.push(e.violatedDirective + ' <- ' + e.blockedURI));
  });
  return problems;
}

export async function fresh(page, hash = '#new', base = '/') {
  await page.goto(base + hash);
  await expect(page.locator('#editor')).toBeAttached();
}

// The preview is redrawn a moment after each change; wait for that.
export async function settle(page) { await page.waitForTimeout(300); }

export async function setText(page, text) {
  await page.locator('#editor').fill(text);
  await settle(page);
}

export const editorValue = (page) => page.locator('#editor').inputValue();

// What is on the clipboard, as plain text.
// Chromium and Firefox let a test read it directly. Safari's engine refuses a direct read, so there
// the text is pasted with the keyboard into a scratch box on another page and read from that.
// `direct` lets a test supply its own reader, for when it has replaced navigator.clipboard.
export async function clipboardText(page, browserName, direct) {
  if (browserName !== 'webkit') return direct ? direct() : page.evaluate(() => navigator.clipboard.readText());
  const scratch = await page.context().newPage();
  await scratch.setContent('<textarea id="t"></textarea>');
  await scratch.locator('#t').focus();
  await scratch.keyboard.press('Control+V');
  await scratch.waitForTimeout(300);
  const text = await scratch.locator('#t').inputValue();
  await scratch.close();
  await page.bringToFront();
  return text;
}
export const violations = (page) => page.evaluate(() => window.__violations);
