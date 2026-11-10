// The same page on a phone-sized touch screen (L-4, L-5).
import { test, expect } from '@playwright/test';
import { watch, fresh, setText } from './helpers.mjs';

let problems;
test.beforeEach(async ({ page }) => { problems = await watch(page); });
test.afterEach(async () => { expect(problems).toEqual([]); });

test('L-4: a phone starts with one pane and switches between them', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview-pane')).toBeHidden();
  await setText(page, '# On a phone\n\ntext');
  await page.locator('#view-preview').tap();
  await expect(page.locator('#preview h1')).toBeVisible();
  await expect(page.locator('#editor')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('L-4, L-2: "Both" stacks the panes and the divider drags by touch', async ({ page }) => {
  await fresh(page);
  await setText(page, '# Stacked\n\ntext');
  await page.locator('#view-both').tap();
  const ed = await page.locator('#editor-pane').boundingBox();
  const pv = await page.locator('#preview-pane').boundingBox();
  expect(pv.y).toBeGreaterThan(ed.y + ed.height - 1);
  expect(Math.abs(ed.width - pv.width)).toBeLessThan(2);
  await expect(page.locator('#divider')).toHaveAttribute('aria-orientation', 'horizontal');
  const d = await page.locator('#divider').boundingBox();
  const x = d.x + d.width / 2, y = d.y + d.height / 2;
  await page.locator('#divider').evaluate((el, [x, y]) => {
    const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: cy, bubbles: true, cancelable: true, button: 0 }));
    fire('pointerdown', y); fire('pointermove', y - 60); fire('pointermove', y - 120); fire('pointerup', y - 120);
  }, [x, y]);
  const after = await page.locator('#editor-pane').boundingBox();
  expect(ed.height - after.height).toBeGreaterThan(90);
  expect(await page.locator('#divider').evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
});

test('L-5: rotating keeps the text and adapts the layout', async ({ page }) => {
  await fresh(page);
  await setText(page, '# Rotate me');
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('#editor')).toHaveValue('# Rotate me');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview h1')).toBeVisible();
  const ed = await page.locator('#editor-pane').boundingBox();
  const pv = await page.locator('#preview-pane').boundingBox();
  expect(pv.x).toBeGreaterThan(ed.x + ed.width - 1);
});

test('H-3 on a phone: Insert returns to the text', async ({ page }) => {
  await fresh(page);
  await page.locator('#view-preview').tap();
  await page.locator('#btn-howto').tap();
  await page.fill('#howto-search', 'bold');
  await page.locator('.how:not([hidden])').first().getByRole('button', { name: 'Insert' }).tap();
  await expect(page.locator('#howto')).toBeHidden();
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#editor')).toHaveValue('**bold text**');
});

test('the top bar fits a phone screen', async ({ page }) => {
  await fresh(page);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('#bar button, #bar a.btn')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).map((b) => b.id));
  expect(overflow).toEqual([]);
  expect((await page.locator('#bar').boundingBox()).height).toBeLessThan(130);
  await expect(page.locator('#version')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
