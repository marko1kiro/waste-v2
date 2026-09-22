import { useLocation, Link } from 'wouter'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { BarChart3, FileText, User, LogOut, ClipboardList, Shield, Boxes, Users, UserCog, ClipboardCheck, Sun, Moon, Building2, History } from 'lucide-react'

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

export default function DesktopSidebar() {
  const [location] = useLocation()
  const { user, store, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const isSuperAdmin = user?.role === 'super_admin'
  const sections = isSuperAdmin ? ADMIN_NAV : STORE_NAV

  const itemBase = 'group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200'
  const itemActive = 'bg-brand-50 text-brand-700 dark:bg-brand-500/[0.12] dark:text-brand-300'
  const itemInactive = 'text-text-muted hover:bg-surface-alt hover:text-text-primary'

  return (
    <aside className="group/sidebar fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-border bg-surface/95 backdrop-blur transition-[width] duration-300 lg:flex lg:w-[88px] lg:hover:w-[300px] lg:[&:hover_.nav-label]:block lg:[&:hover_.nav-desc]:block lg:[&:hover_.nav-section]:block lg:[&:hover_.brand-text]:block xl:w-[264px] xl:[&_.nav-label]:block xl:[&_.nav-desc]:block xl:[&_.nav-section]:block xl:[&_.brand-text]:block">
      {/* Brand */}
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-theme-xs">A</div>
        <div className="brand-text hidden min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-text-primary">AWAS</h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim">Waste App</p>
        </div>
      </div>

      {/* User */}
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 text-sm font-bold text-brand-700 dark:border-brand-500/30 dark:from-brand-500/20 dark:to-brand-500/5 dark:text-brand-300">
            {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="brand-text hidden min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text-primary">{user?.display_name}</p>
            <span className="mt-0.5 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {isSuperAdmin ? 'Super Admin' : store?.code || 'Store'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sections.map((sec) => (
          <div key={sec.section} className="mb-5 last:mb-0">
            <p className="nav-section mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-widest text-text-dim">{sec.section}</p>
            <div className="space-y-1">
              {sec.items.map(({ href, label, desc, icon: Icon }) => {
                const active = isActive(href, location, isSuperAdmin)
                return (
                  <Link key={href} href={href} className={`${itemBase} ${active ? itemActive : itemInactive}`}>
                    {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />}
                    <Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span className="min-w-0">
                      <span className="nav-label hidden whitespace-nowrap leading-tight">{label}</span>
                      <span className="nav-desc hidden whitespace-nowrap text-[10px] font-normal leading-tight text-text-dim">{desc}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer actions */}
      <div className="shrink-0 space-y-1 border-t border-border p-3">
        <button onClick={toggle} className={`${itemBase} ${itemInactive} btn-press w-full`} aria-label="Toggle tema">
          {theme === 'dark' ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
          <span className="nav-label hidden whitespace-nowrap">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
        <button onClick={logout} className={`${itemBase} btn-press w-full text-text-muted transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400`}>
          <LogOut className="size-5 shrink-0" />
          <span className="nav-label hidden whitespace-nowrap">Logout</span>
        </button>
      </div>

      <div className="shrink-0 px-5 pb-4">
        <p className="brand-text hidden whitespace-nowrap text-[10px] font-medium text-text-dim">AWAS v4.0 • XDIRGA LABS</p>
      </div>
    </aside>
  )
}
