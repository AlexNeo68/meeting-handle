export function parseProgress(line: string): number | null {
  const match = /progress\s*=\s*(\d+)\s*%/.exec(line);
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 10);
  return Math.min(100, Math.max(0, value));
}

export function parseLanguage(line: string): string | null {
  const match = /auto-detected language:\s*([a-z]{2,3})/i.exec(line);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase();
}
