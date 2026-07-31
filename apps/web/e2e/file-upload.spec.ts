import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { open } from 'node:fs/promises';

const PASSWORD = 'password123';
const API_BASE = 'http://localhost:3001';

async function registerUser(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { email, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function createMeeting(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/meetings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, date: '2026-08-01T10:00:00Z', participants: [] },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Мои встречи' })).toBeVisible();
}

test.describe('File upload flow (e2e)', () => {
  test('upload, preview, download and delete a file', async ({ page, request }) => {
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const token = await registerUser(request, email);
    const meetingId = await createMeeting(request, token, 'E2E Meeting');

    await login(page, email);
    await page.getByRole('link', { name: 'E2E Meeting' }).click();
    await expect(page).toHaveURL(new RegExp(`/meetings/${meetingId}$`));

    await expect(page.getByText('Файлы ещё не загружены')).toBeVisible();

    const fileName = 'e2e-notes.pdf';
    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      ),
    });

    const fileRow = page.getByRole('list', { name: 'Файлы встречи' }).getByText(fileName);
    await expect(fileRow).toBeVisible();

    const previewButton = page.getByRole('button', { name: `Просмотреть ${fileName}` });
    await previewButton.click();
    await expect(previewButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(fileName)).toHaveCount(2);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Скачать ${fileName}` }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(fileName);

    await page.locator(`button[aria-label="Удалить ${fileName}"]`).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();

    await expect(page.getByText('Файлы ещё не загружены')).toBeVisible();
    await expect(page.getByText(fileName)).toHaveCount(0);
  });

  test('rejects oversized and unsupported files inline', async ({ page, request }) => {
    const email = `e2e-valid-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const token = await registerUser(request, email);
    await createMeeting(request, token, 'Validation Meeting');

    await login(page, email);
    await page.getByRole('link', { name: 'Validation Meeting' }).click();

    const hugePath = test.info().outputPath('huge.mp4');
    const handle = await open(hugePath, 'w');
    await handle.truncate(100 * 1024 * 1024 + 1);
    await handle.close();

    await page.setInputFiles('input[type="file"]', hugePath);
    await expect(page.locator('#file-upload-error')).toContainText('слишком большой');

    await page.setInputFiles('input[type="file"]', {
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    });
    await expect(page.locator('#file-upload-error')).toContainText(/неподдерживаемый тип/i);
  });
});
