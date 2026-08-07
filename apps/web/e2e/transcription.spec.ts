import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const PASSWORD = 'password123';
const API_BASE = 'http://localhost:3001';
const FILE_ID = '9f4e2a1b-0000-4000-8000-000000000001';

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
  await page.goto('/');
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Мои встречи' })).toBeVisible({
    timeout: 30_000,
  });
}

function transcriptionFile(overrides: Record<string, unknown>) {
  return {
    id: FILE_ID,
    originalName: 'recording.mp3',
    mimeType: 'audio/mpeg',
    size: 2048,
    createdAt: '2026-08-07T10:00:00.000Z',
    transcriptionStatus: null,
    transcriptionProgress: null,
    transcriptionError: null,
    transcriptionLanguage: null,
    ...overrides,
  };
}

test.describe.configure({ mode: 'serial' });

test.describe('Transcription flow (e2e)', () => {
  test('upload → polling → completed → show transcript', async ({ page, request }) => {
    const email = `e2e-tx-ok-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const token = await registerUser(request, email);
    const meetingId = await createMeeting(request, token, 'Tx Meeting');

    await login(page, email);
    await page.getByRole('link', { name: 'Tx Meeting' }).click();
    await expect(page).toHaveURL(new RegExp(`/meetings/${meetingId}$`));

    let listCalls = 0;

    await page.route(`**/api/meetings/${meetingId}/files`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(transcriptionFile({ transcriptionStatus: 'PENDING' })),
        });
        return;
      }
      listCalls += 1;
      const file =
        listCalls <= 1
          ? transcriptionFile({ transcriptionStatus: 'PROCESSING', transcriptionProgress: 45 })
          : transcriptionFile({ transcriptionStatus: 'COMPLETED', transcriptionLanguage: 'ru' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [file] }),
      });
    });

    await page.route(`**/api/meetings/${meetingId}/files/${FILE_ID}/transcript`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transcript: 'Привет, это тестовая транскрибация.',
          language: 'ru',
          transcribedAt: '2026-08-07T10:00:01.000Z',
        }),
      });
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'recording.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('ID3 fake mp3 content'),
    });

    await expect(page.getByText(/Транскрибация…/)).toBeVisible();

    await expect(page.getByText('Готово · RU')).toBeVisible({ timeout: 15_000 });

    const showButton = page.getByRole('button', { name: 'Показать транскрипт' });
    await showButton.click();
    const hideButton = page.getByRole('button', { name: 'Скрыть транскрипт' });
    await expect(hideButton).toBeVisible();
    await expect(hideButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Привет, это тестовая транскрибация.')).toBeVisible();
    await expect(page.getByText('Язык: ru')).toBeVisible();
  });

  test('failed transcription shows error and retry re-queues', async ({ page, request }) => {
    const email = `e2e-tx-err-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const token = await registerUser(request, email);
    const meetingId = await createMeeting(request, token, 'Tx Error Meeting');

    await login(page, email);
    await page.getByRole('link', { name: 'Tx Error Meeting' }).click();
    await expect(page).toHaveURL(new RegExp(`/meetings/${meetingId}$`));

    let retried = false;

    await page.route(`**/api/meetings/${meetingId}/files`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(
            transcriptionFile({ transcriptionStatus: 'FAILED', transcriptionError: 'ffmpeg not found' }),
          ),
        });
        return;
      }
      const file = retried
        ? transcriptionFile({ transcriptionStatus: 'PENDING' })
        : transcriptionFile({ transcriptionStatus: 'FAILED', transcriptionError: 'ffmpeg not found' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [file] }),
      });
    });

    await page.route(
      `**/api/meetings/${meetingId}/files/${FILE_ID}/transcription/retry`,
      async (route) => {
        retried = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ transcriptionStatus: 'PENDING' }),
        });
      },
    );

    await page.setInputFiles('input[type="file"]', {
      name: 'recording.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('ID3 fake mp3 content'),
    });

    await expect(page.getByText('ffmpeg не установлен')).toBeVisible();

    const retryButton = page.getByRole('button', { name: 'Повторить транскрибацию' });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect(page.getByText('В очереди')).toBeVisible();
    await expect(retryButton).toBeHidden();
  });
});
