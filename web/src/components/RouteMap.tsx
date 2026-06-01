import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLng } from '../types/location'

export type { LatLng }

/**
 * Leaflet route visualization for the volunteer's accepted runs, in the warm
 * paper/beacon palette.
 *
 * - `pickup`: a solid green path from the volunteer's (simulated) position to
 *   the green start dot, with a walking icon marking the volunteer.
 * - `running`: the green start dot and red destination dot joined by a
 *   blue/dark route line.
 */
export function RouteMap({
  phase,
  start,
  destination,
  volunteer,
  height = 200
}: {
  phase: 'pickup' | 'running'
  start: LatLng | null
  destination?: LatLng | null
  volunteer?: LatLng | null
  height?: number
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Initialise the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    map.setView([31.2304, 121.4737], 13)
    setTimeout(() => map.invalidateSize(), 120)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // Redraw markers + route whenever the geometry or phase changes.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const points: L.LatLngExpression[] = []
    const startLL = start ? ([start.latitude, start.longitude] as [number, number]) : null
    const destLL = destination ? ([destination.latitude, destination.longitude] as [number, number]) : null
    const volLL = volunteer ? ([volunteer.latitude, volunteer.longitude] as [number, number]) : null

    if (phase === 'pickup') {
      if (volLL && startLL) {
        L.polyline([volLL, startLL], { color: '#1c7d63', weight: 5, opacity: 0.9, lineCap: 'round' }).addTo(layer)
      }
      if (volLL) {
        L.marker(volLL, { icon: walkerIcon, keyboard: false, title: '志愿者位置' }).addTo(layer)
        points.push(volLL)
      }
      if (startLL) {
        L.marker(startLL, { icon: startIcon, keyboard: false, title: '起跑点' }).addTo(layer)
        points.push(startLL)
      }
    } else {
      if (startLL && destLL) {
        L.polyline([startLL, destLL], { color: '#27496b', weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(layer)
      }
      if (startLL) {
        L.marker(startLL, { icon: startIcon, keyboard: false, title: '起跑点' }).addTo(layer)
        points.push(startLL)
      }
      if (destLL) {
        L.marker(destLL, { icon: destIcon, keyboard: false, title: '终点' }).addTo(layer)
        points.push(destLL)
      }
    }

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points).pad(0.35), { animate: false })
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: false })
    }
    setTimeout(() => map.invalidateSize(), 80)
  }, [
    phase,
    start?.latitude,
    start?.longitude,
    destination?.latitude,
    destination?.longitude,
    volunteer?.latitude,
    volunteer?.longitude
  ])

  return <div className="route-map" style={{ height }} ref={elRef} role="img" aria-label="陪跑路线地图" />
}

/* -------- marker icons (divIcon HTML, warm-paper palette) ----------------- */

const startIcon = L.divIcon({
  className: 'route-mk',
  html: '<span class="route-dot route-dot--start" aria-hidden></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

const destIcon = L.divIcon({
  className: 'route-mk',
  html: '<span class="route-dot route-dot--dest" aria-hidden></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

const walkerIcon = L.divIcon({
  className: 'route-mk',
  html:
    '<span class="route-walker" aria-hidden>' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/>' +
    '<path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>' +
    '<path d="M16 17h4"/><path d="M4 13h4"/>' +
    '</svg></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17]
})
