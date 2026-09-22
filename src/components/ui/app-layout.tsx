import { useLocation } from 'wouter'
import { Copyright } from 'lucide-react'
import DesktopSidebar from './desktop-sidebar'
import MobileBottomNav from './mobile-bottom-nav'
import ShiftStatusBar from './shift-status-bar'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth()
  const [location] = useLocation()
  const { collapsed } = useSidebarCollapsed()
  const isSuperAdmin = user?.role === 'super_admin'
  const showShiftBar = !isSuperAdmin && ['/', '/manual-waste', '/auto-waste', '/paste-waste', '/pdf'].includes(location)

  return (
    <div className="min-h-dvh">
      <DesktopSidebar />

      <main className={`transition-[margin] duration-300 ease-out ${collapsed ? 'lg:ml-[80px]' : 'lg:ml-[248px]'}`}>
        {showShiftBar && (
          <div className="px-4 pt-4">
            <ShiftStatusBar />
          </div>
        )}
        <div className="px-4 pb-28 pt-4 lg:pb-8">
          {children}
        </div>
        <footer className="mb-20 flex flex-wrap items-center justify-center gap-x-1.5 px-4 pb-4 text-center text-[11px] text-text-muted lg:mb-0">
          <span className="font-bold tracking-wide text-text-secondary">XDIRGA LABS</span>
          <Copyright size={12} className="shrink-0" />
          <span>2026</span>
          <span aria-hidden="true" className="text-text-dim">|</span>
          <span className="tracking-wide">SIMPLIFY YOUR MIND</span>
        </footer>
      </main>

      <MobileBottomNav />
    </div>
  )
}
