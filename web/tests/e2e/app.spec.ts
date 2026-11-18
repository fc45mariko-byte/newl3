import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { login, signup } from './helpers';

test.describe.configure({ mode: 'serial' });
let email = '';
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  email = await signup(page, 'Camille');
});
test.afterAll(async () => page.close());

test('sign-up creates the curriculum and the dashboard reflects it', async () => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Camille');
  await expect(page.getByText('Content read')).toBeVisible();
  await expect(page.getByText('Introduction au tourisme international').first()).toBeVisible();
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Semester 5' })).toBeVisible();
  expect(await page.locator('main ul li a[href^="/courses/"]').count()).toBeGreaterThan(15);
});

test('every main navigation link opens a working page', async () => {
  for (const [label, heading] of [['Courses', 'Your curriculum'], ['Knowledge', 'Your knowledge base'], ['Planner', 'Your semester'], ['Tasks', 'What needs doing'], ['Revision', 'Test what you understand'], ['Dashboard', 'Camille']]) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
  }
});

test('course creation and editing', async () => {
  await page.goto('/courses/new');
  await page.fill('input[name=title]', 'Droit européen');
  await page.selectOption('select[name=language]', 'fr');
  await page.check('input[value=S6]');
  await page.click('button:has-text("Create course")');
  await page.waitForURL(/\/courses\/droit-europeen$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Droit européen');
  await expect(page.getByText('No complete university material is available')).toBeVisible();
  await page.click('text=Edit course');
  await page.fill('input[name=teacher]', 'J. Dupont');
  await page.fill('input[name=title]', '');
  expect(await page.locator('input[name=title]').evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
  // Server-side validation as well, when the browser check is bypassed.
  await page.locator('input[name=title]').evaluate((e: HTMLInputElement) => { e.required = false; e.minLength = 0; e.value = 'x'; });
  await page.click('button:has-text("Save changes")');
  await expect(page.locator('main [role=alert]')).toContainText('Give the course a title');
  await page.fill('input[name=title]', 'Droit européen');
  await page.click('button:has-text("Save changes")');
  await expect(page.getByRole('status')).toContainText('Saved');
  await page.goto('/courses/droit-europeen');
  await expect(page.getByText('Teacher: J. Dupont')).toBeVisible();
  // A chapter marked ESSENTIAL needs a justification.
  await page.click('text=Add a missing chapter');
  await page.fill('input[name=title]', 'Le marché intérieur');
  await page.selectOption('select[name=priority]', 'ESSENTIAL');
  await page.click('button:has-text("Add chapter")');
  await expect(page.locator('main [role=alert]')).toContainText('Say why this chapter is essential');
  await page.fill('input[name=reason]', 'Listed in the lecture plan');
  await page.click('button:has-text("Add chapter")');
  await expect(page.getByRole('status')).toContainText('Chapter added');
  await expect(page.locator('#chapters').getByRole('link', { name: 'Le marché intérieur' })).toBeVisible();
});

test('document upload, extraction, retrieval and rejection of unsupported files', async () => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Le dédouanement à l’import</a:t></a:r></a:p></p:sld>');
  const pptx = await zip.generateAsync({ type: 'nodebuffer' });
  await page.goto('/courses/tci/resources');
  await page.setInputFiles('input[name=files]', [
    { name: 'cours-douane.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: pptx },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('# Valeur en douane\nValeur transactionnelle ajustée.') },
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) },
  ]);
  await page.click('button:has-text("Upload")');
  const status = page.getByRole('status');
  await expect(status).toContainText('cours-douane.pptx: text extracted');
  await expect(status).toContainText('notes.txt: text extracted');
  await expect(status).toContainText('photo.png: This file type is not supported');
  await page.reload();
  await page.getByRole('link', { name: 'cours-douane.pptx' }).click();
  await expect(page.getByRole('heading', { name: 'Slide 1 — Le dédouanement à l’import' })).toBeVisible();
  const res = await page.request.get(await page.getByRole('link', { name: 'Download the original' }).getAttribute('href') as string);
  expect(res.status()).toBe(200);
  expect(Buffer.compare(Buffer.from(await res.body()), pptx)).toBe(0);
  // Search finds the extracted text.
  await page.goto('/knowledge?q=transactionnelle');
  await expect(page.getByRole('link', { name: 'notes.txt' })).toBeVisible();
});

