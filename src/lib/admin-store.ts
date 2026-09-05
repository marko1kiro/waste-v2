const ADMIN_STORE_KEY = 'awas_admin_store'

export function getAdminStoreId(): number | null {
  try {
    const raw = localStorage.getItem(ADMIN_STORE_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function setAdminStoreId(storeId: number | null): void {
  try {
    if (storeId === null) localStorage.removeItem(ADMIN_STORE_KEY)
    else localStorage.setItem(ADMIN_STORE_KEY, String(storeId))
  } catch {}
}

export function withStoreId(url: string, storeId: number | null | undefined): string {
  if (storeId === null || storeId === undefined) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}store_id=${storeId}`
}
