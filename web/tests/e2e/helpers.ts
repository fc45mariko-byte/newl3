import { expect, type Page } from '@playwright/test';
export const PASSWORD = 'correct-horse-42';
let n = 0;
export async function signup(page: Page, name = 'Test') {
  const email = `e2e-${Date.now()}-${n++}@lea.test`;
  await page.goto('/signup');
  await page.fill('input[name=name]', name);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button:has-text("Create account")');
  await page.waitForURL('/', { timeout: 60_000 });
  return email;
}
export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('/');
}
export async function noHorizontalOverflow(page: Page) {
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ov, 'page must not scroll sideways').toBeLessThanOrEqual(1);
}
