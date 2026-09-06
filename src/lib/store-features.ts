export interface StoreFeatures {
  manual_mode: boolean
  catalog: boolean
}

export type StoreInfo = {
  features: Partial<StoreFeatures> | null
} | null

export function pasteOnly(store: StoreInfo): boolean {
  const features = store?.features
  if (!features) return false
  return features.manual_mode === false && features.catalog === false
}

export function canManual(store: StoreInfo): boolean {
  if (!store) return false
  return store.features?.manual_mode !== false
}

export function hasCatalog(store: StoreInfo): boolean {
  if (!store) return true
  return store.features?.catalog !== false
}

export type WasteStep = 'paste' | 'config'

export function initialWasteStep(pasteModeRoute: boolean, store: StoreInfo): WasteStep {
  if (pasteModeRoute) return 'paste'
  return canManual(store) ? 'config' : 'paste'
}
