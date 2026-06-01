import type { GeoAddress } from '../types/location'

/**
 * Per-field address history kept in localStorage so the runner can re-pick a
 * previously used start / destination address without searching again. Each
 * field (start, destination) gets its own key; entries are de-duplicated by
 * address text and capped at {@link MAX_ENTRIES}, most-recent first.
 */

const PREFIX = 'blindrun:addr-history:'
const MAX_ENTRIES = 8

function storageKey(field: string): string {
  return `${PREFIX}${field}`
}

export function loadAddressHistory(field: string): GeoAddress[] {
  try {
    const raw = localStorage.getItem(storageKey(field))
    if (!raw) return []
    const parsed = JSON.parse(raw) as GeoAddress[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e) => e && typeof e.latitude === 'number' && typeof e.longitude === 'number' && Boolean(e.address)
    )
  } catch {
    return []
  }
}

export function pushAddressHistory(field: string, entry: GeoAddress): GeoAddress[] {
  const existing = loadAddressHistory(field).filter((e) => e.address !== entry.address)
  const next = [entry, ...existing].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(storageKey(field), JSON.stringify(next))
  } catch {
    /* storage may be unavailable (private mode / quota); non-fatal */
  }
  return next
}
