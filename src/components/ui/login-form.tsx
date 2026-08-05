import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

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

  return (
    <div className="login-page">
      {/* Background decorations */}
      <div className="login-sparkles">
        <span className="sparkle s1">✦</span>
        <span className="sparkle s2">✦</span>
        <span className="sparkle s3">✦</span>
        <span className="sparkle s4">✦</span>
        <span className="sparkle s5">✦</span>
        <span className="sparkle s6">✦</span>
        <span className="sparkle s7">✦</span>
        <span className="sparkle s8">✦</span>
        <span className="sparkle s9">✦</span>
      </div>

      <div className="login-card">
        {/* Logo + Cloud */}
        <div className="login-logo-area">
          <div className="cloud-wrap">
            <svg className="kawaii-cloud" viewBox="0 0 80 40" fill="none">
              <ellipse cx="40" cy="26" rx="30" ry="14" fill="white" />
              <ellipse cx="24" cy="22" rx="14" ry="12" fill="white" />
              <ellipse cx="56" cy="22" rx="14" ry="12" fill="white" />
              <ellipse cx="40" cy="16" rx="16" ry="12" fill="white" />
              <circle cx="34" cy="26" r="1.5" fill="#333" />
              <circle cx="46" cy="26" r="1.5" fill="#333" />
              <path d="M37 30 Q40 33 43 30" stroke="#333" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="login-logo">
            <img src="/logo.webp" alt="AWAS Mascot" width="160" height="160" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="login-heading">Eh, Balik Lagi!</h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="input-wrap input-dark">
            <span className="input-icon">👤</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              maxLength={64}
              placeholder="Username"
            />
          </div>

          <div className="input-wrap input-light">
            <span className="input-icon">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              maxLength={128}
              placeholder="Password"
            />
            <button type="button" className="toggle-pw" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password">
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={!canSubmit} className="login-btn">
            {loading ? 'Bentar ya...' : 'LOGIN'}
          </button>
        </form>

        {/* Footer */}
        <p className="login-footer">A Product By <strong>MarkoID</strong></p>
      </div>
    </div>
  )
}
