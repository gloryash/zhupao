import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Map as MapIcon, MapPin, Pencil, Search, X } from 'lucide-react'
import type { AddressSearchResult, GeoAddress, LatLng } from '../types/location'
import { reverseGeocodeAddress, searchAddress } from '../services/location'
import { loadAddressHistory, pushAddressHistory } from '../services/addressHistory'
import { formatAddressOptionLabel } from '../lib/addressLabels'
import { speakVoiceCue } from '../lib/voiceCue'
import { InlineMapPicker } from './InlineMapPicker'
import { Sheet, Spinner } from './ui'

type Mode = 'search' | 'map'

/**
 * Accessible address picker for one endpoint (start or destination), with two
 * modes the user toggles between:
 *
 * - **search** — free-text fuzzy search (district / landmark / street) with a
 *   results list and a localStorage history of previously used addresses.
 * - **map** — an inline Leaflet map (rendered below the field, never as an
 *   overlay); tapping it reverse-geocodes the point into an address.
 *
 * No latitude / longitude is ever exposed — selection yields a {@link GeoAddress}.
 */
export function AddressSearchField({
  field,
  label,
  placeholder,
  tone = 'start',
  value,
  onChange,
  mapCenter
}: {
  /** localStorage history bucket key, e.g. "start" / "destination". */
  field: string
  label: string
  placeholder: string
  tone?: 'start' | 'destination'
  value: GeoAddress | null
  onChange: (value: GeoAddress | null) => void
  /** Where the map opens when nothing is selected (e.g. the user's position). */
  mapCenter?: LatLng | null
}) {
  const listboxId = useId()
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressSearchResult[]>([])
  const [history, setHistory] = useState<GeoAddress[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [picking, setPicking] = useState(false)
  const [pinned, setPinned] = useState<LatLng | null>(null)
  const [pendingMapAddress, setPendingMapAddress] = useState<GeoAddress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHistory(loadAddressHistory(field))
  }, [field])

  // Debounced fuzzy search; a request token guards against out-of-order results.
  useEffect(() => {
    if (mode !== 'search') return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      setSearching(false)
      return
    }
    let active = true
    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await searchAddress(q)
      if (!active) return
      setResults(found)
      setSearched(true)
      setSearching(false)
    }, 420)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, mode])

  function select(entry: GeoAddress) {
    const stored: GeoAddress = {
      latitude: entry.latitude,
      longitude: entry.longitude,
      address: entry.address,
      city: entry.city
    }
    onChange(stored)
    setHistory(pushAddressHistory(field, stored))
    setQuery('')
    setResults([])
    setSearched(false)
    setPinned(null)
    setPendingMapAddress(null)
  }

  // Map tap → reverse geocode → speak + ask for confirmation before selecting.
  async function pick(latitude: number, longitude: number) {
    setPinned({ latitude, longitude })
    setPicking(true)
    try {
      const resolved = await reverseGeocodeAddress(latitude, longitude)
      const pending: GeoAddress = {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        address: resolved.address || '地图所选位置',
        city: resolved.city
      }
      speakVoiceCue(`已识别地址：${pending.address}。是否选择该地址？`)
      setPendingMapAddress(pending)
    } finally {
      setPicking(false)
    }
  }

  function confirmPendingMapAddress() {
    if (!pendingMapAddress) return
    select(pendingMapAddress)
  }

  function cancelPendingMapAddress() {
    setPendingMapAddress(null)
    setPinned(null)
  }

  function clearSelection() {
    onChange(null)
    setQuery('')
    setResults([])
    setSearched(false)
    setPinned(null)
    setPendingMapAddress(null)
    if (mode === 'search') requestAnimationFrame(() => inputRef.current?.focus())
  }

  function switchMode(next: Mode) {
    setMode(next)
    setPendingMapAddress(null)
    if (next === 'search') setPinned(null)
  }

  if (value) {
    return (
      <div className="field">
        <span className="field__label">
          <span className={`addr-dot addr-dot--${tone}`} aria-hidden /> {label}
        </span>
        <div className="addr-chosen">
          <MapPin size={16} aria-hidden />
          <span className="addr-chosen__text">
            {value.address}
            {value.city ? <span className="faint"> · {value.city}</span> : null}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm addr-chosen__change"
            onClick={clearSelection}
          >
            <Pencil size={14} /> 更改
          </button>
        </div>
      </div>
    )
  }

  const showHistory = mode === 'search' && query.trim().length < 2 && history.length > 0

  return (
    <div className="field addr-search">
      <div className="addr-search__head">
        <label className="field__label" htmlFor={`${listboxId}-input`}>
          <span className={`addr-dot addr-dot--${tone}`} aria-hidden /> {label}
        </label>
        <div className="seg seg--mini" role="group" aria-label={`${label}选择方式`}>
          <button
            type="button"
            aria-pressed={mode === 'search'}
            onClick={() => switchMode('search')}
          >
            <Search size={13} /> 搜索
          </button>
          <button
            type="button"
            aria-pressed={mode === 'map'}
            onClick={() => switchMode('map')}
          >
            <MapIcon size={13} /> 地图
          </button>
        </div>
      </div>

      {mode === 'search' ? (
        <>
          <div className="input-group" role="search">
            <Search size={17} aria-hidden style={{ color: 'var(--ink-faint)', flex: 'none' }} />
            <input
              id={`${listboxId}-input`}
              ref={inputRef}
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />
            {searching ? (
              <Spinner />
            ) : query ? (
              <button
                type="button"
                className="addr-search__clear"
                aria-label="清除搜索"
                onClick={() => setQuery('')}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          {showHistory && (
            <ul className="addr-list" id={listboxId} role="listbox" aria-label={`${label}历史记录`}>
              <li className="addr-list__caption" role="presentation">
                <Clock3 size={12} aria-hidden /> 最近使用
              </li>
              {history.map((h, i) => (
                <li key={`${h.address}-${i}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="addr-list__item"
                    aria-label={formatAddressOptionLabel(shortName(h.address), h.address)}
                    onClick={() => select(h)}
                  >
                    <MapPin size={15} aria-hidden />
                    <span className="addr-list__body">
                      <span className="addr-list__name">{shortName(h.address)}</span>
                      <span className="addr-list__detail">{h.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!showHistory && results.length > 0 && (
            <ul className="addr-list" id={listboxId} role="listbox" aria-label={`${label}搜索结果`}>
              {results.map((r, i) => (
                <li key={`${r.detail}-${i}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="addr-list__item"
                    aria-label={formatAddressOptionLabel(r.name, r.detail)}
                    onClick={() => select(r)}
                  >
                    <MapPin size={15} aria-hidden />
                    <span className="addr-list__body">
                      <span className="addr-list__name">{r.name}</span>
                      <span className="addr-list__detail">{r.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="field__hint" aria-live="polite">
            {searching
              ? '正在搜索…'
              : !showHistory && searched && results.length === 0
                ? '没有找到匹配的地点，换个关键词试试。'
                : '输入小区、地标或街道名称，从下方结果中选择。'}
          </p>
        </>
      ) : (
        <>
          <InlineMapPicker value={pinned} center={mapCenter} onPick={pick} busy={picking} />
          <p className="field__hint" aria-live="polite">
            {picking
              ? '正在解析所选位置…'
              : pendingMapAddress
                ? `已识别：${pendingMapAddress.address}`
                : '在地图上点击你想要的位置，我们会自动识别地址。'}
          </p>
          {pendingMapAddress && (
            <Sheet title="是否选择该地址" onClose={cancelPendingMapAddress}>
              <div className="map-confirm">
                <div className="map-confirm__addr">
                  <MapPin size={18} aria-hidden />
                  <span>
                    {pendingMapAddress.address}
                    {pendingMapAddress.city ? <small>{pendingMapAddress.city}</small> : null}
                  </span>
                </div>
                <div className="map-confirm__actions">
                  <button
                    type="button"
                    className="btn btn--accent btn--block"
                    onClick={confirmPendingMapAddress}
                  >
                    <CheckCircle2 size={18} /> 确认
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--block"
                    onClick={cancelPendingMapAddress}
                  >
                    <X size={18} /> 取消
                  </button>
                </div>
              </div>
            </Sheet>
          )}
        </>
      )}
    </div>
  )
}

function shortName(address: string): string {
  return address.split(',')[0]?.trim() || address
}
