import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { BarChart3, FileText, User, LogOut, ClipboardList, Shield, Boxes, Users, UserCog, ClipboardCheck } from 'lucide-react'

import type { TenantConfigData } from '@/lib/types'

const STORE_NAV_ITEMS = [
  { href: '/', label: 'Waste', icon: ClipboardList },
  { href: '/dashboard', label: 'History', icon: BarChart3 },
  { href: '/pdf', label: 'PDF Report', icon: FileText },
  { href: '__qc_checklist__', label: 'QC Checklist', icon: ClipboardCheck },
  { href: '/profile', label: 'Profil', icon: User },
] as const

const ADMIN_NAV_ITEMS = [
  { href: '/', label: 'Admin Panel', icon: Shield },
  { href: '/dashboard', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/personnel', label: 'Personnel', icon: Users },
  { href: '/admin/station-items', label: 'Station Items', icon: Boxes },
  { href: '/admin/users', label: 'Store Accounts', icon: UserCog },
  { href: '/profile', label: 'Profil', icon: User },
] as const

export default function DesktopSidebar() {
  const [location] = useLocation()
  const { user, logout } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const navItems = isSuperAdmin ? ADMIN_NAV_ITEMS : STORE_NAV_ITEMS

  const { data: tenantData } = useQuery<TenantConfigData>({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.fetch<TenantConfigData>('/api/admin/tenant-config'),
    staleTime: 5 * 60_000,
  })

  const qcChecklistUrl = tenantData?.data?.qc_checklist_url || ''

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-[240px] flex-col border-r-2 border-border bg-[#111] lg:flex">
      <div className="border-b-2 border-border p-5">
        <h1 className="text-lg font-black text-warning">AWAS</h1>
        <p className="text-[10px] text-text-muted">Waste App by Marko</p>
      </div>

      <div className="border-b-2 border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border bg-[#0d0d0d] text-sm font-black text-primary">{user?.display_name?.charAt(0) || 'U'}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-text-primary">{user?.display_name}</p>
            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">{isSuperAdmin ? 'Super Admin' : 'Store'}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            if (href === '__qc_checklist__') {
              return (
                <a key={href} href={qcChecklistUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border-2 border-transparent px-3 py-2.5 text-sm font-bold text-text-muted transition-all hover:border-border hover:bg-[#1a1a1a] hover:text-text-primary">
                  <Icon size={18} strokeWidth={2} />{label}
                </a>
              )
            }

            const isActive = href === '/'
              ? isSuperAdmin ? location === '/' : location === '/' || location === '/manual-waste' || location === '/auto-waste' || location === '/paste-waste'
              : location.startsWith(href)

            return (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition-all ${isActive ? 'border-warning bg-warning/5 text-warning shadow-nb-yellow' : 'border-transparent text-text-muted hover:border-border hover:bg-[#1a1a1a] hover:text-text-primary'}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />{label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t-2 border-border p-3">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg border-2 border-transparent px-3 py-2.5 text-sm font-bold text-text-muted transition hover:border-danger/30 hover:bg-danger/5 hover:text-danger"><LogOut size={18} /> Logout</button>
      </div>

      <div className="px-5 pb-3"><p className="text-[9px] text-text-dim">AWAS v4.0</p></div>
    </aside>
  )
}
