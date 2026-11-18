import { expect, test } from '@playwright/test';
import { noHorizontalOverflow, signup } from './helpers';

test('phone: bottom navigation, readable pages, no sideways scrolling', async ({ page }) => {
  await signup(page, 'Mobile');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  for (const path of ['/', '/courses', '/courses/tci', '/courses/tci/chapters/tci.incoterms', '/courses/tou/chapters/tou.market', '/knowledge', '/knowledge/graph', '/planner', '/planner?view=month', '/tasks', '/revision', '/revision/flashcards']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
  }
  // Navigation by the bottom bar
  await page.goto('/');
  await nav.getByRole('link', { name: 'Revision' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test what you understand');
  // Interactive diagram works on a phone
  await page.goto('/courses/tci/chapters/tci.incoterms');
  await page.getByRole('radio', { name: 'CIF' }).first().click();
  await expect(page.getByText('minimum clauses C')).toBeVisible();
  // The companion panel opens and explains its configuration state
  await page.getByRole('button', { name: 'Open the study companion' }).click();
  await expect(page.getByText('needs a Claude API key')).toBeVisible();
});
