const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes === 0) return '0 B';

  const i = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 1024 ** i;
  const formatted = i === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');

  return `${formatted} ${UNITS[i]}`;
}
