import '@testing-library/jest-dom/vitest';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();

  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
  };
}
