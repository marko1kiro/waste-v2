import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { apiClient } from '@/lib/api-client'
import { getBusinessDateWIB, SHIFTS } from '@shared/timezone'
import type { ShiftStatusData } from '@/lib/types'
import { BarChart3, FileText, User, LogOut, ClipboardList, Shield, Boxes, Users, UserCog, ClipboardCheck, Sun, Moon, Building2, History, ChevronLeft, ChevronRight } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: typeof ClipboardList
}

const STORE_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Utama',
    items: [
      { href: '/', label: 'Input Waste', icon: ClipboardList },
      { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/pdf', label: 'PDF Report', icon: FileText },
    ],
  },
  {
    section: 'Lainnya',
    items: [
      { href: '/tutorial', label: 'Tutorial', icon: ClipboardCheck },
      { href: '/profile', label: 'Profil', icon: User },
    ],
  },
]

const ADMIN_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Administrasi',
    items: [
      { href: '/', label: 'Admin Panel', icon: Shield },
      { href: '/admin/restos', label: 'Kelola Resto', icon: Building2 },
      { href: '/admin/personnel', label: 'Personnel', icon: Users },
      { href: '/admin/station-items', label: 'Station Items', icon: Boxes },
      { href: '/admin/users', label: 'Store Accounts', icon: UserCog },
    ],
  },
  {
    section: 'Laporan',
    items: [
      { href: '/dashboard', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/history', label: 'History', icon: History },
      { href: '/profile', label: 'Profil', icon: User },
    ],
  },
]

function isActive(href: string, location: string, isSuperAdmin: boolean) {
  if (href === '/') {
    return isSuperAdmin
      ? location === '/'
      : location === '/' || location === '/manual-waste' || location === '/auto-waste' || location === '/paste-waste'
  }
  return location === href || location.startsWith(href + '/')
}

/** Widget shift ringkas satu baris (store saja) */
function ShiftMiniWidget() {
  const businessDate = getBusinessDateWIB()
  const { data } = useQuery<ShiftStatusData>({
    queryKey: ['shift-status', businessDate],
    queryFn: () => apiClient.fetch<ShiftStatusData>(`/api/get?action=shift-status&date=${businessDate}`),
    staleTime: 60_000,
  })
  const done = SHIFTS.filter((s) => data?.shifts?.[s]?.done === true).length
  const pct = Math.round((done / SHIFTS.length) * 100)

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt/50 px-2.5 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Shift</span>
      <span className="text-[11px] font-bold tabular-nums text-text-primary">{done}/{SHIFTS.length}</span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DesktopSidebar() {
  const [location] = useLocation()
  const { user, store, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed()
  const isSuperAdmin = user?.role === 'super_admin'
  const sections = isSuperAdmin ? ADMIN_NAV : STORE_NAV

  const itemBase = 'flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150'
  const itemActive = 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
  const itemInactive = 'text-text-muted hover:bg-surface-alt hover:text-text-primary'

  return (
    <aside className={`fixed left-0 top-0 z-40 hidden h-dvh flex-col overflow-hidden border-r border-border bg-surface lg:flex ${collapsed ? 'lg:w-[80px]' : 'lg:w-[248px]'}`}>
      {/* Tombol collapse */}
      <button
        onClick={toggleSidebar}
        title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        className="absolute -right-3 top-[46px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:border-brand-400 hover:text-brand-500"
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Brand */}
      <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-border ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        <div className="neon-on-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">A</div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-tight tracking-tight text-text-primary">AWAS</h1>
            <p className="text-[9px] font-medium uppercase tracking-wider text-text-dim">Waste App</p>
          </div>
        )}
      </div>

      {/* User ringkas */}
      <div className={`flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-700 dark:text-brand-300">
          {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-text-primary">{user?.display_name}</p>
            <p className="truncate text-[10px] leading-tight text-text-dim">{isSuperAdmin ? 'Super Admin' : store?.code || 'Store'}</p>
          </div>
        )}
      </div>

      {/* Nav — tanpa scroll, semua muat */}
      <nav className="min-h-0 flex-1 overflow-hidden px-2.5 py-3">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim">{sec.section}</p>
            )}
            <div className="space-y-0.5">
              {sec.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, location, isSuperAdmin)
                return (
                  <Link key={href} href={href} title={collapsed ? label : undefined} className={`${itemBase} ${active ? itemActive : itemInactive} ${collapsed ? 'justify-center px-0' : ''}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${active ? 'neon-on-gradient bg-brand-500 text-white' : 'text-text-dim'}`}>
                      <Icon className="size-4" strokeWidth={active ? 2.5 : 2} />
                    </span>
                    {!collapsed && <span className="truncate whitespace-nowrap">{label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Widget shift (store, expanded) */}
      {!isSuperAdmin && !collapsed && (
        <div className="shrink-0 px-2.5 pb-2.5">
          <ShiftMiniWidget />
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 space-y-0.5 border-t border-border p-2.5">
        <button onClick={toggle} title={collapsed ? 'Ganti tema' : undefined} aria-label="Toggle tema" className={`${itemBase} w-full text-text-muted hover:bg-surface-alt hover:text-text-primary ${collapsed ? 'justify-center px-0' : ''}`}>
          {theme === 'dark' ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
          {!collapsed && <span>Mode {theme === 'dark' ? 'Terang' : 'Gelap'}</span>}
        </button>
        <button onClick={logout} title={collapsed ? 'Logout' : undefined} className={`${itemBase} w-full text-text-muted hover:bg-error-500/10 hover:text-error-500 ${collapsed ? 'justify-center px-0' : ''}`}>
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
