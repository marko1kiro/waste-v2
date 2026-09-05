import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { apiClient } from '@/lib/api-client'
import { Copy, KeyRound, LogOut, Trash2, X, Sun, Moon } from 'lucide-react'

interface ApiKey {
  id: number
  name: string
  key_masked: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState('30')
  const [rawKey, setRawKey] = useState('')
  const [revealId, setRevealId] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : 'Store Admin'
  const roleEmoji = user?.role === 'super_admin' ? '👑' : '🏪'
  const loadKeys = () => apiClient.fetch<{ data: ApiKey[] }>('/api/admin/api-keys').then((data) => setKeys(data.data)).catch((err: Error) => setError(err.message))
  useEffect(() => { void loadKeys() }, [])
  const closeRawKey = () => { setRawKey(''); setPassword(''); setRevealId(null) }
  const copy = async (value: string) => { await navigator.clipboard.writeText(value) }
  const create = async () => {
    setError('')
    try {
      const data = await apiClient.fetch<{ rawKey: string }>('/api/admin/api-keys', { method: 'POST', body: JSON.stringify({ name, expiry }) })
      setRawKey(data.rawKey)
      setName('')
      await loadKeys()
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal membuat API key.') }
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

  return <div className="mx-auto max-w-md py-4">
    <div className="mb-6 flex flex-col items-center"><div className="mb-3 h-20 w-20 overflow-hidden rounded-full border-2 border-brand-500 shadow-theme-md"><img src="/logo.webp" alt="Avatar" width="80" height="80" className="h-full w-full object-cover" /></div><h1 className="text-lg font-semibold text-text-primary">{user?.display_name || user?.username}</h1><span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-[11px] font-semibold uppercase text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400"><span>{roleEmoji}</span>{roleLabel}</span></div>

    <button type="button" onClick={toggle} className="mb-4 flex w-full items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 shadow-theme-xs transition hover:bg-surface-alt">
      <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {theme === 'dark' ? <Sun size={16} className="text-brand-500" /> : <Moon size={16} className="text-brand-500" />}
        {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
      </span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${theme === 'dark' ? 'bg-brand-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${theme === 'dark' ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>

    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-theme-xs">
      <div className="grid gap-3"><Info label="👤 Username" value={user?.username} /><Info label="✨ Nama Lengkap" value={user?.display_name || '-'} /><Info label="🛡️ Role" value={roleLabel} /></div>
      <section className="border-t border-border pt-4"><div className="mb-3 flex items-center gap-2"><KeyRound size={16} className="text-brand-500" /><h2 className="text-sm font-semibold text-text-primary">API Keys</h2></div>{error && <p className="mb-2 text-xs text-error-600 dark:text-error-400">{error}</p>}<div className="mb-3 grid gap-2"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Nama key" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500" /><select value={expiry} onChange={(event) => setExpiry(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500"><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option><option value="never">Tidak kadaluarsa</option></select><button type="button" disabled={!name.trim()} onClick={() => void create()} className="rounded-lg bg-brand-500 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50">Buat API Key</button></div><div className="space-y-2">{keys.map((key) => <div key={key.id} className="rounded-lg border border-border bg-background p-3 text-xs"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-text-primary">{key.name}</p><p className="font-mono text-text-muted">{key.key_masked}</p><p className="mt-1 text-text-muted">{key.revoked_at ? 'Dicabut' : key.expires_at && new Date(key.expires_at) <= new Date() ? 'Kedaluwarsa' : key.expires_at ? `Berakhir ${new Date(key.expires_at).toLocaleDateString()}` : 'Tidak kadaluarsa'}</p><p className="text-text-muted">Dibuat: {new Date(key.created_at).toLocaleString()}</p><p className="text-text-muted">Terakhir dipakai: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Belum pernah'}</p></div><div className="flex gap-2">{!key.revoked_at && <><button type="button" onClick={() => { setRevealId(key.id); setRawKey('') }} className="text-brand-600 dark:text-brand-400">Lihat</button><button type="button" onClick={() => void revoke(key.id)} className="text-error-600 dark:text-error-400"><Trash2 size={15} /></button></>}</div></div></div>)}</div></section>
      <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-error-200 bg-error-50 py-3.5 text-sm font-semibold text-error-700 transition hover:bg-error-100 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"><LogOut size={16} />Logout</button>
    </div>
    {(rawKey || revealId !== null) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-theme-lg"><div className="mb-3 flex justify-between"><h2 className="font-semibold text-text-primary">{rawKey ? 'Simpan API Key' : 'Verifikasi Password'}</h2><button type="button" onClick={closeRawKey}><X size={18} /></button></div>{rawKey ? <><p className="mb-2 text-xs text-warning-600 dark:text-warning-400">Ditampilkan hanya di dialog ini.</p><div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-surface-alt p-2 text-xs text-text-primary">{rawKey}</code><button type="button" onClick={() => void copy(rawKey)}><Copy size={16} /></button></div></> : <><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500" /><button type="button" onClick={() => void reveal()} className="w-full rounded-lg bg-brand-500 py-2 font-medium text-white transition hover:bg-brand-600">Buka Key</button></>}</div></div>}
    <p className="mt-4 text-center text-[11px] text-text-muted">A Product By <strong className="text-text-primary">MarkoID</strong></p>
  </div>
}

function Info({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl border border-border bg-background px-4 py-3"><span className="text-[10px] font-semibold uppercase text-text-muted">{label}</span><p className="mt-0.5 text-sm font-medium text-text-primary">{value}</p></div> }
