import { ACCOUNTS, expect, login, test } from './helpers';

test('an officer confirms a low-confidence field on a document', async ({ page }) => {
  await login(page, ACCOUNTS.supplier);
  await page.goto('/supplier/documents');
  const card = page.getByTestId('document-card').filter({ has: page.getByTestId('needs-review-count') }).first();
  test.skip((await card.count()) === 0, 'No document needs review in the seeded data');
  await card.getByRole('link').first().click();
  await expect(page.getByTestId('document-viewer')).toBeVisible();
  const row = page.locator('[data-needs-confirmation="true"]').first();
  await row.getByTestId('confirm').click();
  await expect(row.getByText(/Confirmed/)).toBeVisible({ timeout: 15_000 });
});
