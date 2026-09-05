import { useMemo, useState } from 'react'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ButtonLoadingSpinner } from '@/components/ui/loading-spinner'

export default function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => username.trim().length > 0 && password.length > 0 && !loading, [username, password, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanUsername = username.trim()

    if (!cleanUsername || !password) {
      setError('Username sama password harus diisi dong!')
      return
    }

    setError('')
    setLoading(true)

    try {
      await login(cleanUsername, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal nih')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background py-3 pl-11 pr-11 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10'

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Brand panel (desktop) */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-500 to-brand-600 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <img src="/logo.webp" alt="AWAS" width={140} height={140} className="relative mb-6 rounded-2xl shadow-theme-xl" />
        <h1 className="relative text-4xl font-semibold text-white">AWAS</h1>
        <p className="relative mt-2 max-w-xs text-center text-sm text-white/80">
          Aplikasi pencatatan dan pemusnahan waste harian untuk operasional store.
        </p>
        <p className="relative mt-10 text-xs text-white/60">A Product By MarkoID</p>
      </div>

      {/* Form area */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img src="/logo.webp" alt="AWAS" width={88} height={88} className="mb-4 rounded-xl shadow-theme-md" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-theme-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="mb-1 text-xl font-semibold text-text-primary">Selamat Datang!</h1>
            <p className="mb-6 text-sm text-text-muted">Login buat lanjut ke aplikasi waste.</p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  maxLength={64}
                  placeholder="Username"
                  className={inputClass}
                />
              </div>

              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Password"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted transition hover:text-text-primary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && (
                <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-center text-xs font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <ButtonLoadingSpinner />}
                {loading ? 'Bentar ya...' : 'LOGIN'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-text-muted">
              A Product By <strong className="text-text-primary">MarkoID</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