test('chapter reading, navigation and read status', async () => {
  await page.goto('/courses/tci/chapters/tci.operation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("L'opération d'import-export");
  await expect(page.getByRole('heading', { name: 'Un sac de café entre Santos et Le Havre' })).toBeVisible();
  await expect(page.getByText('Reconstructed explanation').first()).toBeVisible();
  // Three explanation levels on a concept
  const concept = page.locator('details#tci\\.operation\\.flux');
  await concept.locator('summary').click();
  await concept.getByRole('tab', { name: 'Analyse' }).click();
  await expect(concept).toContainText('Le décalage des flux est la matrice du cours');
  await page.click('button:has-text("Marquer comme lu")');
  await expect(page.getByRole('button', { name: /Lu/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Incoterms® 2020 →/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Incoterms® 2020');
  await page.goto('/');
  await expect(page.locator('section[aria-label="Academic overview"]')).toContainText('1');
});

test('notes: create, edit, persist and delete', async () => {
  await page.goto('/courses/tci/notes');
  await page.fill('aside input[name=title]', 'Question pour la prof');
  await page.fill('aside textarea', 'Le **connaissement** est-il toujours négociable ? Voir [[Connaissement]].');
  await page.fill('aside input[name=tags]', 'documents, question');
  await page.click('aside button:has-text("Save note")');
  await expect(page.getByRole('status')).toContainText('Note saved');
  await page.reload();
  const note = page.locator('main li', { hasText: 'Question pour la prof' });
  await expect(note.locator('strong')).toHaveText('connaissement');
  await note.getByRole('button', { name: 'Edit' }).click();
  const editor = page.locator('main li:has(input[name=title])');
  await expect(editor.locator('input[name=title]')).toHaveValue('Question pour la prof');
  await editor.locator('input[name=title]').fill('Question pour la professeure');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('main li h3', { hasText: 'Question pour la professeure' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Question pour la professeure')).toBeVisible();
  await page.goto('/knowledge?tag=documents');
  await expect(page.getByText('Question pour la professeure')).toBeVisible();
  const n2 = page.locator('main li', { hasText: 'Question pour la professeure' });
  await n2.getByRole('button', { name: 'Delete' }).click();
  await n2.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Question pour la professeure')).toHaveCount(0);
});

test('tasks: create, complete (dashboard updates) and delete', async () => {
  await page.goto('/');
  const before = Number(await page.locator('text=OPEN TASKS').locator('..').locator('p').first().textContent());
  await page.goto('/tasks');
  await page.fill('aside input[name=title]', 'Relire le chapitre sur la douane');
  await page.selectOption('aside select[name=priority]', 'high');
  await page.click('aside button:has-text("Add task")');
  await expect(page.getByRole('status')).toContainText('Task added');
  await page.goto('/');
  await expect(page.locator('text=OPEN TASKS').locator('..').locator('p').first()).toHaveText(String(before + 1));
  await page.goto('/tasks');
  await page.getByLabel('Mark “Relire le chapitre sur la douane” as done').click();
  await expect(page.getByLabel('Mark “Relire le chapitre sur la douane” as done')).toHaveCount(0); // leaves the open list
  await page.goto('/');
  await expect(page.locator('text=OPEN TASKS').locator('..').locator('p').first()).toHaveText(String(before));
  await page.goto('/tasks?filter=done');
  const t = page.locator('li', { hasText: 'Relire le chapitre sur la douane' });
  await t.getByRole('button', { name: /Delete/ }).click();
  await t.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Relire le chapitre sur la douane')).toHaveCount(0);
});

test('calendar: weekly class, exam, edit and delete', async () => {
  await page.goto('/planner');
  const form = page.locator('section', { hasText: 'Add to the planner' });
  await form.locator('input[name=title]').fill('TD Comptabilité');
  await form.locator('select[name=kind]').selectOption('class');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  await form.locator('input[name=date]').fill(today);
  await form.locator('input[name=start]').fill('14:00');
  await form.locator('input[name=end]').fill('13:00');
  await form.locator('button:has-text("Add")').click();
  await expect(form.locator('[role=alert]')).toContainText('end time must be after');
  await form.locator('input[name=end]').fill('16:00');
  await form.locator('input[name=weekly]').check();
  await form.locator('button:has-text("Add")').click();
  await expect(form.getByRole('status')).toContainText('Event added');
  await page.reload();
  await page.getByRole('button', { name: /TD Comptabilité/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('every week');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete every occurrence' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /TD Comptabilité/ })).toHaveCount(0);
});

test('revision plan suggestion is added to the planner', async () => {
  await page.goto('/planner');
  const box = page.locator('section', { hasText: 'Plan revision for an exam' });
  const exam = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await box.locator('select[name=courseId]').selectOption({ label: 'Comptabilité générale' });
  await box.locator('input[name=examDate]').fill(exam);
  await box.locator('button:has-text("Suggest a plan")').click();
  await expect(box.getByText('One day a week is kept free.')).toBeVisible();
  await box.getByRole('button', { name: /Add these \d+ sessions/ }).click();
  await expect(box.getByRole('status')).toContainText('sessions added');
  await page.goto('/planner?view=semester');
  await expect(page.getByRole('button', { name: /Study: /}).first()).toBeVisible();
});

test('login again after logout keeps the data', async () => {
  await page.goto('/settings');
  await page.click('main button:has-text("Log out")');
  await page.waitForURL('/login');
  await page.goto('/courses');
  await page.waitForURL('/login');
  await login(page, email);
  await page.goto('/courses/droit-europeen');
  await expect(page.getByText('Teacher: J. Dupont')).toBeVisible();
});
