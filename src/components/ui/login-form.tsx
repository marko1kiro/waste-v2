import { useEffect, useMemo, useState } from 'react'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ButtonLoadingSpinner } from '@/components/ui/loading-spinner'

const TYPEWRITER_PHRASES = [
  'Catat waste harian dengan cepat.',
  'BA PDF otomatis, siap tanda tangan.',
  'Nggak perlu rebutan PC lagi.',
]

/** Lightweight typewriter: types, pauses, deletes, then moves to the next phrase. */
function useTypewriter(phrases: string[]) {
  const [text, setText] = useState('')

  useEffect(() => {
    let phraseIndex = 0
    let charIndex = 0
    let deleting = false
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const current = phrases[phraseIndex]
      if (!deleting) {
        charIndex += 1
        setText(current.slice(0, charIndex))
        if (charIndex >= current.length) {
          deleting = true
          timer = setTimeout(tick, 1700)
          return
        }
        timer = setTimeout(tick, 60)
      } else {
        charIndex -= 1
        setText(current.slice(0, Math.max(charIndex, 0)))
        if (charIndex <= 0) {
          deleting = false
          phraseIndex = (phraseIndex + 1) % phrases.length
          timer = setTimeout(tick, 450)
          return
        }
        timer = setTimeout(tick, 30)
      }
    }

    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [phrases])

  return text
}

export default function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const typed = useTypewriter(TYPEWRITER_PHRASES)

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

  const inputClass = 'w-full rounded-xl border border-border bg-surface/70 py-3 pl-11 pr-11 text-sm text-text-primary outline-none backdrop-blur transition placeholder:text-text-dim focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Animated colorful backdrop (pure CSS, GPU-cheap transforms only) */}
      <div aria-hidden className="login-aurora pointer-events-none absolute inset-0" />
      <div aria-hidden className="login-orb-a pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" />
      <div aria-hidden className="login-orb-b pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />
      <div aria-hidden className="login-orb-c pointer-events-none absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-success-400/20 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(120,130,150,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(120,130,150,0.22) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo.webp"
              alt="AWAS"
              width={84}
              height={84}
              className="mb-4 animate-in zoom-in rounded-2xl shadow-theme-lg ring-1 ring-white/20 duration-500"
            />
            <h1 className="bg-gradient-to-r from-brand-400 via-brand-500 to-orange-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              AWAS
            </h1>
            <p className="mt-3 min-h-[1.75rem] text-sm font-medium text-brand-600 dark:text-brand-300">
              {typed}
              <span aria-hidden className="type-caret" />
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-surface/80 p-6 shadow-theme-xl backdrop-blur-xl">
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
                <p className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-center text-xs font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-3 text-sm font-semibold text-white shadow-theme-md transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              >
                {loading && <ButtonLoadingSpinner />}
                {loading ? 'Bentar ya...' : 'LOGIN'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 animate-in fade-in pb-6 text-center duration-700">
        <p className="bg-gradient-to-r from-brand-400 via-orange-400 to-success-400 bg-clip-text text-sm font-extrabold tracking-[0.35em] text-transparent">
          XDIRGA LABS
        </p>
        <p className="mt-1.5 text-[10px] font-medium tracking-[0.3em] text-text-dim">
          SIMPLIFY YOUR MIND
        </p>
      </footer>
    </div>
  )
}
