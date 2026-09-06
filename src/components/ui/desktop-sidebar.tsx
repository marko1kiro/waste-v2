import { useLocation, Link } from 'wouter'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { BarChart3, FileText, User, LogOut, ClipboardList, Shield, Boxes, Users, UserCog, ClipboardCheck, Sun, Moon, Building2 } from 'lucide-react'

const STORE_NAV_ITEMS = [
  { href: '/', label: 'Waste', icon: ClipboardList },
  { href: '/dashboard', label: 'History', icon: BarChart3 },
  { href: '/pdf', label: 'PDF Report', icon: FileText },
  { href: '/tutorial', label: 'Tutorial', icon: ClipboardCheck },
  { href: '/profile', label: 'Profil', icon: User },
] as const

const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Admin Panel', icon: Shield },
  { href: '/admin/restos', label: 'Kelola Resto', icon: Building2 },
  { href: '/dashboard', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/personnel', label: 'Personnel', icon: Users },
  { href: '/admin/station-items', label: 'Station Items', icon: Boxes },
  { href: '/admin/users', label: 'Store Accounts', icon: UserCog },
  { href: '/profile', label: 'Profil', icon: User },
] as const

export default function DesktopSidebar() {
  const [location] = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const isSuperAdmin = user?.role === 'super_admin'
  const navItems = isSuperAdmin ? ADMIN_NAV_ITEMS : STORE_NAV_ITEMS

  const itemBase = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'
  const itemActive = 'bg-brand-50 text-brand-700 dark:bg-brand-500/[0.12] dark:text-brand-400'
  const itemInactive = 'text-gray-400 hover:bg-gray-100 hover:text-text-primary dark:hover:bg-white/5 dark:hover:text-text-primary'

  return (
    <aside className="group/sidebar fixed left-0 top-0 z-40 hidden h-dvh w-[88px] flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-300 hover:w-[290px] lg:flex">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">A</div>
        <div className="hidden min-w-0 group-hover/sidebar:block">
          <h1 className="text-lg font-semibold leading-tight text-text-primary">AWAS</h1>
          <p className="text-[10px] text-text-muted">Waste App by Marko</p>
        </div>
      </div>

      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">{user?.display_name?.charAt(0) || 'U'}</div>
          <div className="hidden min-w-0 flex-1 group-hover/sidebar:block">
            <p className="truncate text-xs font-semibold text-text-primary">{user?.display_name}</p>
            <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{isSuperAdmin ? 'Super Admin' : 'Store'}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/'
              ? isSuperAdmin ? location === '/' : location === '/' || location === '/manual-waste' || location === '/auto-waste' || location === '/paste-waste'
              : location.startsWith(href)

            return (
              <Link key={href} href={href} className={`${itemBase} ${isActive ? itemActive : itemInactive}`}>
                <Icon className="size-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} /><span className="hidden whitespace-nowrap group-hover/sidebar:inline">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <button onClick={toggle} className={`${itemBase} ${itemInactive} w-full`} aria-label="Toggle tema">
          {theme === 'dark' ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}<span className="hidden whitespace-nowrap group-hover/sidebar:inline">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
        <button onClick={logout} className={`${itemBase} w-full text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400`}>
          <LogOut className="size-5 shrink-0" /><span className="hidden whitespace-nowrap group-hover/sidebar:inline">Logout</span>
        </button>
      </div>

      <div className="px-5 pb-3"><p className="hidden whitespace-nowrap text-[9px] text-text-dim group-hover/sidebar:block">AWAS v4.0</p></div>
    </aside>
  )
}
