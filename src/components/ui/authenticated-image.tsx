import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface AuthenticatedImageProps {
  src: string
  alt: string
  className?: string
}

export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    let active = true
    let url = ''
    async function load() {
      const response = await fetch(src, { headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` } })
      if (!response.ok) return
      url = URL.createObjectURL(await response.blob())
      if (active) setObjectUrl(url)
    }
    void load()
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [src])

  return objectUrl ? <img src={objectUrl} alt={alt} className={className} /> : null
}
