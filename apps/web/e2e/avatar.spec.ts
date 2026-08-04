import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const PASSWORD = 'password123';
const API_BASE = 'http://localhost:3001';

// 1x1 transparent PNG — valid magic bytes, detected as image/png by file-type on the API side
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function registerUser(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { email, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function uploadAvatar(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.post(`${API_BASE}/user/profile/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: Buffer.from(PNG_BASE64, 'base64'),
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Мои встречи' })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe('Avatar isolation across accounts (e2e)', () => {
  test('login A with avatar -> logout -> login B: avatar A is not displayed', async ({
    page,
    request,
  }) => {
    const emailA = `avatar-a-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const emailB = `avatar-b-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;

    const tokenA = await registerUser(request, emailA);
    await uploadAvatar(request, tokenA);
    await registerUser(request, emailB);

    await login(page, emailA);
    const header = page.locator('header');
    await expect(header.locator('img[alt]')).toBeVisible();

    await logout(page);
    await login(page, emailB);

    await expect(header.locator('img')).toHaveCount(0);
    await expect(page.getByRole('img', { name: emailB })).toBeVisible();
    await expect(page.getByText(emailB)).toBeVisible();
  });
});
