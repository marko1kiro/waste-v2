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
  desc: string
  icon: typeof ClipboardList
}

const STORE_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Utama',
    items: [
      { href: '/', label: 'Input Waste', desc: 'Catat waste shift berjalan', icon: ClipboardList },
      { href: '/dashboard', label: 'Dashboard', desc: 'Tren & analitik waste', icon: BarChart3 },
      { href: '/pdf', label: 'PDF Report', desc: 'Unduh BA harian/bulanan', icon: FileText },
    ],
  },
  {
    section: 'Lainnya',
    items: [
      { href: '/tutorial', label: 'Tutorial', desc: 'Panduan pemakaian', icon: ClipboardCheck },
      { href: '/profile', label: 'Profil', desc: 'Akun & pengaturan', icon: User },
    ],
  },
]

const ADMIN_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Administrasi',
    items: [
      { href: '/', label: 'Admin Panel', desc: 'Ringkasan operasional', icon: Shield },
      { href: '/admin/restos', label: 'Kelola Resto', desc: 'Data store & konfigurasi', icon: Building2 },
      { href: '/admin/personnel', label: 'Personnel', desc: 'QC, manager & TTD', icon: Users },
      { href: '/admin/station-items', label: 'Station Items', desc: 'Master item per station', icon: Boxes },
      { href: '/admin/users', label: 'Store Accounts', desc: 'Akun login resto', icon: UserCog },
    ],
  },
  {
    section: 'Laporan',
    items: [
      { href: '/dashboard', label: 'Analytics', desc: 'Tren & breakdown waste', icon: BarChart3 },
      { href: '/admin/history', label: 'History', desc: 'Riwayat semua input', icon: History },
      { href: '/profile', label: 'Profil', desc: 'Akun & pengaturan', icon: User },
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
    <div className="rounded-xl border border-border bg-surface-alt/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">Shift hari ini</p>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-text-primary">{done}/{SHIFTS.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-success-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-text-muted">
        {done === SHIFTS.length ? 'Semua shift kelar 🎉' : `Sisa ${SHIFTS.length - done} shift lagi`}
      </p>
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

  const itemBase = 'group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200'
  const itemActive = 'bg-gradient-to-r from-brand-500/[0.14] to-brand-500/[0.03] text-brand-700 dark:from-brand-500/[0.18] dark:to-transparent dark:text-brand-200'
  const itemInactive = 'text-text-muted hover:bg-surface-alt hover:text-text-primary'

  return (
    <aside className={`fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-border bg-surface/95 backdrop-blur transition-[width] duration-300 ease-out lg:flex ${collapsed ? 'lg:w-[88px]' : 'lg:w-[264px]'}`}>
      {/* Tombol collapse mengambang di tepi sidebar */}
      <button
        onClick={toggleSidebar}
        title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        className="btn-press absolute -right-3.5 top-[54px] z-50 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-theme-xs transition-colors hover:border-brand-300 hover:text-brand-600"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Brand */}
      <div className={`flex h-[72px] shrink-0 items-center gap-3 border-b border-border ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-theme-xs">A</div>
        {!collapsed && (
          <div className="anim-fade-in min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-text-primary">AWAS</h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim">Waste App</p>
          </div>
        )}
      </div>

      {/* User */}
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 text-sm font-bold text-brand-700 dark:border-brand-500/30 dark:from-brand-500/20 dark:to-brand-500/5 dark:text-brand-300">
            {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="anim-fade-in min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">{user?.display_name}</p>
              <span className="mt-0.5 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {isSuperAdmin ? 'Super Admin' : store?.code || 'Store'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="anim-fade-in mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-dim">{sec.section}</p>
            )}
            <div className="space-y-1">
              {sec.items.map(({ href, label, desc, icon: Icon }) => {
                const active = isActive(href, location, isSuperAdmin)
                return (
                  <Link key={href} href={href} title={collapsed ? label : undefined} className={`${itemBase} ${active ? itemActive : itemInactive} ${collapsed ? 'justify-center px-2' : ''}`}>
                    {active && !collapsed && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />}
                    <span className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${collapsed ? 'h-10 w-10' : 'h-8 w-8'} ${active ? 'bg-brand-500 text-white shadow-theme-xs' : 'bg-surface-alt text-text-muted group-hover/item:bg-brand-50 group-hover/item:text-brand-600 dark:group-hover/item:bg-brand-500/10 dark:group-hover/item:text-brand-300'}`}>
                      <Icon className={collapsed ? 'size-5' : 'size-4'} strokeWidth={active ? 2.5 : 2} />
                    </span>
                    {!collapsed && (
                      <span className="anim-fade-in min-w-0">
                        <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">{label}</span>
                        <span className="block whitespace-nowrap text-[10px] font-normal leading-tight text-text-dim">{desc}</span>
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Widget shift (store saja) */}
      {!isSuperAdmin && !collapsed && (
        <div className="anim-fade-in shrink-0 px-3 pb-3">
          <ShiftMiniWidget />
        </div>
      )}

      {/* Footer actions */}
      <div className="shrink-0 space-y-1 border-t border-border p-3">
        <button onClick={toggle} title={collapsed ? 'Ganti tema' : undefined} className={`${itemBase} ${itemInactive} btn-press w-full ${collapsed ? 'justify-center px-2' : ''}`} aria-label="Toggle tema">
          {theme === 'dark' ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
          {!collapsed && <span className="anim-fade-in whitespace-nowrap text-[13px]">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>}
        </button>
        <button onClick={logout} title={collapsed ? 'Logout' : undefined} className={`${itemBase} btn-press w-full text-text-muted transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400 ${collapsed ? 'justify-center px-2' : ''}`}>
          <LogOut className="size-5 shrink-0" />
          {!collapsed && <span className="anim-fade-in whitespace-nowrap text-[13px]">Logout</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="anim-fade-in shrink-0 px-5 pb-4">
          <p className="whitespace-nowrap text-[10px] font-medium text-text-dim">AWAS v4.0 • XDIRGA LABS</p>
        </div>
      )}
    </aside>
  )
}
