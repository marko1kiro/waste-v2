import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, BarChart3, FileText, User, Shield, UserCog, ClipboardCheck, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

import type { TenantConfigData } from '@/lib/types'

const STORE_NAV_ITEMS = [
  { href: '/', label: 'Waste', icon: ClipboardList, matchPaths: ['/', '/manual-waste', '/auto-waste', '/paste-waste'] },
  { href: '/dashboard', label: 'History', icon: BarChart3, matchPaths: ['/dashboard'] },
  { href: '/pdf', label: 'PDF', icon: FileText, matchPaths: ['/pdf'] },
  { href: '__qc_checklist__', label: 'Tutorial', icon: ClipboardCheck, matchPaths: [] },
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

  const { data: tenantData } = useQuery<TenantConfigData>({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.fetch<TenantConfigData>('/api/admin/tenant-config'),
    staleTime: 5 * 60_000,
  })

  const qcChecklistUrl = tenantData?.data?.qc_checklist_url || ''

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="pointer-events-auto mx-3 mb-3 flex items-center justify-around rounded-2xl border border-border bg-surface/95 px-2 py-2 shadow-theme-lg backdrop-blur-sm">
        {navItems.map(({ href, label, icon: Icon, matchPaths }) => {
          const isActive = matchPaths.some((p) => (p === '/' ? location === '/' : location.startsWith(p)))

          if (href === '__qc_checklist__') {
            return (
              <a key={href} href={qcChecklistUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-gray-400 transition-colors hover:text-text-primary">
                <Icon size={20} strokeWidth={2} />
                <span className="text-[9px] font-medium">{label}</span>
              </a>
            )
          }

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
