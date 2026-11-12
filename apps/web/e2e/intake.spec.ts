import path from 'node:path';
import { ACCOUNTS, expect, login, test } from './helpers';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/documents/bina-jaya');

test('supplier drops the Bina Jaya folder and every file sorts itself into place', async ({ page }) => {
  await login(page, ACCOUNTS.supplier);
  await page.goto('/supplier/documents');
  await expect(page.getByTestId('dropzone')).toBeVisible();
  const files = ['01-ssm-form9.pdf', '03-cidb-certificate.pdf', '04-public-liability-policy.jpg'].map((f) => path.join(FIXTURES, f));
  await page.getByTestId('file-input').setInputFiles(files);
  await expect(page.getByTestId('document-card')).not.toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('column-SSM').getByTestId('document-card')).toHaveCount(1, { timeout: 90_000 });
  await expect(page.getByTestId('column-CIDB').getByTestId('document-card')).toHaveCount(1, { timeout: 90_000 });
  await expect(page.getByTestId('column-PUBLIC_LIABILITY').getByTestId('document-card')).toHaveCount(1, { timeout: 90_000 });
});
