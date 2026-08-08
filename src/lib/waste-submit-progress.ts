export interface WasteSubmitProgressInput { completed: number; total: number }

export function getWasteSubmitProgress({ completed, total }: WasteSubmitProgressInput) {
  const percent = total > 0 ? Math.min(100, Math.round((Math.max(0, completed) / total) * 100)) : 0
  return { percent, text: `${percent}%` }
}

export function formatWasteSubmitElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
