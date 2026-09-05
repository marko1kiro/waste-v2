import { lazy, Suspense, Component, type ReactNode, type ErrorInfo, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { useAuth } from './contexts/AuthContext'
import LoginForm from './components/ui/login-form'
import AppLayout from './components/ui/app-layout'
import { Toaster } from './components/ui/toaster'
import { PageLoadingSpinner } from './components/ui/loading-spinner'

const WasteMode = lazy(() => import('./pages/waste-mode'))
const AutoWaste = lazy(() => import('./pages/auto-waste'))
const Dashboard = lazy(() => import('./pages/dashboard'))
const PdfDownload = lazy(() => import('./pages/pdf-download'))
const Profile = lazy(() => import('./pages/profile'))
const AdminPanel = lazy(() => import('./pages/admin-panel'))
const AdminPersonnel = lazy(() => import('./pages/admin-personnel'))
const AdminStationItems = lazy(() => import('./pages/admin-station-items'))
const AdminUsers = lazy(() => import('./pages/admin-users'))
const AdminHistory = lazy(() => import('./pages/admin-history'))
const ApiDocs = lazy(() => import('./pages/api-docs'))
const NotFound = lazy(() => import('./pages/not-found'))

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-theme-lg">
            <h1 className="mb-2 text-xl font-semibold text-error-600 dark:text-error-400">Terjadi Kesalahan</h1>
            <p className="mb-4 text-xs text-text-muted">{this.state.error?.message || 'Aplikasi mengalami error yang tidak terduga.'}</p>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">Refresh Halaman</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function StoreRouter() {
  return (
    <Switch>
      <Route path="/" component={WasteMode} />
      <Route path="/manual-waste" component={AutoWaste} />
      <Route path="/auto-waste" component={AutoWaste} />
      <Route path="/paste-waste" component={AutoWaste} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/pdf" component={PdfDownload} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  )
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={AdminPanel} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin/personnel" component={AdminPersonnel} />
      <Route path="/admin/station-items" component={AdminStationItems} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/history" component={AdminHistory} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  )
}

export default function App() {
  const { isAuthenticated, user } = useAuth()
  const [location, navigate] = useLocation()

  useEffect(() => {
    if (!isAuthenticated || !user) return

    if (user.role === 'admin_store' && location.startsWith('/admin')) {
      navigate('/')
      return
    }

    if (user.role === 'super_admin' && (location === '/manual-waste' || location === '/auto-waste' || location === '/paste-waste' || location === '/pdf')) {
      navigate('/')
    }
  }, [isAuthenticated, user, location, navigate])

  if (location === '/docs') {
    return (
      <AppErrorBoundary>
        <Suspense fallback={<PageLoadingSpinner />}>
          <Route path="/docs" component={ApiDocs} />
        </Suspense>
        <Toaster />
      </AppErrorBoundary>
    )
  }

  if (!isAuthenticated) {
    return (
      <AppErrorBoundary>
        <LoginForm />
        <Toaster />
      </AppErrorBoundary>
    )
  }

  return (
    <AppErrorBoundary>
      <AppLayout>
        <Suspense fallback={<PageLoadingSpinner />}>
          {user?.role === 'super_admin' ? <AdminRouter /> : <StoreRouter />}
        </Suspense>
      </AppLayout>
      <Toaster />
    </AppErrorBoundary>
  )
}
