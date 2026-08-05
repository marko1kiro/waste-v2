export interface SignaturePersonnel {
  id: number
  name: string
  full_name: string
  signature_url: string
}

export interface SignatureResolution {
  kind: 'exact' | 'prefix' | 'fallback'
  url: string
  candidates: string[]
}

export function normalizeSignatureName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

function displayName(person: SignaturePersonnel): string {
  return person.full_name || person.name
}

function candidateNames(person: SignaturePersonnel): string[] {
  return [...new Set([person.full_name, person.name].filter(Boolean).map(normalizeSignatureName))]
}

function match(name: string, people: SignaturePersonnel[]): SignaturePersonnel[] {
  const normalized = normalizeSignatureName(name)
  return people.filter((person) => candidateNames(person).includes(normalized))
}

export function resolveSignature(name: string, people: SignaturePersonnel[]): SignatureResolution {
  const exact = match(name, people)
  if (exact.length === 1) return { kind: 'exact', url: exact[0].signature_url, candidates: [displayName(exact[0])] }
  if (exact.length > 1) return { kind: 'fallback', url: '', candidates: exact.map(displayName) }
  const tokens = normalizeSignatureName(name).split(' ').filter(Boolean)
  const prefix = people.filter((person) => candidateNames(person).some((name) => {
    const candidate = name.split(' ')
    return tokens.length <= candidate.length && tokens.every((token, index) => token === candidate[index])
  }))
  return prefix.length === 1
    ? { kind: 'prefix', url: prefix[0].signature_url, candidates: [displayName(prefix[0])] }
    : { kind: 'fallback', url: '', candidates: prefix.map(displayName) }
}

export function resolvePdfSignatures<T extends { parafQC: string; parafQCName: string; parafManager: string; parafManagerName: string }>(grouped: Record<string, T[]>, people: SignaturePersonnel[]) {
  const stats = { exact: [] as string[], prefix: [] as string[], fallback: [] as string[] }
  for (const items of Object.values(grouped)) for (const item of items) {
    for (const [urlKey, nameKey] of [['parafQC', 'parafQCName'], ['parafManager', 'parafManagerName']] as const) {
      if (item[urlKey] || !item[nameKey]) continue
      const resolved = resolveSignature(item[nameKey], people)
      if (resolved.kind === 'fallback') {
        stats.fallback.push(item[nameKey])
        if (resolved.candidates.length > 1) console.warn('[generate-pdf] Ambiguous signature name:', item[nameKey], resolved.candidates)
      } else {
        item[urlKey] = resolved.url
        stats[resolved.kind].push(item[nameKey])
      }
    }
  }
  return stats
}
