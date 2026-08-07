import { useEffect, useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { compressionSteps, isWithinPhotoLimit } from '@/lib/photo-compression'

interface MultiFileUploadProps { files: File[]; onChange: (files: File[]) => void; maxFiles?: number }

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} bukan gambar yang didukung.`)
  const bitmap = await createBitmap(file)
  try {
    for (const step of compressionSteps(bitmap.width, bitmap.height)) {
      const canvas = document.createElement('canvas')
      canvas.width = step.width; canvas.height = step.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error(`Browser tidak mendukung kompresi ${file.name}.`)
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const output = await canvasBlob(canvas, 'image/jpeg', step.quality)
      if (output && isWithinPhotoLimit(output.size)) return new File([output], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    }
  } finally { if ('close' in bitmap) bitmap.close() }
  throw new Error(`${file.name} tidak dapat dikompres hingga 500 KB.`)
}
async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  const image = new Image(); const url = URL.createObjectURL(file)
  try { await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Gambar ${file.name} tidak dapat dibaca.`)); image.src = url }); return image } finally { URL.revokeObjectURL(url) }
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) { return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality)) }
function formatKb(bytes: number) { return `${Math.round(bytes / 1024)} KB` }

export default function MultiFileUpload({ files, onChange, maxFiles = 10 }: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const urls = useRef<string[]>([])
  const [compressing, setCompressing] = useState(false); const [statusText, setStatusText] = useState(''); const [error, setError] = useState(''); const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => { urls.current.forEach(URL.revokeObjectURL); urls.current = files.map((file) => URL.createObjectURL(file)); setPreviews(urls.current); return () => { urls.current.forEach(URL.revokeObjectURL); urls.current = [] } }, [files])
  async function handleFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list).slice(0, maxFiles - files.length); if (!incoming.length) return
    setCompressing(true); setError('')
    try { const results = await Promise.allSettled(incoming.map(compressImage)); const accepted = results.filter((result): result is PromiseFulfilledResult<File> => result.status === 'fulfilled').map((result) => result.value); const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason instanceof Error ? result.reason.message : 'Gagal memproses foto.'); if (accepted.length) onChange([...files, ...accepted].slice(0, maxFiles)); setStatusText(accepted.length ? 'Foto valid dikompres dan siap disimpan offline.' : ''); setError(errors.join(' ')) } finally { setCompressing(false); if (inputRef.current) inputRef.current.value = '' }
  }
  return <div className="space-y-3"><button type="button" onClick={() => inputRef.current?.click()} disabled={compressing} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#333] bg-[#0d0d0d] px-4 py-6 text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Upload size={20} /><span className="text-sm font-bold">Upload Foto</span><span className="text-[11px]">JPG / PNG / WEBP • max {maxFiles} file • target ≤500 KB/foto</span>{compressing && <span className="text-[11px] text-warning">Lagi kompres gambar...</span>}</button><input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />{statusText && <div role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{statusText}</div>}{error && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}{files.length > 0 && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{files.map((file, index) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border-2 border-border bg-[#111] p-2 shadow-nb-sm"><div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#0d0d0d]"><img src={previews[index]} alt={file.name} className="h-full w-full object-cover" /></div><button type="button" aria-label={`Hapus ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))} className="absolute right-3 top-3 rounded-full bg-black/70 p-1 text-white"><X size={12} /></button><div className="flex items-center gap-1 text-[10px] text-text-muted"><ImageIcon size={10} /><span className="truncate">{file.name}</span></div><div className="mt-1 text-[10px] text-text-dim">{formatKb(file.size)}</div></div>)}</div>}</div>
}
