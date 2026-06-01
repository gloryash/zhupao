import type { AddressSearchResult, GeoAddress, SelectedLocation } from '../types/location'
import { isValidLatLng } from '../types/location'

/** Browser geolocation, wrapped as a promise with a friendly Chinese error. */
export function getCurrentPosition(timeoutMs = 10_000): Promise<SelectedLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        resolve({
          latitude: round6(latitude),
          longitude: round6(longitude),
          address: '',
          source: 'geolocation'
        })
      },
      (err) => {
        const messages: Record<number, string> = {
          1: '定位权限被拒绝，请手动选择位置',
          2: '暂时无法获取位置，请手动选择',
          3: '定位超时，请手动选择位置'
        }
        reject(new Error(messages[err.code] || '定位失败，请手动选择位置'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    )
  })
}

/** Best-effort reverse geocode via OpenStreetMap Nominatim (no API key). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  if (!isValidLatLng(latitude, longitude)) return ''
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN&zoom=18`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return ''
    const data = (await res.json()) as { display_name?: string }
    return data.display_name || ''
  } catch {
    return ''
  }
}

export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/**
 * Reverse geocode a coordinate (from a map tap) into a {@link GeoAddress}. The
 * human-readable `address` comes from Nominatim's `display_name`; `city` is the
 * best Nominatim candidate, falling back to {@link inferCity} on the address
 * text so it lines up with the backend's city filter. Failures resolve to a
 * blank-address GeoAddress rather than throwing so the picker stays usable.
 */
export async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<GeoAddress> {
  const fallback: GeoAddress = { latitude: round6(latitude), longitude: round6(longitude), address: '', city: '' }
  if (!isValidLatLng(latitude, longitude)) return fallback
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}` +
      `&accept-language=zh-CN&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return fallback
    const data = (await res.json()) as NominatimResult
    const address = data.display_name || ''
    return { ...fallback, address, city: pickCity(data.address) || inferCity(address) }
  } catch {
    return fallback
  }
}

/** Known prefecture cities, matching handleOrder's `inferCity`. Returns the
 *  city with a "市" suffix (e.g. "上海市") or "" when none is recognised. */
export function inferCity(address: string): string {
  if (!address) return ''
  const known = [
    '上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆',
    '武汉', '西安', '天津', '宁波', '厦门', '青岛', '济南', '长沙', '郑州'
  ]
  const found = known.find((city) => address.includes(city))
  return found ? `${found}市` : ''
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/** Nominatim address-detail shape we read for the city field. */
interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  municipality?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name?: string
  name?: string
  address?: NominatimAddress
}

/** Pull the best "city" candidate out of a Nominatim address block. */
function pickCity(addr?: NominatimAddress): string {
  if (!addr) return ''
  return addr.city || addr.municipality || addr.town || addr.county || addr.state || addr.village || ''
}

/**
 * Fuzzy address search via OpenStreetMap Nominatim (no API key). Accepts free
 * text — district names, landmarks, partial streets — and returns up to eight
 * candidates with coordinates, a short display name and a city. Network/parse
 * failures resolve to an empty list so callers can show "no results" cleanly.
 */
export async function searchAddress(query: string): Promise<AddressSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}` +
      `&accept-language=zh-CN&limit=8&addressdetails=1&countrycodes=cn`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = (await res.json()) as NominatimResult[]
    if (!Array.isArray(data)) return []
    return data
      .map((item): AddressSearchResult | null => {
        const latitude = round6(Number(item.lat))
        const longitude = round6(Number(item.lon))
        if (!isValidLatLng(latitude, longitude)) return null
        const detail = item.display_name || ''
        const name = (item.name && item.name.trim()) || detail.split(',')[0]?.trim() || detail
        return { latitude, longitude, address: detail || name, city: pickCity(item.address), name, detail }
      })
      .filter((r): r is AddressSearchResult => r !== null)
  } catch {
    return []
  }
}

/** Straight-line (great-circle) distance in kilometres, rounded to 2 dp. */
export function straightLineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!isValidLatLng(lat1, lng1) || !isValidLatLng(lat2, lng2)) return 0
  const R = 6371 // km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 100) / 100
}
