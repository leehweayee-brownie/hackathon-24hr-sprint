import path from 'node:path';
import { ACCOUNTS, expect, login, test } from './helpers';

const SOCSO = path.resolve(__dirname, '../../../fixtures/documents/bina-jaya/05-socso-coverage.pdf');

test('an officer confirms a low-confidence field on a document', async ({ page }) => {
  await login(page, ACCOUNTS.supplier);
  await page.goto('/supplier/documents');
  // The SOCSO certificate prints its coverage amount faintly, so it is read below the confidence threshold.
  await page.getByTestId('file-input').setInputFiles([SOCSO]);
  const card = page.getByTestId('document-card').filter({ has: page.getByTestId('needs-review-count') }).first();
  await expect(card).toBeVisible({ timeout: 90_000 });
  await card.getByRole('link').first().click();
  await expect(page.getByTestId('document-viewer')).toBeVisible();
  const row = page.locator('[data-needs-confirmation="true"]').first();
  await row.getByTestId('confirm').click();
  await expect(page.getByText(/Confirmed/).first()).toBeVisible({ timeout: 15_000 });
});
