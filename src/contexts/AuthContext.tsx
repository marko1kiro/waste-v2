import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { apiClient, type AuthUser, type StoreInfo } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours
const SESSION_CHECK_INTERVAL = 30_000 // 30 seconds
const SESSION_WARNING_BEFORE = 5 * 60 * 1000 // 5 minutes before expiry
const ACTIVITY_THROTTLE = 60_000 // 1 minute between extensions

interface AuthContextValue {
  user: AuthUser | null
  store: StoreInfo | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => apiClient.getUser())
  const [store, setStoreState] = useState<StoreInfo | null>(() => apiClient.getStore())
  const lastActivityRef = useRef<number>(Date.now())
  const warningShownRef = useRef(false)

  const isAuthenticated = user !== null && apiClient.getToken() !== null

  const logout = useCallback(() => {
    apiClient.clearAuth()
    setUser(null)
    setStoreState(null)
    warningShownRef.current = false
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.fetch<{
      success: boolean
      token: string
      user: AuthUser
      store: StoreInfo | null
    }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    if (res.success && res.token) {
      apiClient.setToken(res.token)
      apiClient.setUser(res.user)
      apiClient.setStore(res.store ?? null)
      apiClient.setLoginTime(Date.now())
      setUser(res.user)
      setStoreState(res.store ?? null)
      warningShownRef.current = false
    }
  }, [])

  // Session expiry check
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      const loginTime = apiClient.getLoginTime()
      if (!loginTime) {
        logout()
        return
      }

      const elapsed = Date.now() - loginTime
      const remaining = SESSION_DURATION_MS - elapsed

      // Expired
      if (remaining <= 0) {
        toast.warning('Sesi Abis', 'Yuk login lagi.')
        logout()
        return
      }

      // Warning 5 minutes before
      if (remaining <= SESSION_WARNING_BEFORE && !warningShownRef.current) {
        warningShownRef.current = true
        toast.warning('Sesi Mau Abis', '5 menit lagi sesi abis nih.')
      }
    }, SESSION_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [isAuthenticated, logout])

  // Activity-based session extension
  useEffect(() => {
    if (!isAuthenticated) return

    function handleActivity() {
      const now = Date.now()
      if (now - lastActivityRef.current > ACTIVITY_THROTTLE) {
        lastActivityRef.current = now
        apiClient.setLoginTime(now) // Extend session
        warningShownRef.current = false
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, [isAuthenticated])

  // Multi-tab sync: listen for storage changes
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'waste_app_token' && !e.newValue) {
        // Token removed in another tab → logout this tab
        setUser(null)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Listen for auth:session-expired event from api-client
  useEffect(() => {
    function handleExpired() {
      logout()
    }

    window.addEventListener('auth:session-expired', handleExpired)
    return () => window.removeEventListener('auth:session-expired', handleExpired)
  }, [logout])

  // Sync state if token was cleared externally
  useEffect(() => {
    if (!apiClient.getToken()) {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, store, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
