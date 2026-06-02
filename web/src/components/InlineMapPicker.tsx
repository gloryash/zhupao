import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLng } from '../types/location'
import { addBaseTileLayer } from '../lib/mapTiles'

/** Fallback centre (People's Square, Shanghai) when no value/geolocation. */
const DEFAULT_CENTER: LatLng = { latitude: 31.2304, longitude: 121.4737 }

/**
 * Inline "tap the map to choose a point" picker built on Leaflet. It never
 * exposes raw latitude / longitude — it just reports the tapped coordinate via
 * {@link onPick}; the caller reverse-geocodes it into an address. A single pin
 * marks the current selection. The map is rendered inline (below an input),
 * never as an overlay.
 */
export function InlineMapPicker({
  value,
  center,
  onPick,
  height = 200,
  busy = false
}: {
  /** Currently selected point, shown as a pin. */
  value: LatLng | null
  /** Initial centre when nothing is selected yet. */
  center?: LatLng | null
  onPick: (latitude: number, longitude: number) => void
  height?: number
  /** Dim + block interaction while the tapped point is being resolved. */
  busy?: boolean
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  // Initialise once. Click handler reads the latest onPick via the ref.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false
    })
    addBaseTileLayer(map)
    const initial = value ?? center ?? DEFAULT_CENTER
    map.setView([initial.latitude, initial.longitude], value ? 16 : 13)
    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickRef.current(e.latlng.lat, e.latlng.lng)
    })
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 120)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect the selected point as a pin and recentre on it.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }
    if (value) {
      markerRef.current = L.marker([value.latitude, value.longitude], {
        icon: pinIcon,
        keyboard: false,
        title: '所选位置'
      }).addTo(map)
      map.setView([value.latitude, value.longitude], Math.max(map.getZoom(), 15), { animate: true })
    }
  }, [value?.latitude, value?.longitude])

  return (
    <div className="map-pick" data-busy={busy || undefined}>
      <div className="map-pick__canvas" style={{ height }} ref={elRef} role="application" aria-label="点击地图选择位置" />
      {busy && (
        <div className="map-pick__veil" aria-hidden>
          <span className="spinner" />
        </div>
      )}
    </div>
  )
}

const pinIcon = L.divIcon({
  className: 'route-mk',
  html: '<span class="map-pick__pin" aria-hidden></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 24]
})
