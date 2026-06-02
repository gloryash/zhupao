import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Crosshair, MapPin, Pencil } from 'lucide-react'
import type { SelectedLocation } from '../types/location'
import { isValidLatLng } from '../types/location'
import { getCurrentPosition, reverseGeocode, round6 } from '../services/location'
import { addBaseTileLayer } from '../lib/mapTiles'

const DEFAULT_CENTER: [number, number] = [39.9042, 116.4074] // Beijing
const DEFAULT_ZOOM = 14

const pinIcon = L.divIcon({
  className: 'locpick__pin-icon',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#ff9d12;border:2.5px solid #1c1813;transform:rotate(-45deg);box-shadow:0 4px 8px rgba(0,0,0,0.3)"><div style="position:absolute;top:7px;left:7px;width:8px;height:8px;border-radius:50%;background:#1c1813"></div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26]
})

export function LocationPicker({
  value,
  onChange
}: {
  value: SelectedLocation | null
  onChange: (loc: SelectedLocation) => void
}) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const manualRef = useRef<HTMLDivElement>(null)
  const latInputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [latText, setLatText] = useState(value ? String(value.latitude) : '')
  const [lngText, setLngText] = useState(value ? String(value.longitude) : '')

  // Initialise the Leaflet map once.
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const start: [number, number] = value
      ? [value.latitude, value.longitude]
      : DEFAULT_CENTER
    const map = L.map(mapElRef.current, {
      center: start,
      zoom: value ? 16 : DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true
    })
    addBaseTileLayer(map, true)

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const lat = round6(e.latlng.lat)
      const lng = round6(e.latlng.lng)
      placeMarker(lat, lng)
      const address = await reverseGeocode(lat, lng)
      onChangeRef.current({ latitude: lat, longitude: lng, address, source: 'map-click' })
    })

    mapRef.current = map
    if (value) placeMarker(value.latitude, value.longitude)

    // Map needs a resize tick once the container has its final size.
    setTimeout(() => map.invalidateSize(), 120)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect externally-set values (geolocation / manual) on the map.
  useEffect(() => {
    if (!value) return
    setLatText(String(value.latitude))
    setLngText(String(value.longitude))
    placeMarker(value.latitude, value.longitude)
    mapRef.current?.setView([value.latitude, value.longitude], 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.latitude, value?.longitude])

  // When the manual coordinate panel opens, bring it (and its 应用坐标 button)
  // fully into the scroll viewport so it isn't left clipped behind the bottom
  // nav / home indicator, then focus the latitude input. The page scrolls
  // inside .app__content (DeviceFrame preview and bare mobile alike), so we
  // scroll that container directly — window-level scrollIntoView misbehaves
  // under the preview frame's transform: scale().
  useEffect(() => {
    if (!manualOpen) return
    const raf = requestAnimationFrame(() => {
      const panel = manualRef.current
      const scroller = panel?.closest('.app__content') as HTMLElement | null
      if (panel && scroller) {
        const overflow = panel.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom
        if (overflow > 0) scroller.scrollBy({ top: overflow + 8, behavior: 'smooth' })
      } else {
        panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
      latInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [manualOpen])

  function placeMarker(lat: number, lng: number) {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, keyboard: false }).addTo(map)
    }
  }

  async function useMyLocation() {
    setLocating(true)
    setGeoError('')
    try {
      const loc = await getCurrentPosition()
      const address = await reverseGeocode(loc.latitude, loc.longitude)
      onChangeRef.current({ ...loc, address })
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : '定位失败')
    } finally {
      setLocating(false)
    }
  }

  function applyManual() {
    const lat = round6(Number(latText))
    const lng = round6(Number(lngText))
    if (!isValidLatLng(lat, lng)) {
      setGeoError('请输入有效的经纬度')
      return
    }
    setGeoError('')
    onChangeRef.current({
      latitude: lat,
      longitude: lng,
      address: value?.address || '',
      source: 'manual'
    })
  }

  return (
    <div className="locpick">
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          style={{ border: '1.5px solid var(--line)', flex: 1 }}
          onClick={useMyLocation}
          disabled={locating}
        >
          <Crosshair size={15} />
          {locating ? '定位中…' : '使用当前位置'}
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          style={{ border: '1.5px solid var(--line)' }}
          onClick={() => setManualOpen((v) => !v)}
          aria-expanded={manualOpen}
        >
          <Pencil size={15} />
          手动输入
        </button>
      </div>

      <div className="locpick__map" ref={mapElRef} role="application" aria-label="地图选点，点击地图选择位置" />
      <p className="locpick__hint">在地图上点击放置定位点，或使用上方按钮定位 / 手动输入坐标。</p>

      {manualOpen && (
        <div ref={manualRef} className="stack stack--sm" style={{ background: 'var(--paper-2)', padding: 12, borderRadius: 'var(--r-md)' }}>
          <div className="locpick__coords">
            <div className="field">
              <label className="field__label" htmlFor="lp-lat">
                纬度 Lat
              </label>
              <input
                id="lp-lat"
                ref={latInputRef}
                className="input"
                inputMode="decimal"
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                placeholder="39.9042"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="lp-lng">
                经度 Lng
              </label>
              <input
                id="lp-lng"
                className="input"
                inputMode="decimal"
                value={lngText}
                onChange={(e) => setLngText(e.target.value)}
                placeholder="116.4074"
              />
            </div>
          </div>
          <button type="button" className="btn btn--sm btn--block" onClick={applyManual}>
            应用坐标
          </button>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="lp-address">
          地址说明（可选）
        </label>
        <input
          id="lp-address"
          className="input"
          value={value?.address || ''}
          placeholder="例如：奥林匹克森林公园南门"
          onChange={(e) => {
            if (!value) return
            onChangeRef.current({ ...value, address: e.target.value })
          }}
          disabled={!value}
        />
      </div>

      {geoError && <p className="field__error">{geoError}</p>}

      {value && (
        <div className="locpick__readout">
          <MapPin size={15} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {value.address ? `${value.address} · ` : ''}
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            <span className="faint"> （{sourceLabel(value.source)}）</span>
          </span>
        </div>
      )}
    </div>
  )
}

function sourceLabel(source: SelectedLocation['source']): string {
  if (source === 'geolocation') return '当前定位'
  if (source === 'map-click') return '地图选点'
  return '手动输入'
}
