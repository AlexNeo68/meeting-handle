const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;

export function formatFileSize(bytes: number, locale = 'ru-RU'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes === 0) return '0 Б';

  const i = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 1024 ** i;
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(value);

  return `${formatted} ${UNITS[i]}`;
}
