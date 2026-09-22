import { useCallback, useEffect, useState } from 'react'

const KEY = 'awash:sidebar-collapsed'
const EVT = 'awash:sidebar-toggle'

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v !== null) return v === '1'
  } catch {
    /* abaikan: storage tidak tersedia */
  }
  // Default: rail di layar sedang, full di layar besar
  return typeof window !== 'undefined' ? window.innerWidth < 1280 : false
}

/**
 * Status collapse sidebar desktop, dishare antara DesktopSidebar dan AppLayout.
 * Disimpan di localStorage + disinkronkan lewat CustomEvent.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read)

  useEffect(() => {
    const onEvt = () => setCollapsed(read())
    window.addEventListener(EVT, onEvt)
    return () => window.removeEventListener(EVT, onEvt)
  }, [])

  const toggle = useCallback(() => {
    const next = !read()
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      /* abaikan */
    }
    window.dispatchEvent(new Event(EVT))
  }, [])

  return { collapsed, toggle }
}
