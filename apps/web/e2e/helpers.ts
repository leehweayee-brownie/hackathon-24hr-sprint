import { expect, test as base, type Page } from '@playwright/test';

export const PASSWORD = 'Password123!';
export const ACCOUNTS = {
  supplier: 'supplier@binajaya.local',
  buyer: 'buyer@procurement.local',
  approver: 'approver@procurement.local',
  admin: 'admin@vp.local',
};

/** Skips the whole file unless a running stack is configured. */
export const test = base.extend({});
test.beforeEach(() => {
  test.skip(!process.env.E2E_BASE_URL, 'Set E2E_BASE_URL (and run the seeded API) to run the e2e suite');
});

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export { expect };
