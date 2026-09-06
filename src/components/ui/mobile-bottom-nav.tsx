import { useLocation, Link } from 'wouter'
import { ClipboardList, BarChart3, FileText, User, Shield, UserCog, ClipboardCheck, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const STORE_NAV_ITEMS = [
  { href: '/', label: 'Waste', icon: ClipboardList, matchPaths: ['/', '/manual-waste', '/auto-waste', '/paste-waste'] },
  { href: '/dashboard', label: 'History', icon: BarChart3, matchPaths: ['/dashboard'] },
  { href: '/pdf', label: 'PDF', icon: FileText, matchPaths: ['/pdf'] },
  { href: '/tutorial', label: 'Tutorial', icon: ClipboardCheck, matchPaths: ['/tutorial'] },
  { href: '/profile', label: 'Profil', icon: User, matchPaths: ['/profile'] },
] as const

const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Panel', icon: Shield, matchPaths: ['/'] },
  { href: '/admin/restos', label: 'Resto', icon: Building2, matchPaths: ['/admin/restos'] },
  { href: '/dashboard', label: 'Stats', icon: BarChart3, matchPaths: ['/dashboard'] },
  { href: '/admin/users', label: 'Akun', icon: UserCog, matchPaths: ['/admin/users'] },
  { href: '/profile', label: 'Profil', icon: User, matchPaths: ['/profile'] },
] as const

export default function MobileBottomNav() {
  const [location] = useLocation()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const navItems = isSuperAdmin ? ADMIN_NAV_ITEMS : STORE_NAV_ITEMS

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="pointer-events-auto mx-3 mb-3 flex items-center justify-around rounded-2xl border border-border bg-surface/95 px-2 py-2 shadow-theme-lg backdrop-blur-sm">
        {navItems.map(({ href, label, icon: Icon, matchPaths }) => {
          const isActive = matchPaths.some((p) => (p === '/' ? location === '/' : location.startsWith(p)))

          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${isActive ? 'text-brand-500' : 'text-gray-400 hover:text-text-primary'}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
