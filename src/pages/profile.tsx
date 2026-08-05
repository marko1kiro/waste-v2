import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { Copy, KeyRound, LogOut, Trash2, X } from 'lucide-react'

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

  return <div className="mx-auto max-w-md py-4 font-[Nunito,system-ui,sans-serif]">
    <div className="mb-6 flex flex-col items-center"><div className="profile-avatar mb-3"><img src="/logo.webp" alt="Avatar" width="80" height="80" /></div><h1 className="text-lg font-extrabold text-text-primary">{user?.display_name || user?.username}</h1><span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#B388FF]/30 bg-gradient-to-r from-[#7C4DFF]/20 to-[#B388FF]/20 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B388FF]"><span>{roleEmoji}</span>{roleLabel}</span></div>
    <div className="space-y-4 rounded-2xl border-2 border-border bg-[#111] p-5 shadow-nb-md">
      <div className="grid gap-3"><Info label="👤 Username" value={user?.username} /><Info label="✨ Nama Lengkap" value={user?.display_name || '-'} /><Info label="🛡️ Role" value={roleLabel} /></div>
      <section className="border-t border-border pt-4"><div className="mb-3 flex items-center gap-2"><KeyRound size={16} className="text-warning" /><h2 className="text-sm font-extrabold text-text-primary">API Keys</h2></div>{error && <p className="mb-2 text-xs text-danger">{error}</p>}<div className="mb-3 grid gap-2"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Nama key" className="rounded-lg border border-border bg-[#0a0a0a] px-3 py-2 text-sm text-text-primary" /><select value={expiry} onChange={(event) => setExpiry(event.target.value)} className="rounded-lg border border-border bg-[#0a0a0a] px-3 py-2 text-sm text-text-primary"><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option><option value="never">Tidak kadaluarsa</option></select><button type="button" disabled={!name.trim()} onClick={() => void create()} className="rounded-lg border-2 border-[#000] bg-warning py-2 text-sm font-extrabold text-black disabled:opacity-50">Buat API Key</button></div><div className="space-y-2">{keys.map((key) => <div key={key.id} className="rounded-lg border border-border bg-[#0a0a0a] p-3 text-xs"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-text-primary">{key.name}</p><p className="font-mono text-text-muted">{key.key_masked}</p><p className="mt-1 text-text-muted">{key.revoked_at ? 'Dicabut' : key.expires_at && new Date(key.expires_at) <= new Date() ? 'Kedaluwarsa' : key.expires_at ? `Berakhir ${new Date(key.expires_at).toLocaleDateString()}` : 'Tidak kadaluarsa'}</p><p className="text-text-muted">Dibuat: {new Date(key.created_at).toLocaleString()}</p><p className="text-text-muted">Terakhir dipakai: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Belum pernah'}</p></div><div className="flex gap-2">{!key.revoked_at && <><button type="button" onClick={() => { setRevealId(key.id); setRawKey('') }} className="text-warning">Lihat</button><button type="button" onClick={() => void revoke(key.id)} className="text-danger"><Trash2 size={15} /></button></>}</div></div></div>)}</div></section>
      <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-danger bg-danger/10 py-3.5 text-sm font-extrabold text-danger transition-all hover:bg-danger hover:text-white active:scale-[0.98]"><LogOut size={16} />Logout</button>
    </div>
    {(rawKey || revealId !== null) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-xl border-2 border-border bg-[#111] p-4"><div className="mb-3 flex justify-between"><h2 className="font-extrabold text-text-primary">{rawKey ? 'Simpan API Key' : 'Verifikasi Password'}</h2><button type="button" onClick={closeRawKey}><X size={18} /></button></div>{rawKey ? <><p className="mb-2 text-xs text-warning">Ditampilkan hanya di dialog ini.</p><div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-[#0a0a0a] p-2 text-xs text-text-primary">{rawKey}</code><button type="button" onClick={() => void copy(rawKey)}><Copy size={16} /></button></div></> : <><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="mb-3 w-full rounded-lg border border-border bg-[#0a0a0a] px-3 py-2 text-sm text-text-primary" /><button type="button" onClick={() => void reveal()} className="w-full rounded-lg bg-warning py-2 font-extrabold text-black">Buka Key</button></>}</div></div>}
    <p className="mt-4 text-center text-[11px] font-semibold text-[#555]">A Product By <strong className="text-text-primary">MarkoID</strong></p>
  </div>
}

function Info({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl border border-[#222] bg-[#0a0a0a] px-4 py-3"><span className="text-[10px] font-extrabold uppercase tracking-widest text-[#666]">{label}</span><p className="mt-0.5 text-sm font-bold text-text-primary">{value}</p></div> }
