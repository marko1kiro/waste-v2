import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { apiClient } from '@/lib/api-client'
import {
  AtSign, BadgeCheck, Building2, Copy, Crown, Eye, KeyRound, LogOut,
  Plus, ShieldCheck, Store as StoreIcon, Sun, Moon, Trash2, User as UserIcon, X,
} from 'lucide-react'

interface ApiKey {
  id: number
  name: string
  key_masked: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

function keyStatus(key: ApiKey): { label: string; cls: string } {
  if (key.revoked_at) return { label: 'Dicabut', cls: 'bg-error-500/10 text-error-600 dark:text-error-400' }
  if (key.expires_at && new Date(key.expires_at) <= new Date()) return { label: 'Kedaluwarsa', cls: 'bg-warning-500/10 text-warning-600 dark:text-warning-400' }
  return { label: 'Aktif', cls: 'bg-success-500/10 text-success-600 dark:text-success-400' }
}

export default function Profile() {
  const { user, store, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState('30')
  const [rawKey, setRawKey] = useState('')
  const [revealId, setRevealId] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const isSuperAdmin = user?.role === 'super_admin'
  const roleLabel = isSuperAdmin ? 'Super Admin' : 'Store Admin'
  const RoleIcon = isSuperAdmin ? Crown : StoreIcon

  const loadKeys = () =>
    apiClient.fetch<{ data: ApiKey[] }>('/api/admin/api-keys')
      .then((data) => setKeys(data.data))
      .catch((err: Error) => setError(err.message))
  useEffect(() => { void loadKeys() }, [])

  const closeRawKey = () => { setRawKey(''); setPassword(''); setRevealId(null) }
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyalin ke clipboard.')
    }
  }
  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const data = await apiClient.fetch<{ rawKey: string }>('/api/admin/api-keys', { method: 'POST', body: JSON.stringify({ name, expiry }) })
      setRawKey(data.rawKey)
      setName('')
      await loadKeys()
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal membuat API key.') }
    finally { setCreating(false) }
  }
  const reveal = async () => {
    if (revealId === null) return
    setError('')
    try {
      const data = await apiClient.fetch<{ rawKey: string }>('/api/admin/api-keys?operation=reveal', { method: 'POST', body: JSON.stringify({ id: revealId, password }) })
      setRawKey(data.rawKey)
      setPassword('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal membuka API key.') }
  }
  const revoke = async (id: number) => {
    if (!window.confirm('Cabut API key ini? Aksesnya langsung berhenti.')) return
    try { await apiClient.fetch(`/api/admin/api-keys?id=${id}`, { method: 'DELETE' }); await loadKeys() } catch (err) { setError(err instanceof Error ? err.message : 'Gagal mencabut API key.') }
  }

  return (
    <div className="anim-enter mx-auto w-full max-w-5xl py-4 lg:py-8">
      {/* Header profil */}
      <div className="hover-lift mb-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-theme-xs">
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500" />
        <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:gap-6 lg:p-8">
          <div className="relative shrink-0">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border-2 border-brand-500/40 shadow-theme-md lg:h-24 lg:w-24">
              <img src="/logo.webp" alt="Avatar" width="96" height="96" className="h-full w-full object-cover" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-success-500" title="Aktif">
              <BadgeCheck size={12} className="text-white" />
            </span>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-xl font-bold tracking-tight text-text-primary lg:text-2xl">
              {user?.display_name || user?.username}
            </h1>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-sm text-text-muted sm:justify-start">
              <AtSign size={13} />{user?.username}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                <RoleIcon size={12} />{roleLabel}
              </span>
              {!isSuperAdmin && store?.code && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  <Building2 size={12} />{store.code}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            className="btn-press flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-brand-400"
          >
            {theme === 'dark' ? <Sun size={16} className="text-brand-500" /> : <Moon size={16} className="text-brand-500" />}
            <span className="sm:hidden lg:inline">{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* Kolom kiri: info akun + logout */}
        <div className="space-y-6 lg:col-span-2">
          <section className="anim-enter rounded-2xl border border-border bg-surface p-5 shadow-theme-xs lg:p-6" style={{ animationDelay: '60ms' }}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-dim">Info Akun</h2>
            <div className="divide-y divide-border/60">
              <InfoRow icon={<UserIcon size={16} />} label="Nama lengkap" value={user?.display_name || '-'} />
              <InfoRow icon={<AtSign size={16} />} label="Username" value={user?.username || '-'} mono />
              <InfoRow icon={<ShieldCheck size={16} />} label="Role" value={roleLabel} />
              {!isSuperAdmin && <InfoRow icon={<Building2 size={16} />} label="Resto" value={store ? `${store.code} — ${store.name}` : '-'} />}
            </div>
          </section>

          <button
            onClick={logout}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl border border-error-500/20 bg-error-500/10 py-3.5 text-sm font-semibold text-error-600 transition hover:bg-error-500/20 dark:text-error-400"
          >
            <LogOut size={16} />Logout
          </button>
        </div>

        {/* Kolom kanan: API keys */}
        <section className="anim-enter rounded-2xl border border-border bg-surface p-5 shadow-theme-xs lg:col-span-3 lg:p-6" style={{ animationDelay: '120ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <KeyRound size={16} />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-text-dim">API Keys</h2>
            </div>
            {keys !== null && (
              <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-bold tabular-nums text-text-muted">
                {keys.filter((k) => !k.revoked_at).length} aktif
              </span>
            )}
          </div>

          {error && <p className="mb-3 rounded-lg bg-error-500/10 px-3 py-2 text-xs font-medium text-error-600 dark:text-error-400">{error}</p>}

          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Nama key, mis. integrasi-kasir"
              className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-500"
            />
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-500"
            >
              <option value="7">7 hari</option>
              <option value="30">30 hari</option>
              <option value="90">90 hari</option>
              <option value="never">Tidak kadaluarsa</option>
            </select>
            <button
              type="button"
              disabled={!name.trim() || creating}
              onClick={() => void create()}
              className="btn-press inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              <Plus size={15} />{creating ? 'Membuat...' : 'Buat Key'}
            </button>
          </div>

          <div className="space-y-2.5">
            {keys === null ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-[76px] rounded-xl" />
              ))
            ) : keys.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-dim">
                Belum ada API key. Buat satu di atas buat mulai integrasi.
              </p>
            ) : keys.map((key) => {
              const st = keyStatus(key)
              return (
                <div key={key.id} className="rounded-xl border border-border bg-background p-3.5 transition hover:border-brand-500/30 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary">{key.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-text-muted">{key.key_masked}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-text-dim">
                        <span>{key.expires_at ? `Berakhir ${new Date(key.expires_at).toLocaleDateString('id-ID')}` : 'Tidak kadaluarsa'}</span>
                        <span>Dibuat {new Date(key.created_at).toLocaleDateString('id-ID')}</span>
                        <span>dipakai {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('id-ID') : 'belum pernah'}</span>
                      </div>
                    </div>
                    {!key.revoked_at && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Lihat key"
                          onClick={() => { setRevealId(key.id); setRawKey('') }}
                          className="btn-press rounded-lg p-2 text-text-muted transition hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-300"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          title="Cabut key"
                          onClick={() => void revoke(key.id)}
                          className="btn-press rounded-lg p-2 text-text-muted transition hover:bg-error-500/10 hover:text-error-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Dialog raw key / verifikasi */}
      {(rawKey || revealId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm" onClick={closeRawKey}>
          <div className="anim-enter w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-theme-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{rawKey ? 'Simpan API Key' : 'Verifikasi Password'}</h2>
              <button type="button" onClick={closeRawKey} className="rounded-lg p-1 text-text-muted hover:bg-surface-alt"><X size={18} /></button>
            </div>
            {rawKey ? (
              <>
                <p className="mb-2 text-xs font-medium text-warning-600 dark:text-warning-400">Ditampilkan hanya di dialog ini — salin sekarang.</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-surface-alt p-2.5 font-mono text-xs text-text-primary">{rawKey}</code>
                  <button type="button" title="Salin" onClick={() => void copy(rawKey)} className="btn-press shrink-0 rounded-xl border border-border p-2.5 text-text-muted hover:text-brand-500"><Copy size={16} /></button>
                </div>
              </>
            ) : (
              <>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void reveal() }}
                  placeholder="Password akun"
                  autoFocus
                  className="mb-3 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-500"
                />
                <button type="button" onClick={() => void reveal()} className="btn-press w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">Buka Key</button>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-text-dim">A Product By <strong className="text-text-muted">MarkoID</strong></p>
    </div>
  )
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">{label}</p>
        <p className={`mt-0.5 truncate text-sm font-medium text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
