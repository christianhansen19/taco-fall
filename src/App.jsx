import { useEffect, useMemo, useRef, useState } from 'react'
import { onValue, push, ref, runTransaction, set, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import L from 'leaflet'
import { db, storage } from './firebase'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = 'tacos'
const MAX_P = 30
const ME_KEY = 'tacoName_v1'
const THEME_KEY = 'tacoTheme_v1'
const ADMIN_PW = 'ualumni'
const NOTES_MAX = 280
// Midnight ending Dec 9, 2026, Mountain time.
const LOCK = new Date('2026-12-10T00:00:00-07:00')
const FALL_EMOJIS = ['🌮', '🌮', '🌮', '🌮', '🌯', '🥑', '🌶️', '🧀', '🫓']
const CTRL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')

// ---------------------------------------------------------------------------
// Theme tokens — every color in the app routes through `th`, never hardcoded.
// ---------------------------------------------------------------------------

const LT = {
  bg: '#F1EAD7',
  card: '#FFFFFF',
  cardSoft: '#FBF4E6',
  text: '#2E272A',
  subt: '#7A6F6A',
  line: '#E4D7BE',
  salsa: '#AA182B',
  salsaD: '#B2123C',
  masa: '#D9A15C',
  cilantro: '#9FC14F',
  cilantroSoft: '#BED38E',
  tortilla: '#8D3F2D',
  tabInactive: '#8B7F78',
  shadow: 'rgba(46,39,42,0.12)',
  gold: '#D9A15C',
  silver: '#C9C2B8',
  bronze: '#8D3F2D',
  glow1: 'rgba(170,24,43,0.12)',
  glow2: 'rgba(159,193,79,0.12)',
}

const DT = {
  bg: '#2E272A',
  card: '#3A3235',
  cardSoft: '#443A3D',
  text: '#F1EAD7',
  subt: '#C9BBA8',
  line: '#4F4448',
  salsa: '#D93A5A',
  salsaD: '#B2123C',
  masa: '#E0B876',
  cilantro: '#AFCB68',
  cilantroSoft: '#BED38E',
  tortilla: '#B2664B',
  tabInactive: '#8F8385',
  shadow: 'rgba(0,0,0,0.4)',
  gold: '#E0B876',
  silver: '#8F8385',
  bronze: '#B2664B',
  glow1: 'rgba(217,58,90,0.18)',
  glow2: 'rgba(175,203,104,0.15)',
}

function styles(th) {
  return {
    page: { minHeight: '100vh', background: th.bg, color: th.text, fontFamily: 'Nunito, sans-serif', paddingBottom: 40 },
    header: { position: 'sticky', top: 0, zIndex: 10, background: th.bg, borderBottom: `1px solid ${th.line}`, padding: '12px 16px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontFamily: 'Rye, serif', fontSize: 20, color: th.salsa },
    iconBtn: { background: th.cardSoft, border: `1px solid ${th.line}`, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 16 },
    countdownBar: { marginTop: 8, fontSize: 13, color: th.subt, textAlign: 'center' },
    lockBanner: { marginTop: 8, background: th.salsa, color: '#fff', textAlign: 'center', borderRadius: 10, padding: '6px 10px', fontWeight: 700 },
    tabs: { display: 'flex', gap: 6, overflowX: 'auto', marginTop: 10, paddingBottom: 4 },
    tab: (active) => ({
      flex: '0 0 auto',
      padding: '8px 14px',
      borderRadius: 999,
      border: `1px solid ${active ? th.salsa : th.line}`,
      background: active ? th.salsa : th.cardSoft,
      color: active ? '#fff' : th.tabInactive,
      fontWeight: 700,
      cursor: 'pointer',
      fontSize: 13,
    }),
    card: { background: th.card, border: `1px solid ${th.line}`, borderRadius: 16, padding: 16, boxShadow: `0 4px 14px ${th.shadow}` },
    cardTitle: { fontFamily: 'Rye, serif', fontSize: 15, marginBottom: 10, color: th.text },
    sectionHeader: { fontFamily: 'Rye, serif', fontSize: 14, marginBottom: 10, color: th.text },
    subt: { color: th.subt, fontSize: 13 },
    bigNumber: { fontFamily: 'Rye, serif', fontSize: 40, color: th.salsa },
    bigCount: { fontFamily: 'Rye, serif', fontSize: 72, color: th.salsa, margin: '12px 0' },
    countBtn: { border: `1px solid ${th.line}`, background: th.cardSoft, color: th.text, borderRadius: 16, padding: '14px 24px', fontSize: 20, fontWeight: 800, cursor: 'pointer' },
    countBtnPrimary: { background: th.salsa, color: '#fff', border: 'none' },
    badgeChip: { background: th.cardSoft, border: `1px solid ${th.line}`, borderRadius: 999, padding: '4px 10px', fontSize: 12 },
    badgeCell: { background: th.cardSoft, border: `1px solid ${th.line}`, borderRadius: 12, padding: 10, textAlign: 'center' },
    input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${th.line}`, background: th.card, color: th.text, fontSize: 15, marginTop: 4 },
    textarea: { width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 10, border: `1px solid ${th.line}`, background: th.card, color: th.text, fontSize: 14, marginTop: 4, resize: 'vertical' },
    primaryBtn: { background: th.salsa, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
    ghostBtn: { background: 'transparent', color: th.text, border: `1px solid ${th.line}`, borderRadius: 12, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
    ghostBtnSm: { background: 'transparent', color: th.salsa, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
    chipBtn: { background: th.cardSoft, color: th.text, border: `1px solid ${th.line}`, borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', marginTop: 8 },
    linkBtn: { background: 'none', border: 'none', color: th.subt, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 },
    linkBtnDanger: { background: 'none', border: 'none', color: th.salsaD, cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'underline', padding: 0 },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 },
    modalCard: { background: th.card, color: th.text, borderRadius: '20px 20px 0 0', padding: '14px 20px calc(20px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
    sheetHandle: { width: 40, height: 5, borderRadius: 3, background: th.line, margin: '0 auto 12px' },
    modalTitle: { fontFamily: 'Rye, serif', fontSize: 18, marginBottom: 14 },
    photoBtnRow: { display: 'flex', gap: 10 },
    photoBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, background: th.cardSoft, color: th.text, border: `1px dashed ${th.line}`, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    photoFrame: { position: 'relative', marginTop: 4 },
    photoImg: { width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12, display: 'block' },
    photoRemove: { position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
    hiddenFile: { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
    fieldLabel: { fontWeight: 700, fontSize: 13, marginTop: 14, marginBottom: 4, color: th.subt },
    autocompleteBox: { position: 'absolute', top: '100%', left: 0, right: 0, background: th.card, border: `1px solid ${th.line}`, borderRadius: 10, marginTop: 4, zIndex: 20, maxHeight: 200, overflowY: 'auto' },
    autocompleteRow: { padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${th.line}` },
    matrixBox: { position: 'relative', width: '100%', background: th.cardSoft, border: `1px solid ${th.line}`, borderRadius: 16, touchAction: 'none', userSelect: 'none' },
    matrixAxisLabelTop: { position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: th.subt },
    matrixAxisLabelBottom: { position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: th.subt },
    matrixAxisLabelLeft: { position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: th.subt },
    matrixAxisLabelRight: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: th.subt },
    matrixActiveCard: { position: 'absolute', left: 8, bottom: 8, background: th.card, border: `1px solid ${th.line}`, borderRadius: 10, padding: 8, fontSize: 12 },
    matrixChip: { display: 'inline-block', marginTop: 4, fontSize: 11, background: th.cardSoft, borderRadius: 999, padding: '2px 8px' },
    diaryRow: { background: th.card, border: `1px solid ${th.line}`, borderRadius: 14, padding: 12 },
    untaggedHint: { marginTop: 6, fontSize: 12, color: th.subt },
    photoThumb: { width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, margin: '8px 0' },
    photoPreview: { maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginTop: 8, display: 'block' },
    // Feed tab — Instagram-style photo cards, Threads-style text posts
    feedWrap: { display: 'flex', flexDirection: 'column', gap: 16 },
    feedHead: { textAlign: 'center', fontSize: 13, color: th.subt, marginBottom: 4 },
    avatar: (size) => ({ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flex: '0 0 auto', fontSize: Math.round(size * 0.42) }),
    feedName: { fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    feedTime: { color: th.subt, fontSize: 12, whiteSpace: 'nowrap' },
    feedSub: { color: th.subt, fontSize: 12 },
    igCard: { background: th.card, border: `1px solid ${th.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: `0 6px 18px ${th.shadow}` },
    igHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' },
    igPhoto: { width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'cover', background: th.cardSoft },
    igBody: { padding: '12px 14px 14px' },
    igActionRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
    igCaption: { fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' },
    thPost: { background: th.card, border: `1px solid ${th.line}`, borderRadius: 16, padding: 14, display: 'flex', gap: 12 },
    thBody: { flex: 1, minWidth: 0 },
    thHeadRow: { display: 'flex', alignItems: 'center', gap: 6 },
    thText: { fontSize: 15, lineHeight: 1.5, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
    thMetaRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 13, color: th.subt },
    banner: { textAlign: 'center', borderRadius: 14, padding: '10px 14px', fontWeight: 700, marginBottom: 14 },
    podiumRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 10 },
    podiumCol: { background: th.cardSoft, border: `1px solid ${th.line}`, borderRadius: '12px 12px 0 0', width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 8 },
    listRow: { background: th.card, border: `1px solid ${th.line}`, borderRadius: 12, padding: 10 },
    joinCard: { maxWidth: 420, margin: '60px auto', padding: 24, textAlign: 'center' },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(raw) {
  return (raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(CTRL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18)
}

function sanitizeNotes(raw) {
  return (raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(CTRL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
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

function keyFor(name) {
  return encodeURIComponent(name.trim().toLowerCase()).replace(/\./g, '%2E')
}

function hashHue(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % 360
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
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
    for (const [id, e] of Object.entries(entries)) out.push({ ...e, id, playerKey: key, playerName: p.name })
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

function computeStats(player) {
  const entries = player.entries || []
  const ratings = entries.map((e) => e.rating).filter((r) => r !== null && r !== undefined)
  return {
    count: player.count || 0,
    spots: distinctSpots(entries),
    homemade: entries.filter((e) => isHomemade(e.location)).length,
    maxRating: ratings.length ? Math.max(...ratings) : 0,
    minRating: ratings.length ? Math.min(...ratings) : null,
    ratingCount: ratings.length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    bullseye: entries.filter((e) => e.matrix && e.matrix.x > 0.3 && e.matrix.y > 0.3).length,
    storyteller: entries.filter((e) => e.notes && e.notes.trim().length >= 4).length,
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

async function ensurePlayer(name) {
  const key = keyFor(name)
  await runTransaction(ref(db, `${ROOT}/${key}`), (cur) => cur || { name, count: 0, entries: {} })
  return key
}

async function logTacoWithId(key, id, entry) {
  await runTransaction(ref(db, `${ROOT}/${key}`), (cur) => {
    if (!cur) return cur
    const oldEntries = cur.entries || {}
    const stubs = Math.max(0, (cur.count || 0) - Object.keys(oldEntries).length)
    const entries = { ...oldEntries, [id]: entry }
    cur.entries = entries
    cur.count = stubs + Object.keys(entries).length
    return cur
  })
}

async function removeLastTaco(key) {
  await runTransaction(ref(db, `${ROOT}/${key}`), (cur) => {
    if (!cur) return cur
    const oldEntries = cur.entries || {}
    const ids = Object.keys(oldEntries)
    const stubs = Math.max(0, (cur.count || 0) - ids.length)
    if (ids.length === 0) {
      cur.count = Math.max(0, (cur.count || 0) - 1)
      return cur
    }
    let latestId = ids[0]
    for (const id of ids) if ((oldEntries[id].ts || 0) > (oldEntries[latestId].ts || 0)) latestId = id
    const entries = { ...oldEntries }
    delete entries[latestId]
    cur.entries = entries
    cur.count = stubs + Object.keys(entries).length
    return cur
  })
}

async function deleteTaco(key, entryId) {
  await runTransaction(ref(db, `${ROOT}/${key}`), (cur) => {
    if (!cur) return cur
    const oldEntries = cur.entries || {}
    const stubs = Math.max(0, (cur.count || 0) - Object.keys(oldEntries).length)
    const entries = { ...oldEntries }
    delete entries[entryId]
    cur.entries = entries
    cur.count = stubs + Object.keys(entries).length
    return cur
  })
}

async function editTaco(key, entryId, patch) {
  await update(ref(db, `${ROOT}/${key}/entries/${entryId}`), patch)
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

function Star({ filled, half, size = 28, color, bg }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, lineHeight: `${size}px`, fontSize: size }}>
      <span style={{ position: 'absolute', inset: 0, color: bg }}>★</span>
      {(filled || half) && (
        <span style={{ position: 'absolute', inset: 0, color, clipPath: half ? 'inset(0 50% 0 0)' : 'inset(0 0 0 0)' }}>★</span>
      )}
    </span>
  )
}

function StarRow({ rating, size = 16, color, bg }) {
  const r = rating || 0
  const stars = []
  for (let i = 1; i <= 5; i++) {
    const filled = r >= i
    const half = !filled && r >= i - 0.5
    stars.push(<Star key={i} filled={filled} half={half} size={size} color={color} bg={bg} />)
  }
  return <span style={{ display: 'inline-flex' }}>{stars}</span>
}

function StarRating({ value, onChange, size = 32, color, bg }) {
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
          <button key={n} type="button" onClick={() => tap(n)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} aria-label={`Rate ${n} stars`}>
            <Star filled={filled} half={half} size={size} color={color} bg={bg} />
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
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, format: 'json', addressdetails: '1', namedetails: '1', limit: '6' })
        if (viewbox) {
          params.set('viewbox', viewbox)
          params.set('bounded', '0')
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal: controller.signal })
        const data = await res.json()
        setResults(
          (data || []).filter(
            (d) => (d.class === 'amenity' && NOMINATIM_AMENITY.includes(d.type)) || (d.class === 'shop' && NOMINATIM_SHOP.includes(d.type)),
          ),
        )
      } catch (err) {
        if (err.name !== 'AbortError') setResults([])
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, viewbox])
  return results
}

function LocationInput({ value, onChange, priorLabels, near, S }) {
  const [query, setQuery] = useState(value?.label || '')
  const [open, setOpen] = useState(false)
  const results = useDebouncedNominatim(query, near)
  const priorMatches = query.trim().length >= 1 ? priorLabels.filter((l) => l.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : []

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
        style={S.input}
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
      <button type="button" style={S.chipBtn} onMouseDown={(e) => e.preventDefault()} onClick={homemade}>
        🏠 Homemade
      </button>
      {open && (priorMatches.length > 0 || results.length > 0) && (
        <div style={S.autocompleteBox}>
          {priorMatches.map((l) => (
            <div key={l} style={S.autocompleteRow} onMouseDown={() => selectPrior(l)}>
              🕑 {l}
            </div>
          ))}
          {results.map((r) => (
            <div key={r.place_id} style={S.autocompleteRow} onMouseDown={() => selectResult(r)}>
              🍽️ {formatResultLabel(r)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Matrix plot (chic/cheap × garbage/gourmet) — interactive in the modal,
// read-only in the Matrix tab.
// ---------------------------------------------------------------------------

function MatrixPlot({ value, onChange, points, th, S, size = 260 }) {
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
      onMouseMove={onChange ? (e) => e.buttons === 1 && handleDrag(e) : undefined}
      onTouchStart={onChange ? handleDrag : undefined}
      onTouchMove={onChange ? handleDrag : undefined}
      style={{ ...S.matrixBox, height: size }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: `1px dashed ${th.line}` }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: `1px dashed ${th.line}` }} />
      <div style={S.matrixAxisLabelTop}>chic ↑</div>
      <div style={S.matrixAxisLabelBottom}>↓ cheap</div>
      <div style={S.matrixAxisLabelLeft}>garbage ←</div>
      <div style={S.matrixAxisLabelRight}>→ gourmet ⭐</div>
      {points &&
        points.map((p, i) => (
          <span
            key={i}
            onClick={p.onClick}
            style={{
              position: 'absolute',
              left: `${((p.x + 1) / 2) * 100}%`,
              top: `${((1 - p.y) / 2) * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: p.big ? 26 : 18,
              filter: `drop-shadow(0 0 4px hsl(${p.hue}, 70%, 45%))`,
              cursor: p.onClick ? 'pointer' : 'default',
            }}
          >
            🌮
          </span>
        ))}
      {value && (
        <span
          style={{
            position: 'absolute',
            left: `${((value.x + 1) / 2) * 100}%`,
            top: `${((1 - value.y) / 2) * 100}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 30,
          }}
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

function LogModal({ mode, initial, onSubmit, onDelete, onCancel, priorLabels, S, th }) {
  const [rating, setRating] = useState(initial?.rating ?? null)
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
    <div style={S.modalOverlay} onMouseDown={onCancel}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.sheetHandle} />
        <div style={S.modalTitle}>{mode === 'edit' ? 'Edit taco ✏️' : 'Log a Taco 🌮'}</div>

        <div style={S.fieldLabel}>Rating</div>
        <div>
          <StarRating value={rating ?? 0} onChange={setRating} size={30} color={th.salsa} bg={th.line} />
          {rating != null && (
            <button type="button" style={{ ...S.linkBtn, marginLeft: 8 }} onClick={() => setRating(null)}>
              clear
            </button>
          )}
        </div>

        <div style={S.fieldLabel}>Location</div>
        <LocationInput value={locationVal} onChange={setLocationVal} priorLabels={priorLabels} near={near} S={S} />
        <button type="button" style={S.chipBtn} onClick={handleNearMe}>
          📍 Near me
        </button>

        <div style={S.fieldLabel}>Photo</div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={S.hiddenFile} tabIndex={-1} />
        <input ref={libraryRef} type="file" accept="image/*" onChange={handlePhotoChange} style={S.hiddenFile} tabIndex={-1} />
        {!photoPreview ? (
          <div style={S.photoBtnRow}>
            <button type="button" style={S.photoBtn} onClick={() => cameraRef.current?.click()}>
              📷 Take photo
            </button>
            <button type="button" style={S.photoBtn} onClick={() => libraryRef.current?.click()}>
              🖼️ Choose photo
            </button>
          </div>
        ) : (
          <div style={S.photoFrame}>
            <img src={photoPreview} style={S.photoImg} alt="" />
            <button type="button" style={S.photoRemove} onClick={removePhoto} aria-label="Remove photo">
              ✕
            </button>
          </div>
        )}

        <div style={S.fieldLabel}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={matrixOn} onChange={(e) => setMatrixOn(e.target.checked)} /> Plot it on the matrix
          </label>
        </div>
        {matrixOn && <MatrixPlot value={matrixVal} onChange={setMatrixVal} th={th} S={S} size={240} />}

        <div style={S.fieldLabel}>
          Notes ({notes.length}/{NOTES_MAX})
        </div>
        <textarea style={S.textarea} value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} placeholder="al pastor, no cilantro..." />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button style={{ ...S.primaryBtn, flex: 2, minHeight: 50, fontSize: 15 }} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Log it 🔥'}
          </button>
          <button style={{ ...S.ghostBtn, flex: 1, minHeight: 50 }} onClick={onCancel}>
            Cancel
          </button>
        </div>

        {mode === 'edit' && onDelete && (
          <div style={{ marginTop: 12 }}>
            {!confirmDelete ? (
              <button style={S.linkBtnDanger} onClick={() => setConfirmDelete(true)}>
                Delete this taco
              </button>
            ) : (
              <span>
                Are you sure?{' '}
                <button style={S.linkBtnDanger} onClick={onDelete}>
                  Yes, delete
                </button>{' '}
                <button style={S.linkBtn} onClick={() => setConfirmDelete(false)}>
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

function AdminModal({ total, onReset, onNuke, onClose, S }) {
  const [pw, setPw] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmNuke, setConfirmNuke] = useState(false)

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalTitle}>🔧 Admin</div>
        {!unlocked ? (
          <>
            <input
              style={S.input}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pw === ADMIN_PW && setUnlocked(true)}
              placeholder="Password"
            />
            <button style={{ ...S.primaryBtn, marginTop: 12 }} onClick={() => pw === ADMIN_PW && setUnlocked(true)}>
              Unlock
            </button>
          </>
        ) : (
          <>
            <div style={S.subt}>Running total: {total} 🌮</div>
            <div style={{ marginTop: 16 }}>
              {!confirmReset ? (
                <button style={S.ghostBtn} onClick={() => setConfirmReset(true)}>
                  Reset all counts to 0
                </button>
              ) : (
                <span>
                  Sure?{' '}
                  <button style={S.linkBtnDanger} onClick={onReset}>
                    Yes, reset
                  </button>{' '}
                  <button style={S.linkBtn} onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              {!confirmNuke ? (
                <button style={S.ghostBtn} onClick={() => setConfirmNuke(true)}>
                  Remove all players &amp; counts
                </button>
              ) : (
                <span>
                  Sure?{' '}
                  <button style={S.linkBtnDanger} onClick={onNuke}>
                    Yes, nuke everything
                  </button>{' '}
                  <button style={S.linkBtn} onClick={() => setConfirmNuke(false)}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <button style={S.ghostBtn} onClick={onClose}>
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

function Header({ tab, setTab, theme, setTheme, locked, msLeft, onAdminOpen, S }) {
  const { d, h, m, s } = splitTime(msLeft)
  const tabs = [
    ['count', 'Count'],
    ['feed', 'Feed'],
    ['board', 'Board'],
    ['map', 'Map'],
    ['matrix', 'Matrix'],
    ['stars', 'Stars'],
    ['diary', 'Diary'],
    ['rules', 'Rules'],
  ]
  return (
    <div style={S.header}>
      <div style={S.headerRow}>
        <div style={S.logo}>🌮 Taco Fall</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.iconBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button style={S.iconBtn} onClick={onAdminOpen}>
            🔧
          </button>
        </div>
      </div>
      {!locked ? (
        <div style={S.countdownBar}>
          🔥 Counting locks in {d}d {h}h {m}m {s}s
        </div>
      ) : (
        <div style={S.lockBanner}>🔒 Counting closed — final tally</div>
      )}
      <div style={S.tabs}>
        {tabs.map(([id, label]) => (
          <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Join screen
// ---------------------------------------------------------------------------

function JoinScreen({ players, onJoin, S }) {
  const [name, setName] = useState('')
  const names = Object.values(players).map((p) => p.name)
  return (
    <div style={S.joinCard}>
      <div style={S.logo}>🌮 Taco Fall</div>
      <p style={S.subt}>Enter your name to join the crew (max {MAX_P}).</p>
      <input
        style={S.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onJoin(name)}
        placeholder="Your name"
        maxLength={18}
      />
      <button style={{ ...S.primaryBtn, marginTop: 12 }} onClick={() => onJoin(name)}>
        Join 🌮
      </button>
      {names.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={S.subt}>Already playing:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: 'center' }}>
            {names.map((n) => (
              <button key={n} style={S.chipBtn} onClick={() => onJoin(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function CountTab({ me, myKey, myPlayer, locked, onPlus, onMinus, S }) {
  const count = myPlayer?.count || 0
  const myEntries = myPlayer ? flattenEntries({ [myKey]: myPlayer }) : []
  const badges = earnedBadges({ count, entries: myEntries })
  const earnedIds = new Set(badges.map((b) => b.id))
  const nextBadge = BADGES.find((b) => !earnedIds.has(b.id))

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={S.subt}>
        Signed in as <strong>{me}</strong>
      </div>
      <div style={S.bigCount}>{count}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button style={S.countBtn} onClick={onMinus} disabled={locked || count === 0}>
          −1
        </button>
        <button style={{ ...S.countBtn, ...S.countBtnPrimary }} onClick={onPlus} disabled={locked}>
          +1 🌮
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 20 }}>
        {badges.map((b) => (
          <span key={b.id} style={S.badgeChip} title={b.hint}>
            {b.emoji} {b.label}
          </span>
        ))}
      </div>
      {nextBadge && (
        <div style={{ ...S.subt, marginTop: 10 }}>
          Next: {nextBadge.emoji} {nextBadge.label} — {nextBadge.hint}
        </div>
      )}
    </div>
  )
}

function BoardTab({ players, myKey, locked, S, th }) {
  const list = Object.entries(players)
    .map(([key, p]) => ({ key, name: p.name, count: p.count || 0, entries: flattenEntries({ [key]: p }) }))
    .sort((a, b) => b.count - a.count)
  const total = list.reduce((a, b) => a + b.count, 0)
  const top3 = list.slice(0, 3)
  const winner = list[0]
  const maxCount = list[0]?.count || 1

  return (
    <div>
      <div style={{ ...S.banner, background: locked ? th.salsa : th.cardSoft, color: locked ? '#fff' : th.text }}>
        {locked
          ? `👑 Counting closed — ${winner ? winner.name : 'nobody'} wins with ${winner ? winner.count : 0} 🌮`
          : `🌮 Tacos eaten so far · ${total} · by ${list.length} player${list.length === 1 ? '' : 's'} · live count`}
      </div>

      {top3.length > 0 && (
        <div style={S.podiumRow}>
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((p) => {
            const rank = p === top3[0] ? 1 : p === top3[1] ? 2 : 3
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
            return (
              <div key={p.key} style={{ ...S.podiumCol, height: rank === 1 ? 140 : rank === 2 ? 110 : 90 }}>
                <div style={{ fontSize: 24 }}>{medal}</div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div>{p.count} 🌮</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {list.map((p, i) => (
          <div key={p.key} style={{ ...S.listRow, borderColor: p.key === myKey ? th.tortilla : th.line }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {i + 1}. {p.name}
              </span>
              <span>{p.count} 🌮</span>
            </div>
            <div style={{ height: 6, background: th.line, borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(p.count / maxCount) * 100}%`, height: '100%', background: th.salsa }} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
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

function MapTab({ entries, S }) {
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
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:44px;position:relative;">
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
  const homemadeCount = entries.filter((e) => isHomemade(e.location)).length

  return (
    <div>
      <div style={S.sectionHeader}>
        🗺️ Taco Map · {pinnedCount} spots pinned · {homemadeCount} homemade 🏠
      </div>
      <div ref={containerRef} style={{ height: 420, borderRadius: 16, overflow: 'hidden' }} />
    </div>
  )
}

function MatrixTab({ entries, myKey, S, th }) {
  const [active, setActive] = useState(null)
  const points = entries
    .filter((e) => e.matrix)
    .map((e) => ({ x: e.matrix.x, y: e.matrix.y, hue: hashHue(e.playerName), big: e.playerKey === myKey, onClick: () => setActive(e) }))

  return (
    <div>
      <div style={S.sectionHeader}>📊 Taste Matrix</div>
      <div style={{ position: 'relative' }}>
        <MatrixPlot points={points} th={th} S={S} size={340} />
        {active && (
          <div style={S.matrixActiveCard}>
            <strong>{active.playerName}</strong>
            <div>{renderStarsText(active.rating)}</div>
            <div>{active.location?.label || '—'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StarsTab({ entries, players, myKey, S, th }) {
  const rated = entries.filter((e) => e.rating != null)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>Crew average</div>
        <div style={S.bigNumber}>{avg.toFixed(1)}</div>
        <StarRow rating={avg} size={22} color={th.salsa} bg={th.line} />
        <div style={S.subt}>{rated.length} rated tacos</div>
        <div style={{ marginTop: 12 }}>
          {bands.map((b) => (
            <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 28 }}>{b.n}★</span>
              <div style={{ flex: 1, height: 8, background: th.line, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${rated.length ? (b.count / rated.length) * 100 : 0}%`, height: '100%', background: th.salsa }} />
              </div>
              <span style={{ width: 24, textAlign: 'right' }}>{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Top tacos</div>
        {top5.length === 0 && <div style={S.subt}>No ratings yet.</div>}
        {top5.map((e) => (
          <div key={e.id} style={{ ...S.diaryRow, borderColor: e.playerKey === myKey ? th.tortilla : th.line, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{e.playerName}</strong>
              <StarRow rating={e.rating} size={14} color={th.salsa} bg={th.line} />
            </div>
            <div style={S.subt}>
              {isHomemade(e.location) ? '🏠' : '📍'} {e.location?.label || '—'}
            </div>
            {e.notes && <div style={{ fontStyle: 'italic' }}>{e.notes}</div>}
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Your badges</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
          {BADGES.map((b) => (
            <div key={b.id} style={{ ...S.badgeCell, opacity: earnedIds.has(b.id) ? 1 : 0.4, filter: earnedIds.has(b.id) ? 'none' : 'grayscale(1)' }} title={b.hint}>
              <div style={{ fontSize: 26 }}>{b.emoji}</div>
              <div style={{ fontSize: 11 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Pickiest critics</div>
        {perPlayer.length === 0 && <div style={S.subt}>Not enough ratings yet.</div>}
        {perPlayer.map((p) => (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${th.line}` }}>
            <span>{p.name}</span>
            <span>
              {p.avg.toFixed(1)}★ ({p.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiaryTab({ myEntries, myKey, locked, onEdit, S, th }) {
  if (!myKey) return <div style={S.card}>Sign in to see your diary.</div>
  const sorted = [...myEntries].sort((a, b) => b.ts - a.ts)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.length === 0 && <div style={S.card}>No tacos logged yet — hit +1 to start your diary.</div>}
      {sorted.map((e) => {
        const untagged = e.rating == null && !e.location && !e.notes && !e.matrix
        return (
          <div key={e.id} style={{ ...S.diaryRow, borderStyle: untagged ? 'dashed' : 'solid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={S.subt}>{formatRelative(e.ts)}</span>
              {!locked && (
                <button style={S.ghostBtnSm} onClick={() => onEdit(e)}>
                  ✏️ edit
                </button>
              )}
            </div>
            {e.photoUrl && <img src={e.photoUrl} style={S.photoThumb} alt="" />}
            <div>{e.rating != null ? <StarRow rating={e.rating} size={16} color={th.salsa} bg={th.line} /> : '— unrated'}</div>
            {e.location && (
              <div style={S.subt}>
                {isHomemade(e.location) ? '🏠' : '📍'} {e.location.label}
              </div>
            )}
            {e.notes && <div style={{ fontStyle: 'italic' }}>{e.notes}</div>}
            {e.matrix && <span style={S.matrixChip}>🎯 plotted</span>}
            {untagged && <div style={S.untaggedHint}>🔖 Untagged taco — tap edit to add stars, place &amp; notes</div>}
          </div>
        )
      })}
    </div>
  )
}

function Avatar({ name, size = 38, S }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <div style={{ ...S.avatar(size), background: `hsl(${hashHue(name)}, 58%, 48%)` }} aria-hidden="true">
      {initial}
    </div>
  )
}

function InstagramCard({ e, mine, S, th }) {
  return (
    <div style={{ ...S.igCard, borderColor: mine ? th.tortilla : th.line }}>
      <div style={S.igHeader}>
        <Avatar name={e.playerName} size={38} S={S} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.feedName}>
            {e.playerName}
            {mine && <span style={{ ...S.feedSub, marginLeft: 6 }}>· you</span>}
          </div>
          {e.location && (
            <div style={S.feedSub}>
              {isHomemade(e.location) ? '🏠' : '📍'} {e.location.label}
            </div>
          )}
        </div>
        <div style={S.feedTime}>{formatRelative(e.ts)}</div>
      </div>
      <img src={e.photoUrl} style={S.igPhoto} alt="" loading="lazy" />
      <div style={S.igBody}>
        {e.rating != null && (
          <div style={S.igActionRow}>
            <StarRow rating={e.rating} size={20} color={th.salsa} bg={th.line} />
            <span style={S.feedSub}>{e.rating}★</span>
          </div>
        )}
        {e.notes && (
          <div style={S.igCaption}>
            <strong>{e.playerName}</strong> {e.notes}
          </div>
        )}
        {e.matrix && <span style={{ ...S.matrixChip, marginTop: 8 }}>🎯 plotted</span>}
      </div>
    </div>
  )
}

function ThreadsPost({ e, mine, S, th }) {
  const hasText = e.notes && e.notes.trim().length > 0
  return (
    <div style={{ ...S.thPost, borderColor: mine ? th.tortilla : th.line }}>
      <Avatar name={e.playerName} size={38} S={S} />
      <div style={S.thBody}>
        <div style={S.thHeadRow}>
          <span style={S.feedName}>{e.playerName}</span>
          {mine && <span style={S.feedSub}>· you</span>}
          <span style={{ ...S.feedTime, marginLeft: 'auto' }}>{formatRelative(e.ts)}</span>
        </div>
        {hasText ? <div style={S.thText}>{e.notes}</div> : <div style={{ ...S.thText, color: th.subt }}>logged a taco 🌮</div>}
        <div style={S.thMetaRow}>
          {e.rating != null ? <StarRow rating={e.rating} size={15} color={th.salsa} bg={th.line} /> : <span>— unrated</span>}
          {e.location && (
            <span>
              {isHomemade(e.location) ? '🏠' : '📍'} {e.location.label}
            </span>
          )}
          {e.matrix && <span>🎯 plotted</span>}
        </div>
      </div>
    </div>
  )
}

function FeedTab({ entries, myKey, S, th }) {
  const sorted = useMemo(() => [...entries].sort((a, b) => (b.ts || 0) - (a.ts || 0)), [entries])
  if (sorted.length === 0) return <div style={S.card}>No tacos yet — post the first one from the Count tab. 🌮</div>

  return (
    <div>
      <div style={S.feedHead}>
        🌮 {sorted.length} taco{sorted.length === 1 ? '' : 's'} · freshest first
      </div>
      <div style={S.feedWrap}>
        {sorted.map((e) =>
          e.photoUrl ? (
            <InstagramCard key={e.id} e={e} mine={e.playerKey === myKey} S={S} th={th} />
          ) : (
            <ThreadsPost key={e.id} e={e} mine={e.playerKey === myKey} S={S} th={th} />
          ),
        )}
      </div>
    </div>
  )
}

function RulesTab({ S }) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>🌮 The Rules</div>
      <ul style={{ lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
        <li>You must be able to pick it up — no forks.</li>
        <li>Taco salads, taco bowls, and burritos do not count.</li>
        <li>2 street-size tacos = 1 taco.</li>
        <li>Tostadas count if folded and eaten by hand.</li>
        <li>Any protein is fair game — traditional or fusion.</li>
        <li>Homemade tacos always count.</li>
        <li>Lettuce wrap instead of a tortilla is OK only if you're gluten-free.</li>
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const th = theme === 'dark' ? DT : LT
  const S = useMemo(() => styles(th), [th])
  const [me, setMe] = useState(() => localStorage.getItem(ME_KEY) || '')
  const [players, setPlayers] = useState({})
  const [tab, setTab] = useState('count')
  const [now, setNow] = useState(Date.now())
  const [modal, setModal] = useState(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [rain, setRain] = useState([])

  useEffect(() => onValue(ref(db, ROOT), (snap) => setPlayers(snap.val() || {})), [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const locked = now >= LOCK.getTime()
  const myKey = me ? keyFor(me) : null
  const myPlayer = myKey ? players[myKey] : null
  const allEntries = useMemo(() => flattenEntries(players), [players])
  const myEntries = useMemo(() => allEntries.filter((e) => e.playerKey === myKey), [allEntries, myKey])
  const priorLabels = useMemo(() => {
    const set = new Set()
    for (const e of allEntries) if (e.location?.label && e.location.label !== 'Homemade') set.add(e.location.label)
    return Array.from(set)
  }, [allEntries])
  const total = Object.values(players).reduce((a, p) => a + (p.count || 0), 0)

  async function handleJoin(rawName) {
    const clean = sanitize(rawName)
    if (!clean) return
    const key = keyFor(clean)
    if (Object.keys(players).length >= MAX_P && !players[key]) {
      alert(`This crew is full (max ${MAX_P}).`)
      return
    }
    await ensurePlayer(clean)
    localStorage.setItem(ME_KEY, clean)
    setMe(clean)
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

  async function handleMinus() {
    if (!myKey || locked) return
    await removeLastTaco(myKey)
  }

  async function handleCreateSubmit(draft, photoFile) {
    if (!myKey) return
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
    // photoUrl of null deletes the field via RTDB update, so a removed photo actually clears.
    await editTaco(myKey, modal.entry.id, { ...draft, photoUrl })
    setModal(null)
  }

  async function handleDeleteEntry() {
    if (!myKey || !modal?.entry) return
    await deleteTaco(myKey, modal.entry.id)
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
    localStorage.removeItem(ME_KEY)
    setMe('')
  }

  return (
    <div style={S.page}>
      {rain.map((r) => (
        <span
          key={r.id}
          className="bfall-emoji"
          style={{ left: `${r.left}%`, fontSize: r.size, animationDuration: `${r.duration}s`, animationDelay: `${r.delay}s`, '--sway': `${r.sway}px` }}
        >
          {r.emoji}
        </span>
      ))}

      {!me ? (
        <JoinScreen players={players} onJoin={handleJoin} S={S} />
      ) : (
        <>
          <Header tab={tab} setTab={setTab} theme={theme} setTheme={setTheme} locked={locked} msLeft={LOCK.getTime() - now} onAdminOpen={() => setAdminOpen(true)} S={S} />
          <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
            {tab === 'count' && (
              <CountTab me={me} myKey={myKey} myPlayer={myPlayer} locked={locked} onPlus={() => !locked && setModal({ mode: 'create' })} onMinus={handleMinus} S={S} />
            )}
            {tab === 'feed' && <FeedTab entries={allEntries} myKey={myKey} S={S} th={th} />}
            {tab === 'board' && <BoardTab players={players} myKey={myKey} locked={locked} S={S} th={th} />}
            {tab === 'map' && <MapTab entries={allEntries} S={S} />}
            {tab === 'matrix' && <MatrixTab entries={allEntries} myKey={myKey} S={S} th={th} />}
            {tab === 'stars' && <StarsTab entries={allEntries} players={players} myKey={myKey} S={S} th={th} />}
            {tab === 'diary' && <DiaryTab myEntries={myEntries} myKey={myKey} locked={locked} onEdit={(entry) => setModal({ mode: 'edit', entry })} S={S} th={th} />}
            {tab === 'rules' && <RulesTab S={S} />}
          </div>
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
          S={S}
          th={th}
        />
      )}

      {adminOpen && <AdminModal total={total} onReset={handleAdminReset} onNuke={handleAdminNuke} onClose={() => setAdminOpen(false)} S={S} />}
    </div>
  )
}
