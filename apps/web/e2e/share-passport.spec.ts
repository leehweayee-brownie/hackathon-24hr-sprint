import { ACCOUNTS, expect, login, test } from './helpers';

test('supplier shares the passport by link and a stranger can open it read-only', async ({ page, browser }) => {
  await login(page, ACCOUNTS.supplier);
  await page.goto('/supplier/passport');
  await page.getByTestId('create-share').click();
  await page.getByLabel('Label').fill('Playwright buyer');
  await page.getByTestId('create-share-submit').click();
  const url = await page.getByTestId('share-url').textContent();
  expect(url).toMatch(/\/p\//);

  const context = await browser.newContext();
  const anon = await context.newPage();
  await anon.goto(url!);
  await expect(anon.getByTestId('passport-preview')).toBeVisible({ timeout: 20_000 });
  await expect(anon.getByTestId('trust-score-ring')).toBeVisible();
  await context.close();

  await page.reload();
  await expect(page.getByTestId('share-row').first()).toContainText('1 view');
});
