import type { LatLng } from '../types/location'
import type { Order, OrderEndpoint } from '../types'

/** Geometry + address extraction for an order, tolerating the several shapes
 *  the backend uses (structured origin/destination, flat *Latitude fields, and
 *  the legacy single latitude/longitude/address). */

function point(lat: unknown, lng: unknown): LatLng | null {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

function endpointPoint(e?: OrderEndpoint): LatLng | null {
  if (!e) return null
  return point(e.latitude, e.longitude)
}

export function orderStart(order: Order): LatLng | null {
  return (
    endpointPoint(order.origin) ??
    point(order.originLatitude, order.originLongitude) ??
    point(order.latitude, order.longitude)
  )
}

export function orderDestination(order: Order): LatLng | null {
  return endpointPoint(order.destination) ?? point(order.destinationLatitude, order.destinationLongitude)
}

export function orderRunnerPoint(order: Order): LatLng | null {
  return point(order.runnerLatitude, order.runnerLongitude) ?? orderStart(order)
}

export function orderVolunteerPoint(order: Order): LatLng | null {
  return point(order.volunteerLat, order.volunteerLng)
}

export function startAddress(order: Order): string {
  return order.origin?.address || order.originAddress || order.address || ''
}

export function destinationAddress(order: Order): string {
  return order.destination?.address || order.destinationAddress || ''
}
