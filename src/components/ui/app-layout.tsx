import { useLocation } from 'wouter'
import { Coffee } from 'lucide-react'
import DesktopSidebar from './desktop-sidebar'
import MobileBottomNav from './mobile-bottom-nav'
import ShiftStatusBar from './shift-status-bar'
import { useAuth } from '@/contexts/AuthContext'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth()
  const [location] = useLocation()
  const isSuperAdmin = user?.role === 'super_admin'
  const showShiftBar = !isSuperAdmin && ['/', '/manual-waste', '/auto-waste', '/paste-waste', '/pdf'].includes(location)

  return (
    <div className="min-h-dvh">
      <DesktopSidebar />

      <main className="lg:ml-[240px]">
        {showShiftBar && (
          <div className="px-4 pt-4">
            <ShiftStatusBar />
          </div>
        )}
        <div className="px-4 pb-28 pt-4 lg:pb-8">
          {children}
        </div>
        <footer className="mb-20 flex items-center justify-center gap-1 pb-4 text-[11px] text-text-muted lg:mb-0">
          <span>&copy;2026 Made with</span>
          <Coffee size={12} className="text-warning" />
          <span>by Marko</span>
        </footer>
      </main>

      <MobileBottomNav />
    </div>
  )
}
