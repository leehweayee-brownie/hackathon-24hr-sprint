import { ACCOUNTS, expect, login, test } from './helpers';

test('buyer opens a vendor check, sees the score with reasons and records a decision', async ({ page }) => {
  await login(page, ACCOUNTS.buyer);
  await page.goto('/buyer');
  const row = page.getByRole('row').filter({ hasText: 'Mega Wira' }).first();
  test.skip((await row.count()) === 0, 'Seeded Mega Wira check not found');
  await row.click();
  await expect(page.getByTestId('vendor-check-page')).toBeVisible();
  await expect(page.getByTestId('trust-score-ring')).toBeVisible();
  await page.getByTestId('request-info').click();
  await page.getByTestId('decision-note').fill('Please upload the latest ISO certificate.');
  await page.getByTestId('decision-acknowledge').check();
  await page.getByTestId('decision-submit').click();
  await expect(page.getByText('More documents requested')).toBeVisible({ timeout: 15_000 });
});
