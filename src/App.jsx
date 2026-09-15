import { useEffect, useMemo, useRef, useState } from 'react'
import { onValue, push, ref, runTransaction, set, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import L from 'leaflet'
import { auth, db, googleProvider, storage } from './firebase'
import { applyEntries, clamp, entryQty, mergeEntry, QTY_MAX, QTY_MIN, removeLastUpdater, sumQty } from './lib/qty'
import { DEMO, DEMO_USER, demoPlayers } from './lib/demo'
import { THEME_ICON, THEME_LABEL, useTheme } from './theme'
import PapelPicado from './components/PapelPicado'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = 'tacos'
const ADMIN_PW = 'ualumni'
const NOTES_MAX = 280
// Midnight ending Dec 9, 2026, Mountain time.
const LOCK = new Date('2026-12-10T00:00:00-07:00')
const FALL_EMOJIS = ['🌮', '🌮', '🌮', '🌮', '🌯', '🥑', '🌶️', '🧀', '🫓']
const CTRL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeName(raw) {
  return (raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(CTRL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

function sanitizeNotes(raw) {
  return (raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(CTRL_CHARS, '')
    .trim()
    .slice(0, NOTES_MAX)
}

function sanitizeLabel(raw) {
  return (raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(CTRL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function hashHue(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % 360
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return { d, h: pad(h), m: pad(m), s: pad(s % 60) }
}

function formatRelative(ts) {
  const now = Date.now()
  const min = Math.floor((now - ts) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = new Date(ts)
  const today = new Date()
  const diffDays = Math.round((new Date(today.toDateString()) - new Date(day.toDateString())) / 86400000)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return day.toLocaleDateString(undefined, { weekday: 'long' })
  if (day.getFullYear() === today.getFullYear()) return day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
  return day.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function flattenEntries(players) {
  const out = []
  for (const [key, p] of Object.entries(players || {})) {
    const entries = p?.entries || {}
    // qty is normalized here so every downstream read sees a real 1–20 integer
    // even for legacy entries that predate the field.
    for (const [id, e] of Object.entries(entries)) out.push({ ...e, qty: entryQty(e), id, playerKey: key, playerName: p.name, playerPhoto: p.photoURL || null })
  }
  return out
}

function isHomemade(loc) {
  return !!loc && loc.label === 'Homemade'
}

function distinctSpots(entries) {
  const set = new Set()
  for (const e of entries) if (e.location?.label && !isHomemade(e.location)) set.add(e.location.label)
  return set.size
}

function renderStarsText(rating) {
  if (rating == null) return 'unrated'
  const full = Math.floor(rating)
  const half = rating % 1 !== 0
  return '★'.repeat(full) + (half ? '½' : '') + ` (${rating})`
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function formatResultLabel(r) {
  const name = r.namedetails?.name || r.name || r.display_name.split(',')[0]
  const parts = r.display_name.split(',').map((s) => s.trim())
  const rest = parts[0] === name ? parts.slice(1) : parts
  const address = rest.slice(0, 2).join(', ')
  return address ? `${name} · ${address}` : name
}

function pct(n) {
  return `${Math.max(0, Math.min(100, n))}%`
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const BADGES = [
  { id: 'first-bite', emoji: '🥇', label: 'First Bite', hint: 'Log 1 taco', test: (s) => s.count >= 1 },
  { id: 'half-dozen', emoji: '🌮', label: 'Half Dozen', hint: 'Log 6 tacos', test: (s) => s.count >= 6 },
  { id: 'taco-royalty', emoji: '👑', label: 'Taco Royalty', hint: 'Log 25 tacos', test: (s) => s.count >= 25 },
  { id: 'goat', emoji: '🐐', label: 'GOAT', hint: 'Log 50 tacos', test: (s) => s.count >= 50 },
  { id: 'around-town', emoji: '✈️', label: 'Around Town', hint: 'Hit 5 different spots', test: (s) => s.spots >= 5 },
  { id: 'roadtrip', emoji: '🌎', label: 'Roadtrip', hint: 'Hit 10 different spots', test: (s) => s.spots >= 10 },
  { id: 'homebody', emoji: '🏠', label: 'Homebody', hint: 'Make 5 homemade tacos', test: (s) => s.homemade >= 5 },
  { id: 'five-star', emoji: '🌟', label: 'Five-Star Critic', hint: 'Rate a taco 5 stars', test: (s) => s.maxRating >= 5 },
  { id: 'brave-soul', emoji: '💀', label: 'Brave Soul', hint: 'Rate a taco ≤1 star', test: (s) => s.minRating !== null && s.minRating <= 1 },
  { id: 'discerning', emoji: '💎', label: 'Discerning Taste', hint: 'Average 4★+ over 3+ ratings', test: (s) => s.ratingCount >= 3 && s.avgRating >= 4 },
  { id: 'bullseye', emoji: '🎯', label: 'Bullseye', hint: '3 tacos plotted chic & gourmet', test: (s) => s.bullseye >= 3 },
  { id: 'storyteller', emoji: '📜', label: 'Storyteller', hint: '5 tacos with real notes', test: (s) => s.storyteller >= 5 },
]

// Takes { count, entries } where entries is a flattenEntries() ARRAY, not a
// player node's entries object.
// Badges worded "N tacos" sum qty; badges worded "N ratings" count entries,
// because a rating is one act of judgement no matter how many tacos it covers.
function computeStats(player) {
  const entries = player.entries || []
  const ratings = entries.map((e) => e.rating).filter((r) => r !== null && r !== undefined)
  return {
    count: player.count || 0,
    spots: distinctSpots(entries),
    homemade: sumQty(entries.filter((e) => isHomemade(e.location))),
    maxRating: ratings.length ? Math.max(...ratings) : 0,
    minRating: ratings.length ? Math.min(...ratings) : null,
    ratingCount: ratings.length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    bullseye: sumQty(entries.filter((e) => e.matrix && e.matrix.x > 0.3 && e.matrix.y > 0.3)),
    storyteller: sumQty(entries.filter((e) => e.notes && e.notes.trim().length >= 4)),
  }
}

function earnedBadges(player) {
  const stats = computeStats(player)
  return BADGES.filter((b) => b.test(stats))
}

// ---------------------------------------------------------------------------
// Firebase mutations — all count-changing writes go through runTransaction on
// the parent player node so concurrent devices can't clobber each other.
// ---------------------------------------------------------------------------

// Every count-changing write is "edit the entries map, then re-derive count".
// The math lives in lib/qty.js so it can be tested without Firebase.
async function withEntries(key, mutate) {
  await runTransaction(ref(db, `${ROOT}/${key}`), (cur) => applyEntries(cur, mutate))
}

async function logTacoWithId(key, id, entry) {
  await withEntries(key, (entries) => ({ ...entries, [id]: entry }))
}

async function deleteTaco(key, entryId) {
  await withEntries(key, (entries) => {
    delete entries[entryId]
    return entries
  })
}

// Editing `qty` changes the player's total, so this can no longer be a plain
// update() — it has to re-derive count like every other write.
async function editTaco(key, entryId, patch) {
  await withEntries(key, (entries) => mergeEntry(entries, entryId, patch))
}

async function removeLastTaco(key) {
  await runTransaction(ref(db, `${ROOT}/${key}`), removeLastUpdater)
}

function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compress failed'))), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

async function uploadTacoPhoto(key, entryId, file) {
  const blob = await compressImage(file)
  const path = `taco-photos/${key}/${entryId}.jpg`
  const sRef = storageRef(storage, path)
  await uploadBytes(sRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(sRef)
}

// ---------------------------------------------------------------------------
// Star components
// ---------------------------------------------------------------------------

function Star({ filled, half, size = 28 }) {
  return (
    <span className="star" style={{ position: 'relative', width: size, height: size, lineHeight: `${size}px`, fontSize: size }}>
      <span className="star__bg" style={{ position: 'absolute', inset: 0 }}>
        ★
      </span>
      {(filled || half) && (
        <span className="star__fill" style={{ position: 'absolute', inset: 0, clipPath: half ? 'inset(0 50% 0 0)' : 'inset(0 0 0 0)' }}>
          ★
        </span>
      )}
    </span>
  )
}

function StarRow({ rating, size = 16 }) {
  const r = rating || 0
  const stars = []
  for (let i = 1; i <= 5; i++) {
    const filled = r >= i
    const half = !filled && r >= i - 0.5
    stars.push(<Star key={i} filled={filled} half={half} size={size} />)
  }
  return <span className="star">{stars}</span>
}

function StarRating({ value, onChange, size = 32 }) {
  function tap(n) {
    if (value === n) onChange(n - 0.5)
    else onChange(n)
  }
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n
        const half = !filled && value >= n - 0.5
        return (
          <button
            key={n}
            type="button"
            onClick={() => tap(n)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label={`Rate ${n} stars`}
          >
            <Star filled={filled} half={half} size={size} />
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Location autocomplete (Nominatim, free, no key)
// ---------------------------------------------------------------------------

const NOMINATIM_AMENITY = ['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'food_court', 'biergarten', 'ice_cream', 'deli']
const NOMINATIM_SHOP = ['bakery', 'butcher', 'deli']

function useDebouncedNominatim(query, viewbox) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const q = (query || '').trim()
    const typing = q.length >= 2
    // Empty query but a location viewbox is set (user tapped "Near me") →
    // list nearby food spots so they can pick without typing.
    const nearby = !typing && !!viewbox
    if (!typing && !nearby) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ format: 'json', addressdetails: '1', namedetails: '1', limit: nearby ? '12' : '6' })
        params.set('q', typing ? q : 'restaurant')
        if (viewbox) {
          params.set('viewbox', viewbox)
          params.set('bounded', nearby ? '1' : '0')
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal: controller.signal })
        const data = await res.json()
        const filtered = (data || []).filter(
          (d) => (d.class === 'amenity' && NOMINATIM_AMENITY.includes(d.type)) || (d.class === 'shop' && NOMINATIM_SHOP.includes(d.type)),
        )
        if (!cancelled) setResults(filtered)
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, viewbox])
  return { results, loading }
}

function LocationInput({ value, onChange, priorLabels, near, onNearMe }) {
  const [query, setQuery] = useState(value?.label || '')
  const [open, setOpen] = useState(false)
  const { results, loading } = useDebouncedNominatim(query, near)
  const priorMatches = query.trim().length >= 1 ? priorLabels.filter((l) => l.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : []

  // When the user grants location via "Near me", reveal the nearby list.
  useEffect(() => {
    if (near) setOpen(true)
  }, [near])

  function selectPrior(label) {
    onChange({ label })
    setQuery(label)
    setOpen(false)
  }
  function selectResult(r) {
    const label = formatResultLabel(r)
    onChange({ label, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
    setQuery(label)
    setOpen(false)
  }
  function homemade() {
    onChange({ label: 'Homemade', lat: null, lng: null })
    setQuery('Homemade')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="Where'd you get it?"
        value={query}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          onChange(v ? { label: sanitizeLabel(v) } : null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (priorMatches.length > 0 || results.length > 0 || loading) && (
        <div className="autocomplete">
          {priorMatches.map((l) => (
            <div key={l} className="autocomplete__row" onMouseDown={() => selectPrior(l)}>
              🕑 {l}
            </div>
          ))}
          {results.map((r) => (
            <div key={r.place_id} className="autocomplete__row" onMouseDown={() => selectResult(r)}>
              🍽️ {formatResultLabel(r)}
            </div>
          ))}
          {loading && results.length === 0 && <div className="autocomplete__row autocomplete__row--muted">🔎 Finding spots near you…</div>}
        </div>
      )}
      <div className="row row--wrap" style={{ marginTop: 8, gap: 8 }}>
        <button type="button" className="chip-btn" onMouseDown={(e) => e.preventDefault()} onClick={homemade}>
          🏠 Homemade
        </button>
        <button type="button" className="chip-btn" onClick={onNearMe}>
          📍 Near me
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Matrix plot (chic/cheap × garbage/gourmet) — interactive in the modal,
// read-only in the Matrix tab.
// ---------------------------------------------------------------------------

function MatrixPlot({ value, onChange, points, size = 260 }) {
  const containerRef = useRef(null)

  function coordsFromEvent(e) {
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
      y: clamp(1 - ((clientY - rect.top) / rect.height) * 2, -1, 1),
    }
  }

  function handleDrag(e) {
    if (!onChange) return
    e.preventDefault()
    onChange(coordsFromEvent(e))
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onChange ? handleDrag : undefined}
      onTouchMove={onChange ? handleDrag : undefined}
      className="matrix"
      style={{ height: size }}
    >
      <div className="matrix__axis-h" />
      <div className="matrix__axis-v" />
      <div className="matrix__label matrix__label--top">chic ↑</div>
      <div className="matrix__label matrix__label--bottom">↓ cheap</div>
      <div className="matrix__label matrix__label--left">garbage ←</div>
      <div className="matrix__label matrix__label--right">→ gourmet ⭐</div>
      {points &&
        points.map((p, i) => (
          <span
            key={i}
            onClick={p.onClick}
            className={`matrix__pt${p.big ? ' matrix__pt--big' : ''}${p.onClick ? ' matrix__pt--clickable' : ''}`}
            style={{ '--matrix-x': pct(((p.x + 1) / 2) * 100), '--matrix-y': pct(((1 - p.y) / 2) * 100), '--pin-hue': String(p.hue) }}
          >
            🌮
          </span>
        ))}
      {value && (
        <span
          className="matrix__cursor"
          style={{ '--matrix-x': pct(((value.x + 1) / 2) * 100), '--matrix-y': pct(((1 - value.y) / 2) * 100) }}
        >
          🌮
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log a Taco modal (create + edit)
// ---------------------------------------------------------------------------

function LogModal({ mode, initial, onSubmit, onDelete, onCancel, priorLabels }) {
  const [rating, setRating] = useState(initial?.rating ?? null)
  const [qty, setQty] = useState(() => entryQty(initial))
  const [locationVal, setLocationVal] = useState(initial?.location ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [matrixOn, setMatrixOn] = useState(!!initial?.matrix)
  const [matrixVal, setMatrixVal] = useState(initial?.matrix ?? { x: 0, y: 0 })
  const [near, setNear] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(initial?.photoUrl || null)
  const [photoCleared, setPhotoCleared] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)

  function handleNearMe() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const d = 0.2
        setNear(`${longitude - d},${latitude - d},${longitude + d},${latitude + d}`)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoCleared(false)
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoCleared(true)
    if (cameraRef.current) cameraRef.current.value = ''
    if (libraryRef.current) libraryRef.current.value = ''
  }

  async function submit() {
    setSaving(true)
    try {
      await onSubmit(
        {
          rating,
          qty,
          location: locationVal,
          notes: sanitizeNotes(notes),
          matrix: matrixOn ? matrixVal : null,
          ...(mode === 'edit' ? { ts: initial.ts } : {}),
        },
        photoFile,
        photoCleared,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__handle" />
        <h2 className="modal__title">{mode === 'edit' ? 'Edit taco' : 'Log a taco'}</h2>
        <div className="t-sub">{mode === 'edit' ? 'Change anything you got wrong.' : 'Tally what you just ate.'}</div>

        <span className="field-label" id="qty-label">
          How many?
        </span>
        <div className="qty">
          <button
            type="button"
            className="btn qty__btn"
            onClick={() => setQty((q) => clamp(q - 1, QTY_MIN, QTY_MAX))}
            disabled={qty <= QTY_MIN}
            aria-label="One fewer taco"
          >
            −
          </button>
          <span className="qty__value" aria-live="polite" aria-labelledby="qty-label">
            {qty}
          </span>
          <button
            type="button"
            className="btn qty__btn"
            onClick={() => setQty((q) => clamp(q + 1, QTY_MIN, QTY_MAX))}
            disabled={qty >= QTY_MAX}
            aria-label="One more taco"
          >
            +
          </button>
          <span className="qty__unit">taco{qty === 1 ? '' : 's'} in this sitting</span>
        </div>

        <span className="field-label">Rating</span>
        <div className="row">
          <StarRating value={rating ?? 0} onChange={setRating} size={30} />
          {rating != null && (
            <button type="button" className="btn-link" onClick={() => setRating(null)}>
              clear
            </button>
          )}
        </div>

        <span className="field-label">Location</span>
        <LocationInput value={locationVal} onChange={setLocationVal} priorLabels={priorLabels} near={near} onNearMe={handleNearMe} />

        <span className="field-label">Photo</span>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden-file" tabIndex={-1} />
        <input ref={libraryRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden-file" tabIndex={-1} />
        {!photoPreview ? (
          <div className="photo-row">
            <button type="button" className="photo-btn" onClick={() => cameraRef.current?.click()}>
              📷 Take photo
            </button>
            <button type="button" className="photo-btn" onClick={() => libraryRef.current?.click()}>
              🖼️ Choose photo
            </button>
          </div>
        ) : (
          <div className="photo-frame">
            <img src={photoPreview} className="photo-frame__img" alt="" />
            <button type="button" className="photo-frame__remove" onClick={removePhoto} aria-label="Remove photo">
              ✕
            </button>
          </div>
        )}

        <label className="row" style={{ cursor: 'pointer', gap: 8, marginTop: 20, fontWeight: 600 }}>
          <input type="checkbox" checked={matrixOn} onChange={(e) => setMatrixOn(e.target.checked)} /> Plot it on the taste matrix
        </label>
        {matrixOn && <div style={{ marginTop: 10 }}>{<MatrixPlot value={matrixVal} onChange={setMatrixVal} size={240} />}</div>}

        <span className="field-label">
          Notes ({notes.length}/{NOTES_MAX})
        </span>
        <textarea
          className="textarea"
          value={notes}
          maxLength={NOTES_MAX}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="al pastor, no cilantro…"
        />

        <div className="modal__actions">
          <button className="btn btn--primary btn--lg" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : `Log ${qty} 🔥`}
          </button>
          <button className="btn btn--ghost btn--lg" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {mode === 'edit' && onDelete && (
          <div style={{ marginTop: 14 }}>
            {!confirmDelete ? (
              <button className="btn-link btn-link--danger" onClick={() => setConfirmDelete(true)}>
                Delete this taco
              </button>
            ) : (
              <span className="t-sub">
                Are you sure?{' '}
                <button className="btn-link btn-link--danger" onClick={onDelete}>
                  Yes, delete
                </button>{' '}
                <button className="btn-link" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------

function AdminModal({ total, onReset, onNuke, onClose }) {
  const [pw, setPw] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmNuke, setConfirmNuke] = useState(false)

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__handle" />
        <h2 className="modal__title">🔧 Admin</h2>
        {!unlocked ? (
          <>
            <input
              className="input"
              style={{ marginTop: 12 }}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pw === ADMIN_PW && setUnlocked(true)}
              placeholder="Password"
            />
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => pw === ADMIN_PW && setUnlocked(true)}>
              Unlock
            </button>
          </>
        ) : (
          <>
            <div className="t-sub" style={{ marginTop: 10 }}>
              {total} tacos logged across all players.
            </div>
            <div style={{ marginTop: 16 }}>
              {!confirmReset ? (
                <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
                  Reset all counts to zero
                </button>
              ) : (
                <span className="t-sub">
                  Sure?{' '}
                  <button className="btn-link btn-link--danger" onClick={onReset}>
                    Yes, reset
                  </button>{' '}
                  <button className="btn-link" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {!confirmNuke ? (
                <button className="btn btn--ghost" onClick={() => setConfirmNuke(true)}>
                  Remove all players &amp; counts
                </button>
              ) : (
                <span className="t-sub">
                  Sure?{' '}
                  <button className="btn-link btn-link--danger" onClick={onNuke}>
                    Yes, nuke everything
                  </button>{' '}
                  <button className="btn-link" onClick={() => setConfirmNuke(false)}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </>
        )}
        <div style={{ marginTop: 18 }}>
          <button className="btn btn--ghost btn--block" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ themePref, onCycleTheme, locked, msLeft, onAdminOpen, onInfoOpen }) {
  const { d, h, m, s } = splitTime(msLeft)
  return (
    <header className="header">
      <div className="header__inner">
        <div className="wordmark">
          <span className="wordmark__mark">🌮</span> Taco Fall
        </div>
        <div className="header__actions">
          <button className="btn btn--icon" onClick={onInfoOpen} aria-label="Rules &amp; info">
            ℹ️
          </button>
          <button className="btn btn--icon" onClick={onCycleTheme} aria-label={THEME_LABEL[themePref]} title={THEME_LABEL[themePref]}>
            {THEME_ICON[themePref]}
          </button>
          <button className="btn btn--icon" onClick={onAdminOpen} aria-label="Admin">
            🔧
          </button>
        </div>
      </div>
      {!locked ? (
        <div className="countdown">
          <span>🔥 Locks in</span>
          <span className="countdown__unit">{d}d</span>
          <span className="countdown__unit">
            {h}:{m}:{s}
          </span>
        </div>
      ) : (
        <div className="lock-banner">🔒 Counting closed — final tally</div>
      )}
      <PapelPicado />
    </header>
  )
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['count', '🌮', 'Count'],
    ['feed', '📱', 'Feed'],
    ['ranks', '🏆', 'Ranks'],
    ['explore', '🗺️', 'Explore'],
  ]
  return (
    <nav className="nav">
      {items.map(([id, icon, label]) => {
        const active = tab === id
        return (
          <button key={id} className="nav__item" data-active={active || undefined} onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}>
            <span className="nav__icon">{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Sign-in screen
// ---------------------------------------------------------------------------

function SignInScreen({ onSignIn, signingIn, error }) {
  return (
    <div className="sign-in">
      <PapelPicado variant="divider" />
      <div style={{ fontSize: 46 }}>🌮</div>
      <h1 className="sign-in__logo">Taco Fall</h1>
      <p className="t-sub" style={{ marginTop: 12 }}>
        A taco tally for the crew — sign in with Google to join.
      </p>
      <button className="google-btn" onClick={onSignIn} disabled={signingIn}>
        <span className="google-btn__g">G</span>
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && <div className="error-text">{error}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function CountTab({ me, myKey, myPlayer, photoURL, locked, rank, playerCount, crewTotal, onPlus, onMinus, onSignOut }) {
  const count = myPlayer?.count || 0
  const myEntries = myPlayer ? flattenEntries({ [myKey]: myPlayer }) : []
  const badges = earnedBadges({ count, entries: myEntries })
  const earnedIds = new Set(badges.map((b) => b.id))
  const nextBadge = BADGES.find((b) => !earnedIds.has(b.id))
  const lastTaco = myEntries.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]

  return (
    <div className="stack">
      <section className="card counter">
        <div className="account-row">
          <Avatar name={me} photoURL={photoURL} size={26} />
          <span className="t-sub">
            <strong>{me}</strong>
          </span>
          <button className="btn-link" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <div className="counter__value">{count}</div>
        <div className="counter__caption">taco{count === 1 ? '' : 's'} this season</div>

        <div className="counter__actions">
          <button className="btn qty__btn" onClick={onMinus} disabled={locked || count === 0} aria-label="Remove one taco">
            −
          </button>
          <button className="btn btn--primary btn--lg" onClick={onPlus} disabled={locked}>
            Log a taco 🌮
          </button>
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="stat__value">#{rank}</span>
            <span className="stat__label">of {playerCount}</span>
          </div>
          <div className="stat">
            <span className="stat__value">{lastTaco ? formatRelative(lastTaco.ts).replace(' ago', '') : '—'}</span>
            <span className="stat__label">since last</span>
          </div>
          <div className="stat">
            <span className="stat__value">{crewTotal}</span>
            <span className="stat__label">crew total</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card__title">Your badges</h3>
        {badges.length > 0 ? (
          <div className="row row--wrap" style={{ gap: 6 }}>
            {badges.map((b) => (
              <span key={b.id} className="badge-chip" title={b.hint}>
                {b.emoji} {b.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="t-sub">None yet — log your first taco to get started.</div>
        )}
        {nextBadge && (
          <div className="t-sub" style={{ marginTop: 12 }}>
            Next up: {nextBadge.emoji} <strong>{nextBadge.label}</strong> — {nextBadge.hint}
          </div>
        )}
      </section>
    </div>
  )
}

function BoardTab({ players, myKey, locked }) {
  const list = Object.entries(players)
    .map(([key, p]) => ({ key, name: p.name, count: p.count || 0, entries: flattenEntries({ [key]: p }) }))
    .sort((a, b) => b.count - a.count)
  const total = list.reduce((a, b) => a + b.count, 0)
  const top3 = list.slice(0, 3)
  const winner = list[0]
  const maxCount = list[0]?.count || 1

  return (
    <div className="ranks-split">
      <div>
        <div className="banner" data-locked={locked || undefined}>
          {locked ? (
            <>👑 {winner ? winner.name : 'Nobody'} wins with {winner ? winner.count : 0} 🌮</>
          ) : (
            <>
              <span className="banner__stat">{total}</span> tacos eaten by {list.length} player{list.length === 1 ? '' : 's'}
            </>
          )}
        </div>

        {top3.length > 0 && (
          <>
            <PapelPicado variant="divider" />
            <div className="podium">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((p) => {
                const rank = p === top3[0] ? 1 : p === top3[1] ? 2 : 3
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
                return (
                  <div key={p.key} className="podium__col" data-rank={rank}>
                    <div className="podium__person">
                      <span className="podium__figure">
                        <Avatar name={p.name} size={rank === 1 ? 46 : 38} />
                        <span className="podium__medal">{medal}</span>
                      </span>
                      <span className="podium__name" title={p.name}>
                        {p.name}
                      </span>
                      <span className="podium__count">{p.count} 🌮</span>
                    </div>
                    <div className="podium__pedestal">{rank}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((p, i) => (
          <div key={p.key} className="rank-row" data-mine={p.key === myKey || undefined}>
            <div className="rank-row__head">
              <span className="rank-row__pos">{i + 1}</span>
              <span className="rank-row__name" title={p.name}>
                {p.name}
              </span>
              <span className="rank-row__count">{p.count} 🌮</span>
            </div>
            <div className="bar">
              <div className="bar__fill" style={{ '--bar-pct': pct((p.count / maxCount) * 100) }} />
            </div>
            <div className="rank-row__badges">
              {earnedBadges({ count: p.count, entries: p.entries }).map((b) => (
                <span key={b.id} title={b.label}>
                  {b.emoji}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapTab({ entries }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: false }).setView([39.5, -98.35], 3)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ prefix: false }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      attribution: '© OSM © CARTO',
      maxZoom: 20,
    }).addTo(map)

    const pinned = entries.filter((e) => e.location && e.location.lat != null && e.location.lng != null)
    const bounds = []
    for (const e of pinned) {
      const hue = hashHue(e.playerName)
      // Leaflet writes this HTML itself, outside React, so the class has to be
      // global and the dynamic hue comes in as a custom property.
      const icon = L.divIcon({
        className: 'taco-pin',
        html: `<div style="--pin-hue:${hue};width:36px;height:44px;position:relative;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${hue},65%,38%));border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.35);"></div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;">🌮</div>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 40],
        popupAnchor: [0, -34],
      })
      const marker = L.marker([e.location.lat, e.location.lng], { icon }).addTo(map)
      marker.bindPopup(
        `<div style="font-family:Nunito,sans-serif;"><strong>${escapeHtml(e.playerName)}</strong><br/>${escapeHtml(renderStarsText(e.rating))}<br/>${escapeHtml(e.location.label || '')}${
          e.notes ? `<br/><em>${escapeHtml(e.notes)}</em>` : ''
        }${e.photoUrl ? `<br/><img src="${e.photoUrl}" style="width:100%;max-width:200px;border-radius:8px;margin-top:6px;" />` : ''}</div>`,
      )
      bounds.push([e.location.lat, e.location.lng])
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })

    return () => map.remove()
  }, [entries])

  const pinnedCount = entries.filter((e) => e.location && e.location.lat != null).length
  const homemadeCount = sumQty(entries.filter((e) => isHomemade(e.location)))

  return (
    <div>
      <p className="section-label">
        {pinnedCount} spots pinned · {homemadeCount} homemade 🏠
      </p>
      <div ref={containerRef} className="map" />
    </div>
  )
}

function MatrixTab({ entries, myKey }) {
  const [active, setActive] = useState(null)
  const points = entries
    .filter((e) => e.matrix)
    .map((e) => ({ x: e.matrix.x, y: e.matrix.y, hue: hashHue(e.playerName), big: e.playerKey === myKey, onClick: () => setActive(e) }))

  return (
    <div>
      <p className="section-label">Taste matrix · tap a taco for details</p>
      <div style={{ position: 'relative' }}>
        <MatrixPlot points={points} size={340} />
        {active && (
          <div className="matrix__active">
            <strong>{active.playerName}</strong>
            <div>{renderStarsText(active.rating)}</div>
            <div className="t-tiny">{active.location?.label || '—'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StarsTab({ entries, players, myKey }) {
  const rated = entries.filter((e) => e.rating != null)
  // Deliberately unweighted by qty: a rating is one act of judgement, so one
  // person logging 20 tacos at 5★ must not outvote twenty separate opinions.
  const avg = rated.length ? rated.reduce((a, b) => a + b.rating, 0) / rated.length : 0
  const bands = [5, 4, 3, 2, 1].map((n) => ({ n, count: rated.filter((e) => Math.ceil(e.rating) === n).length }))
  const top5 = [...rated].sort((a, b) => b.rating - a.rating).slice(0, 5)

  const perPlayer = Object.entries(players)
    .map(([key, p]) => {
      const es = Object.values(p.entries || {}).filter((e) => e.rating != null)
      if (es.length < 2) return null
      return { key, name: p.name, avg: es.reduce((a, b) => a + b.rating, 0) / es.length, count: es.length }
    })
    .filter(Boolean)
    .sort((a, b) => b.avg - a.avg)

  const myPlayer = myKey ? players[myKey] : null
  const myEntries = myPlayer ? flattenEntries({ [myKey]: myPlayer }) : []
  const badges = myPlayer ? earnedBadges({ count: myPlayer.count, entries: myEntries }) : []
  const earnedIds = new Set(badges.map((b) => b.id))

  return (
    <div className="stack">
      <div className="card">
        <h3 className="card__title">Crew average</h3>
        <div className="row" style={{ gap: 12 }}>
          <span className="t-num" style={{ fontSize: 40, color: 'var(--chili)' }}>
            {avg.toFixed(1)}
          </span>
          <div>
            <StarRow rating={avg} size={20} />
            <div className="t-sub">
              {rated.length} rating{rated.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          {bands.map((b) => (
            <div key={b.n} className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ width: 28 }}>{b.n}★</span>
              <div className="bar" style={{ flex: 1, marginTop: 0 }}>
                <div className="bar__fill" style={{ '--bar-pct': pct(rated.length ? (b.count / rated.length) * 100 : 0) }} />
              </div>
              <span className="t-sub" style={{ width: 24, textAlign: 'right' }}>
                {b.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Top tacos</h3>
        {top5.length === 0 && <div className="t-sub">No ratings yet.</div>}
        {top5.map((e) => (
          <div key={e.id} className="diary-row" data-mine={e.playerKey === myKey || undefined}>
            <div className="rank-row__head">
              <strong>
                {e.playerName}
                {e.qty > 1 && <span className="t-sub" style={{ marginLeft: 6 }}>×{e.qty}</span>}
              </strong>
              <StarRow rating={e.rating} size={14} />
            </div>
            <div className="t-sub">
              {isHomemade(e.location) ? '🏠' : '📍'} {e.location?.label || '—'}
            </div>
            {e.notes && <div style={{ fontStyle: 'italic', marginTop: 4 }}>{e.notes}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card__title">Your badges</h3>
        <div className="badge-grid">
          {BADGES.map((b) => (
            <div key={b.id} className="badge-cell" data-locked={!earnedIds.has(b.id) || undefined} title={b.hint}>
              <div className="badge-cell__emoji">{b.emoji}</div>
              <div className="badge-cell__label">{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Pickiest critics</h3>
        {perPlayer.length === 0 && <div className="t-sub">Not enough ratings yet.</div>}
        {perPlayer.map((p) => (
          <div key={p.key} className="critic-row">
            <span>{p.name}</span>
            <span className="t-sub">
              {p.avg.toFixed(1)}★ ({p.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const AVATAR_COLORS = ['var(--chili)', 'var(--talavera)', 'var(--cactus)', 'var(--rosa)', 'var(--marigold-deep)']

function Avatar({ name, photoURL, size = 38 }) {
  const style = { '--avatar-size': `${size}px`, '--avatar-color': AVATAR_COLORS[hashHue(name) % AVATAR_COLORS.length] }
  if (photoURL) {
    return <img src={photoURL} alt="" referrerPolicy="no-referrer" className="avatar" style={{ ...style, background: 'transparent' }} />
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="avatar" style={style} aria-hidden="true">
      {initial}
    </div>
  )
}

function PostHead({ e, mine, onEdit }) {
  return (
    <div className="post__head">
      <Avatar name={e.playerName} photoURL={e.playerPhoto} size={38} />
      <div className="post__ident">
        <div className="post__name">
          {e.playerName}
          {mine && <span className="post__sub"> · you</span>}
        </div>
        {e.location && (
          <div className="post__sub">
            {isHomemade(e.location) ? '🏠' : '📍'} {e.location.label}
          </div>
        )}
      </div>
      <div>
        <div className="post__time">{formatRelative(e.ts)}</div>
        {onEdit && (
          <button className="post__edit" onClick={() => onEdit(e)}>
            ✏️ edit
          </button>
        )}
      </div>
    </div>
  )
}

function PhotoPost({ e, mine, onEdit }) {
  return (
    <article className="post" data-mine={mine || undefined}>
      <PostHead e={e} mine={mine} onEdit={onEdit} />
      <img src={e.photoUrl} className="post__photo" alt="" loading="lazy" />
      <div className="post__body">
        {e.rating != null && (
          <div className="post__rating-row">
            <StarRow rating={e.rating} size={19} />
            <span className="post__sub">{e.rating}★</span>
          </div>
        )}
        {e.notes && (
          <div className="post__caption">
            <strong>{e.playerName}</strong> {e.notes}
          </div>
        )}
        {(e.qty > 1 || e.matrix) && (
          <div className="post__chips">
            {e.qty > 1 && <span className="chip chip--qty">×{e.qty} tacos</span>}
            {e.matrix && <span className="chip">🎯 plotted</span>}
          </div>
        )}
      </div>
    </article>
  )
}

function TextPost({ e, mine, onEdit }) {
  const hasText = e.notes && e.notes.trim().length > 0
  const untagged = e.rating == null && !e.location && !e.notes && !e.matrix
  return (
    <article className="post post--text" data-mine={mine || undefined} data-untagged={untagged || undefined}>
      <Avatar name={e.playerName} photoURL={e.playerPhoto} size={38} />
      <div className="post__ident">
        <div className="row" style={{ gap: 6 }}>
          <span className="post__name">{e.playerName}</span>
          {mine && <span className="post__sub">· you</span>}
          <span className="post__time" style={{ marginLeft: 'auto' }}>
            {formatRelative(e.ts)}
          </span>
          {onEdit && (
            <button className="post__edit" onClick={() => onEdit(e)}>
              ✏️
            </button>
          )}
        </div>
        {hasText ? (
          <div className="post__text">{e.notes}</div>
        ) : (
          <div className="post__text post__text--muted">logged {e.qty > 1 ? `${e.qty} tacos` : 'a taco'} 🌮</div>
        )}
        <div className="post__meta">
          {e.qty > 1 && <span className="chip chip--qty">×{e.qty}</span>}
          {e.rating != null ? <StarRow rating={e.rating} size={15} /> : <span>— unrated</span>}
          {e.location && (
            <span>
              {isHomemade(e.location) ? '🏠' : '📍'} {e.location.label}
            </span>
          )}
          {e.matrix && <span>🎯 plotted</span>}
        </div>
        {onEdit && untagged && <div className="untagged-hint">🔖 Untagged taco — tap ✏️ to add stars, place &amp; notes</div>}
      </div>
    </article>
  )
}

function FeedTab({ entries, myKey, locked, onEdit }) {
  const [scope, setScope] = useState('everyone')
  const sorted = useMemo(() => [...entries].sort((a, b) => (b.ts || 0) - (a.ts || 0)), [entries])
  const shown = scope === 'mine' ? sorted.filter((e) => e.playerKey === myKey) : sorted
  const shownQty = sumQty(shown)
  const canEdit = scope === 'mine' && !locked && myKey ? onEdit : null

  return (
    <div>
      <div className="seg">
        <button className="seg__btn" data-active={scope === 'everyone' || undefined} onClick={() => setScope('everyone')}>
          Everyone
        </button>
        <button className="seg__btn" data-active={scope === 'mine' || undefined} onClick={() => setScope('mine')}>
          Mine
        </button>
      </div>
      {shown.length === 0 ? (
        <div className="card empty">
          {scope === 'mine' ? 'No tacos logged yet — hit the 🌮 Count tab to start your diary.' : 'No tacos yet — post the first one from the Count tab. 🌮'}
        </div>
      ) : (
        <>
          <div className="feed-head">
            🌮 {shownQty} taco{shownQty === 1 ? '' : 's'} · {shown.length} post{shown.length === 1 ? '' : 's'} · freshest first
          </div>
          <div className="feed-wrap">
            {shown.map((e) => {
              const mine = e.playerKey === myKey
              return e.photoUrl ? (
                <PhotoPost key={e.id} e={e} mine={mine} onEdit={mine ? canEdit : null} />
              ) : (
                <TextPost key={e.id} e={e} mine={mine} onEdit={mine ? canEdit : null} />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ExploreTab({ entries, myKey }) {
  const [view, setView] = useState('map')
  return (
    <div>
      <div className="seg">
        <button className="seg__btn" data-active={view === 'map' || undefined} onClick={() => setView('map')}>
          🗺️ Map
        </button>
        <button className="seg__btn" data-active={view === 'matrix' || undefined} onClick={() => setView('matrix')}>
          📊 Matrix
        </button>
      </div>
      {view === 'map' ? <MapTab entries={entries} /> : <MatrixTab entries={entries} myKey={myKey} />}
    </div>
  )
}

function RanksTab({ players, entries, myKey, locked }) {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <BoardTab players={players} myKey={myKey} locked={locked} />
      <StarsTab entries={entries} players={players} myKey={myKey} />
    </div>
  )
}

function RulesModal({ onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__handle" />
        <h2 className="modal__title">🌮 The Rules</h2>
        <ul style={{ lineHeight: 1.9, paddingLeft: 20, margin: '12px 0 0' }}>
          <li>You must be able to pick it up — no forks.</li>
          <li>Taco salads, taco bowls, and burritos do not count.</li>
          <li>2 street-size tacos = 1 taco.</li>
          <li>Tostadas count if folded and eaten by hand.</li>
          <li>Any protein is fair game — traditional or fusion.</li>
          <li>Homemade tacos always count.</li>
          <li>Lettuce wrap instead of a tortilla is OK only if you're gluten-free.</li>
        </ul>
        <div style={{ marginTop: 20 }}>
          <button className="btn btn--ghost btn--block btn--lg" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const { pref: themePref, cycleTheme } = useTheme()
  const [user, setUser] = useState(undefined) // undefined = auth loading, null = signed out
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [players, setPlayers] = useState({})
  const [tab, setTab] = useState('count')
  const [now, setNow] = useState(Date.now())
  const [modal, setModal] = useState(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [rain, setRain] = useState([])

  useEffect(() => {
    if (DEMO) {
      setUser(DEMO_USER)
      return
    }
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  // Subscribe to the shared data only once signed in (keeps reads behind auth).
  useEffect(() => {
    if (DEMO) {
      setPlayers(demoPlayers())
      return
    }
    if (!user) {
      setPlayers({})
      return
    }
    return onValue(ref(db, ROOT), (snap) => setPlayers(snap.val() || {}))
  }, [user])

  // Keep the signed-in user's player node in sync with their Google profile.
  // Uses a transaction (reads the real server value) so it never clobbers
  // existing entries/count — a plain set() based on the local cache wiped
  // data when `players` was still empty on app reopen.
  useEffect(() => {
    if (!user || DEMO) return
    const name = sanitizeName(user.displayName) || 'Taco Fan'
    const photoURL = user.photoURL || null
    runTransaction(ref(db, `${ROOT}/${user.uid}`), (cur) => {
      if (!cur) return { name, photoURL, count: 0, entries: {} }
      cur.name = name
      cur.photoURL = photoURL
      return cur
    })
  }, [user])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const locked = now >= LOCK.getTime()
  const myKey = user ? user.uid : null
  const myPlayer = myKey ? players[myKey] : null
  const myName = user?.displayName || myPlayer?.name || 'Taco Fan'
  const allEntries = useMemo(() => flattenEntries(players), [players])
  const priorLabels = useMemo(() => {
    const set = new Set()
    for (const e of allEntries) if (e.location?.label && e.location.label !== 'Homemade') set.add(e.location.label)
    return Array.from(set)
  }, [allEntries])
  const total = Object.values(players).reduce((a, p) => a + (p.count || 0), 0)
  const myRank = useMemo(() => {
    const sorted = Object.entries(players).sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
    const i = sorted.findIndex(([key]) => key === myKey)
    return i < 0 ? sorted.length + 1 : i + 1
  }, [players, myKey])

  async function handleSignIn() {
    setSigningIn(true)
    setSignInError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setSignInError('Sign-in failed. Please try again.')
        console.error('Sign-in error', err)
      }
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    setTab('count')
  }

  function triggerRain() {
    const drops = Array.from({ length: 16 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      emoji: FALL_EMOJIS[Math.floor(Math.random() * FALL_EMOJIS.length)],
      left: Math.random() * 100,
      size: 20 + Math.random() * 18,
      duration: 2.2 + Math.random() * 1.6,
      sway: (Math.random() - 0.5) * 140,
      delay: Math.random() * 0.3,
    }))
    setRain(drops)
    setTimeout(() => setRain([]), 4800)
  }

  // In demo mode the same pure reducers run against local state instead of
  // Firebase, so the fixtures exercise the real counting math.
  function demoApply(updater) {
    setPlayers((prev) => ({ ...prev, [myKey]: updater(structuredClone(prev[myKey])) }))
  }

  async function handleMinus() {
    if (!myKey || locked) return
    if (DEMO) return demoApply(removeLastUpdater)
    await removeLastTaco(myKey)
  }

  async function handleCreateSubmit(draft, photoFile) {
    if (!myKey) return
    if (DEMO) {
      const id = `demo-${Date.now()}`
      demoApply((cur) => applyEntries(cur, (es) => ({ ...es, [id]: { ts: Date.now(), ...draft } })))
      setModal(null)
      triggerRain()
      return
    }
    const newId = push(ref(db, `${ROOT}/${myKey}/entries`)).key
    let photoUrl = null
    if (photoFile) {
      try {
        photoUrl = await uploadTacoPhoto(myKey, newId, photoFile)
      } catch (err) {
        console.error('Photo upload failed', err)
      }
    }
    await logTacoWithId(myKey, newId, { ts: Date.now(), ...draft, ...(photoUrl ? { photoUrl } : {}) })
    setModal(null)
    triggerRain()
  }

  async function handleEditSubmit(draft, photoFile, clearPhoto) {
    if (!myKey || !modal?.entry) return
    let photoUrl = modal.entry.photoUrl || null
    if (photoFile) {
      try {
        photoUrl = await uploadTacoPhoto(myKey, modal.entry.id, photoFile)
      } catch (err) {
        console.error('Photo upload failed', err)
      }
    } else if (clearPhoto) {
      photoUrl = null
    }
    // photoUrl of null deletes the field, so a removed photo actually clears.
    // Only ever pass `draft` here — modal.entry carries flattenEntries' synthetic
    // playerName/playerKey/id fields, which must never be written back to the DB.
    const id = modal.entry.id
    if (DEMO) demoApply((cur) => applyEntries(cur, (es) => mergeEntry(es, id, { ...draft, photoUrl })))
    else await editTaco(myKey, id, { ...draft, photoUrl })
    setModal(null)
  }

  async function handleDeleteEntry() {
    if (!myKey || !modal?.entry) return
    const id = modal.entry.id
    if (DEMO) {
      demoApply((cur) =>
        applyEntries(cur, (es) => {
          delete es[id]
          return es
        }),
      )
    } else {
      await deleteTaco(myKey, id)
    }
    setModal(null)
  }

  async function handleAdminReset() {
    const updates = {}
    for (const key of Object.keys(players)) {
      updates[`${ROOT}/${key}/count`] = 0
      updates[`${ROOT}/${key}/entries`] = null
    }
    await update(ref(db), updates)
  }

  async function handleAdminNuke() {
    await set(ref(db, ROOT), null)
    // The signed-in admin's node is re-created fresh by the profile-sync effect.
  }

  return (
    <div className="page">
      {rain.map((r) => (
        <span
          key={r.id}
          className="bfall-emoji"
          style={{ left: `${r.left}%`, fontSize: r.size, animationDuration: `${r.duration}s`, animationDelay: `${r.delay}s`, '--sway': `${r.sway}px` }}
        >
          {r.emoji}
        </span>
      ))}

      {user === undefined ? (
        <div className="sign-in">
          <div style={{ fontSize: 46 }}>🌮</div>
          <h1 className="sign-in__logo">Taco Fall</h1>
          <div className="t-sub" style={{ marginTop: 12 }}>
            Loading…
          </div>
        </div>
      ) : !user ? (
        <SignInScreen onSignIn={handleSignIn} signingIn={signingIn} error={signInError} />
      ) : (
        <>
          <Header
            themePref={themePref}
            onCycleTheme={cycleTheme}
            locked={locked}
            msLeft={LOCK.getTime() - now}
            onAdminOpen={() => setAdminOpen(true)}
            onInfoOpen={() => setInfoOpen(true)}
          />
          <main className="content">
            {tab === 'count' && (
              <CountTab
                me={myName}
                myKey={myKey}
                myPlayer={myPlayer}
                photoURL={user.photoURL}
                locked={locked}
                rank={myRank}
                playerCount={Object.keys(players).length}
                crewTotal={total}
                onPlus={() => !locked && setModal({ mode: 'create' })}
                onMinus={handleMinus}
                onSignOut={handleSignOut}
              />
            )}
            {tab === 'feed' && <FeedTab entries={allEntries} myKey={myKey} locked={locked} onEdit={(entry) => setModal({ mode: 'edit', entry })} />}
            {tab === 'ranks' && <RanksTab players={players} entries={allEntries} myKey={myKey} locked={locked} />}
            {tab === 'explore' && <ExploreTab entries={allEntries} myKey={myKey} />}
          </main>
          <BottomNav tab={tab} setTab={setTab} />
        </>
      )}

      {modal && (
        <LogModal
          mode={modal.mode}
          initial={modal.entry}
          onSubmit={modal.mode === 'edit' ? handleEditSubmit : handleCreateSubmit}
          onDelete={modal.mode === 'edit' ? handleDeleteEntry : null}
          onCancel={() => setModal(null)}
          priorLabels={priorLabels}
        />
      )}

      {adminOpen && <AdminModal total={total} onReset={handleAdminReset} onNuke={handleAdminNuke} onClose={() => setAdminOpen(false)} />}

      {infoOpen && <RulesModal onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
