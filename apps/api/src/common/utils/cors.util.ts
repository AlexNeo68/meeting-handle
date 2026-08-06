const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();

  if (!raw) {
    return DEFAULT_DEV_ORIGINS;
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
