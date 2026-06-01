export interface SelectedLocation {
  latitude: number
  longitude: number
  address: string
  source: 'geolocation' | 'map-click' | 'manual'
}

/** A bare coordinate pair used by the route map and distance maths. */
export interface LatLng {
  latitude: number
  longitude: number
}

/** A resolved address used across the order flow. `address` is the human
 *  readable label shown to the user; `city` feeds the backend's city filter. */
export interface GeoAddress {
  latitude: number
  longitude: number
  address: string
  city: string
}

/** One row in an address-search result list. Extends {@link GeoAddress} with a
 *  short primary `name` and the fuller `detail` line for display. */
export interface AddressSearchResult extends GeoAddress {
  name: string
  detail: string
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
