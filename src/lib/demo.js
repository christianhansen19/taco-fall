// Dev-only fixtures for working on the UI without signing in.
// Enabled with ?demo=1. `import.meta.env.DEV` is statically false in a
// production build, so everything below is tree-shaken out of the bundle.

export const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')

export const DEMO_USER = {
  uid: 'demo-chris',
  displayName: 'Chris Hansen',
  photoURL: null,
}

// The demo user stands in for the owner so the admin UI is reachable here.
export const DEMO_ADMINS = { 'demo-chris': true, 'demo-elena': true }

// Inline SVG so the demo renders identically offline.
function photo(a, b) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="340" font-size="180" text-anchor="middle">🌮</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Stand-ins for Google profile pictures, so the avatar image path is exercised
// here and not only in production.
function avatar(a, b) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="78" r="34" fill="rgba(255,255,255,0.9)"/><path d="M28 200c0-40 32-66 72-66s72 26 72 66z" fill="rgba(255,255,255,0.9)"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const HOUR = 3600000
const DAY = 24 * HOUR
const t = (daysAgo, hoursAgo = 0) => Date.now() - daysAgo * DAY - hoursAgo * HOUR

const spot = (label, lat, lng) => ({ label, lat, lng })
const HOME = { label: 'Homemade', lat: null, lng: null }

const TORCHYS = spot("Torchy's Tacos", 39.7392, -104.9903)
const PINCHE = spot('Pinche Tacos', 39.7555, -104.9847)
const TAQUERIA = spot('Taquería El Nopal', 39.7201, -105.0166)
const CHILANGO = spot('Chilango Taqueria', 40.7608, -111.891)
const BIRRIA = spot('Birrieria La Estrella', 39.7684, -104.9622)

// Long names are deliberate — the podium has to survive them.
const PLAYERS = {
  'demo-chris': {
    name: 'Chris Hansen',
    photoURL: avatar('#B0302F', '#EB8F2C'),
    entries: [
      { ts: t(0, 2), qty: 3, rating: 4.5, location: TORCHYS, notes: 'Split a trompo plate three ways and still went back for a third. The al pastor here is genuinely unfair.', matrix: { x: 0.55, y: 0.2 }, photoUrl: photo('#EB8F2C', '#B0302F') },
      { ts: t(1, 5), qty: 1, rating: 5, location: BIRRIA, notes: 'Consommé so good I drank the rest of it straight from the cup.', matrix: { x: 0.8, y: 0.45 } },
      { ts: t(3), qty: 2, rating: 3.5, location: HOME, notes: 'Weeknight ground beef situation. Fine. Honest.' },
      { ts: t(5, 3), qty: 1, rating: 4, location: PINCHE, photoUrl: photo('#276124', '#3575A2') },
      { ts: t(8), qty: 2, rating: 2, location: TAQUERIA, notes: 'Tortilla fell apart on contact.' },
    ],
  },
  'demo-elena': {
    name: 'Elena Gardner',
    photoURL: avatar('#B0367F', '#3575A2'),
    entries: [
      { ts: t(0, 6), qty: 2, rating: 5, location: CHILANGO, notes: 'Drove 40 minutes for these and would do it again tomorrow.', matrix: { x: 0.7, y: 0.6 }, photoUrl: photo('#B0367F', '#EB8F2C') },
      { ts: t(2), qty: 1, rating: 4.5, location: TORCHYS },
      { ts: t(4, 8), qty: 4, rating: 4, location: HOME, notes: 'Taco night for the whole house.' },
    ],
  },
  'demo-ben': {
    name: 'Ben Leimbach',
    photoURL: null,
    entries: [
      { ts: t(1), qty: 2, rating: 3, location: PINCHE, notes: 'Solid. Not transcendent.' },
      { ts: t(6), qty: 1, rating: 4, location: BIRRIA, matrix: { x: 0.4, y: 0.35 } },
      { ts: t(9), qty: 1, rating: null, location: null },
    ],
  },
  'demo-emma': {
    name: 'Emma Leishman Hansen',
    photoURL: null,
    entries: [
      { ts: t(0, 9), qty: 1, rating: 4.5, location: TAQUERIA, photoUrl: photo('#3575A2', '#276124') },
      { ts: t(7), qty: 2, rating: 5, location: HOME, notes: 'Homemade corn tortillas, pressed by hand. Worth every minute.' },
    ],
  },
  'demo-alexandra': {
    name: 'Alexandra Junge',
    photoURL: null,
    entries: [{ ts: t(2, 4), qty: 1, rating: 3.5, location: CHILANGO, notes: 'Good salsa bar.' }],
  },
  // Deliberately on the podium: the longest name in the fixtures has to survive
  // the 2nd-place column at 320px.
  'demo-bartholomew': {
    name: 'Bartholomew Leimbach-Fitzgerald',
    photoURL: avatar('#276124', '#6FA95C'),
    entries: [
      { ts: t(3, 7), qty: 5, rating: 4, location: TORCHYS, notes: 'Ordered one of everything on the board.' },
      { ts: t(10), qty: 3, rating: 1, location: TAQUERIA, notes: 'I have made a mistake.' },
    ],
  },
  'demo-tyler': {
    name: 'Tyler Jaros',
    photoURL: null,
    entries: [],
  },
}

export function demoPlayers() {
  const out = {}
  for (const [key, p] of Object.entries(PLAYERS)) {
    const entries = {}
    p.entries.forEach((e, i) => {
      entries[`${key}-e${i}`] = e
    })
    out[key] = {
      name: p.name,
      photoURL: p.photoURL,
      count: p.entries.reduce((a, e) => a + (e.qty || 1), 0),
      entries,
    }
  }
  return out
}
