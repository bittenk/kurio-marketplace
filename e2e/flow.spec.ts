import { test, expect } from '@playwright/test';

test('Fluxo de exploração e visualização de catálogo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('KURIO')).toBeVisible();
  await expect(page.getByText('SEJA DONO DO FUTURO')).toBeVisible();
});