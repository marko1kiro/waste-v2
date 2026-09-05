const TOKEN_KEY = 'waste_app_token'
const USER_KEY = 'waste_app_user'
const STORE_KEY = 'waste_app_store'
const LOGIN_TIME_KEY = 'waste_app_login_time'
const DEFAULT_TIMEOUT_MS = 30_000

export interface AuthUser {
  username: string
  display_name: string
  role: 'super_admin' | 'admin_store'
  store_id?: number | null
}

export interface StoreInfo {
  id: number
  code: string
  name: string
  drive_account: 'legacy' | 'neutral'
  features: { manual_mode: boolean; catalog: boolean }
  status: string
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function setStore(store: StoreInfo | null): void {
  if (store === null) localStorage.removeItem(STORE_KEY)
  else localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

function getStore(): StoreInfo | null {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoreInfo
  } catch {
    return null
  }
}

function setLoginTime(time: number): void {
  localStorage.setItem(LOGIN_TIME_KEY, String(time))
}

function getLoginTime(): number | null {
  const raw = localStorage.getItem(LOGIN_TIME_KEY)
  if (!raw) return null
  return parseInt(raw, 10)
}

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(STORE_KEY)
  localStorage.removeItem(LOGIN_TIME_KEY)
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (res.status === 401) {
      const contentType = res.headers.get('content-type') || ''
      const errorBody = contentType.includes('application/json')
        ? await res.json().catch(() => ({ error: 'Unauthorized' }))
        : { error: await res.text().catch(() => 'Unauthorized') }
      const apiMessage = errorBody.error || errorBody.message || 'Unauthorized'

      // If token existed, this is a session expiry — clear auth and redirect
      if (token) {
        clearAuth()
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
        const error = new Error('Sesi abis nih. Yuk login lagi.') as Error & { status?: number }
        error.status = 401
        throw error
      }

      // No token (e.g. login attempt) — just throw the API error message
      throw new Error(apiMessage)
    }

    if (!res.ok) {
      const contentType = res.headers.get('content-type') || ''
      const errorBody = contentType.includes('application/json')
        ? await res.json().catch(() => ({ error: 'Request failed' }))
        : { error: await res.text().catch(() => 'Request failed') }
      const error = new Error(errorBody.error || errorBody.message || `HTTP ${res.status}`) as Error & { status?: number }
      error.status = res.status
      throw error
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('Response API ga valid.')
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Kelamaan nih. Coba lagi ya.')
    }
    if (err instanceof TypeError) {
      throw new Error('Ga bisa konek ke server. Cek koneksi dulu ya.')
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

export const apiClient = {
  getToken,
  setToken,
  setUser,
  getUser,
  setStore,
  getStore,
  setLoginTime,
  getLoginTime,
  clearAuth,
  fetch: apiFetch,
}
