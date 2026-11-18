import { expect, test, type Page } from '@playwright/test';
import { signup } from './helpers';

test.describe.configure({ mode: 'serial' });
let page: Page;
test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await signup(page, 'Quiz'); });
test.afterAll(async () => page.close());

async function startChapterQuiz(chapterUrl: string) {
  await page.goto(chapterUrl);
  await page.getByRole('link', { name: /Quiz du chapitre|Chapter quiz/ }).click();
  await page.waitForURL(/revision\/start/);
  await page.click('main button:has-text("Start")');
  await page.waitForURL(/revision\/quiz\//);
}
const typeOf = async () => (await page.locator('section[aria-labelledby=q-stem] .chip').first().textContent())!.trim();

test('chapter quiz: answers, feedback, partial scoring, persistence, results and restart', async () => {
  await startChapterQuiz('/courses/tci/chapters/tci.operation');
  const url = page.url();
  const n = await page.locator('nav[aria-label=Questions] button').count();
  expect(n).toBe(10);
  // The page sent to the browser contains no correct answer.
  const html = await page.content();
  expect(html).not.toContain('"correct":true');
  const seen = new Set<string>();
  for (let k = 0; k < n; k++) {
    await page.locator('nav[aria-label=Questions] button').nth(k).click();
    const type = await typeOf(); seen.add(type);
    const q = page.locator('section[aria-labelledby=q-stem]');
    if (type === 'One answer' || type === 'True or false') {
      await q.locator('fieldset label').nth(0).click();
      await q.locator('fieldset label').nth(1).click(); // change the answer before checking
      await expect(q.locator('fieldset input').nth(1)).toBeChecked();
      await expect(q.locator('fieldset input').nth(0)).not.toBeChecked();
    } else if (type === 'Several answers') {
      await q.locator('fieldset label').nth(0).click(); await q.locator('fieldset label').nth(1).click();
    } else if (type === 'Matching') {
      const sels = q.locator('select'); const c = await sels.count();
      for (let j = 0; j < c; j++) await sels.nth(j).selectOption({ index: 1 + ((j + 1) % c) });
    } else if (type === 'Ordering') {
      await q.locator('button[aria-label^="Move"]').nth(1).click();
    } else {
      await q.locator('textarea').fill('La pro forma est une offre chiffrée qui permet d’obtenir un financement ou un crédit documentaire ; elle ne constate pas une vente.');
    }
    await q.getByRole('button', { name: /Check answer|Submit my answer/ }).click();
    const fb = q.getByRole('status');
    await expect(fb).toBeVisible();
    if (type === 'Short answer' || type === 'Case question') {
      await expect(fb).toContainText('Model answer');
      await fb.locator('input[name=met]').first().check();
      await fb.getByRole('button', { name: 'Record my self-assessment' }).click();
      await expect(fb).toContainText('self-assessed');
    } else {
      await expect(fb.locator('p').first()).toHaveText(/Correct|Incorrect|Partly correct/);
      // An evaluated answer is locked.
      await expect(q.getByRole('button', { name: 'Check answer' })).toHaveCount(0);
    }
    if (k === 2) {
      await page.reload();
      await expect(page.getByText('3/10 answered')).toBeVisible();
    }
  }
  expect(seen.size).toBeGreaterThanOrEqual(5);
  await page.getByRole('button', { name: 'Finish quiz' }).click();
  await page.getByRole('button', { name: 'See my results' }).click();
  await expect(page.getByRole('button', { name: 'Restart this quiz' })).toBeVisible();
  const score = await page.locator('p.font-serif.text-6xl').textContent();
  await page.reload();
  await expect(page.locator('p.font-serif.text-6xl')).toHaveText(score!);
  await page.getByRole('button', { name: 'Restart this quiz' }).click();
  await page.waitForURL((u) => /revision\/quiz\//.test(u.toString()) && u.toString() !== url);
  await expect(page.getByText('0/10 answered')).toBeVisible();
  await page.goto('/revision');
  await expect(page.getByText('answers graded')).toBeVisible();
});

test('exam simulation: timed, saved without feedback, changeable until handed in', async () => {
  await page.goto('/revision');
  await page.locator('label', { hasText: 'Exam simulation' }).click();
  await page.locator('select[name=courseId]').selectOption({ label: 'Introduction to international tourism' }).catch(async () => {
    await page.locator('select[name=courseId]').selectOption({ label: 'Introduction au tourisme international' });
  });
  await page.fill('input[name=count]', '5');
  await page.fill('input[name=minutes]', '10');
  await page.click('main button:has-text("Start")');
  await page.waitForURL(/revision\/quiz\//);
  await expect(page.locator('text=/⏱ \\d+:\\d\\d/')).toBeVisible();
  const q = page.locator('section[aria-labelledby=q-stem]');
  const type = await typeOf();
  if (type === 'Short answer' || type === 'Case question') await q.locator('textarea').fill('An answer.');
  else if (type === 'Matching') { const s = q.locator('select'); for (let j = 0; j < await s.count(); j++) await s.nth(j).selectOption({ index: 1 }); }
  else if (type === 'Ordering') await q.locator('button[aria-label^="Move"]').nth(1).click();
  else await q.locator('fieldset label').first().click();
  await q.getByRole('button', { name: 'Save answer' }).click();
  await expect(q.getByRole('button', { name: /Saved ✓/ })).toBeVisible();
  await expect(q.getByRole('status')).toHaveCount(0); // no feedback during the exam
  await page.getByRole('button', { name: 'Hand in the exam' }).click();
  await expect(page.getByText(/without an answer will count 0/)).toBeVisible();
  await page.getByRole('button', { name: 'Hand in', exact: true }).click();
  await expect(page.getByText(/points/)).toBeVisible();
  await expect(page.getByText('Not answered.').first()).toBeVisible();
});

test('flashcards: grading schedules the card and removes it from today’s queue', async () => {
  await page.goto('/revision/flashcards?course=tci');
  const info = await page.locator('main header p').textContent();
  const due = Number(info!.match(/(\d+) due · (\d+) new/)![2]);
  expect(due).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Show the answer' }).click();
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByText(/Next review in 1 day/)).toBeVisible();
  await page.reload();
  const after = Number((await page.locator('main header p').textContent())!.match(/(\d+) due · (\d+) new/)![2]);
  expect(after).toBe(Math.min(15, due)); // the reviewed card is no longer new; the next new one takes its place
  await page.goto('/revision');
  await expect(page.locator('text=REVIEW').locator('..').locator('p').first()).toHaveText('1');
});

test('exercises: numeric answers are checked and corrections shown', async () => {
  await page.goto('/revision/exercises?course=cpt');
  const ex = page.locator('details').first();
  await ex.locator('summary').click();
  const input = ex.locator('input[inputmode=decimal]').first();
  if (await input.count()) {
    await input.fill('1');
    await ex.getByRole('button', { name: 'Check' }).first().click();
    await expect(ex.getByRole('status').first()).toBeVisible();
  }
  await ex.getByRole('button', { name: 'Show the correction' }).first().click();
  await expect(ex.getByRole('status').first()).toBeVisible();
});
