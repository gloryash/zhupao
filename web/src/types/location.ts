export interface SelectedLocation {
  latitude: number
  longitude: number
  address: string
  source: 'geolocation' | 'map-click' | 'manual'
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}
