/**
 * A module-level in-memory store that mimics the Web Storage API interface.
 * Unlike localStorage/sessionStorage, values are held in a plain Map and do
 * not survive page refreshes or shared across tabs.  This is useful when
 * persistent browser storage is unavailable or undesired (e.g. server-side
 * rendering, incognito restrictions, or private embedded contexts).
 */
const store = new Map<string, string>()

export const inMemoryStorage = {
  getItem(key: string): string | null {
    return store.has(key) ? (store.get(key) as string) : null
  },
  setItem(key: string, value: string): void {
    store.set(key, value)
  },
  removeItem(key: string): void {
    store.delete(key)
  },
  clear(): void {
    store.clear()
  },
}
