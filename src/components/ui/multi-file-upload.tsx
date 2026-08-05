import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface MultiFileUploadProps {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
}

const MAX_FILE_KB = 500

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= MAX_FILE_KB * 1024) return file

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.48,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.82,
    alwaysKeepResolution: false,
  })

  return new File([compressed], file.name, {
    type: compressed.type || file.type,
    lastModified: Date.now(),
  })
}

function formatKb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`
}

export default function MultiFileUpload({ files, onChange, maxFiles = 10 }: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [statusText, setStatusText] = useState('')

  async function handleFiles(list: FileList | null) {
    if (!list) return

    const incoming = Array.from(list)
      .filter((f) => ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(f.type))
      .slice(0, maxFiles - files.length)

    if (incoming.length === 0) return

    setCompressing(true)
    try {
      const next: File[] = []
      for (const file of incoming) {
        const compressed = await compressImage(file)
        next.push(compressed)
        if (compressed.size < file.size) {
          setStatusText(`${file.name}: ${formatKb(file.size)} → ${formatKb(compressed.size)}`)
        }
      }
      onChange([...files, ...next].slice(0, maxFiles))
    } finally {
      setCompressing(false)
      setTimeout(() => setStatusText(''), 2500)
    }
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={compressing}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#333] bg-[#0d0d0d] px-4 py-6 text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload size={20} />
        <span className="text-sm font-bold">Upload Foto</span>
        <span className="text-[11px]">JPG / PNG / WEBP • max {maxFiles} file • target &lt; 500KB</span>
        {compressing && <span className="text-[11px] text-warning">Lagi kompres gambar...</span>}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {statusText && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {statusText}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {files.map((file, index) => {
            const url = URL.createObjectURL(file)
            return (
              <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border-2 border-border bg-[#111] p-2 shadow-nb-sm">
                <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#0d0d0d]">
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute right-3 top-3 rounded-full bg-black/70 p-1 text-white"
                >
                  <X size={12} />
                </button>
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <ImageIcon size={10} />
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="mt-1 text-[10px] text-text-dim">{formatKb(file.size)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
