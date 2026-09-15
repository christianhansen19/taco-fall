// Taco counting math, kept free of React and Firebase so it can be tested
// directly. `count` on a player node is DERIVED, never incremented:
//
//   count = stubs + Σ qty(entries)
//
// where stubs are legacy +1 taps that never produced an entry object. They are
// not stored — they're inferred as the slack between the stored count and what
// the entries account for, which is why they must always be read BEFORE the
// entries map is mutated.

export const QTY_MIN = 1
export const QTY_MAX = 20

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

// An entry with no `qty` is one taco. That default is what makes every formula
// here reduce to the pre-qty behaviour on existing data, so no migration is
// needed when this ships.
export function entryQty(e) {
  const n = Math.floor(Number(e?.qty))
  return Number.isFinite(n) ? clamp(n, QTY_MIN, QTY_MAX) : 1
}

export function sumQty(entries) {
  let total = 0
  for (const e of Object.values(entries || {})) total += entryQty(e)
  return total
}

export function stubsOf(cur) {
  return Math.max(0, (cur?.count || 0) - sumQty(cur?.entries))
}

// The updater every count-changing write runs inside its transaction: edit the
// entries map, then re-derive count. `mutate` returning undefined is an opt-out
// that leaves the node untouched.
export function applyEntries(cur, mutate) {
  if (!cur) return cur
  const stubs = stubsOf(cur)
  const next = mutate({ ...(cur.entries || {}) })
  if (next === undefined) return cur
  cur.entries = next
  cur.count = stubs + sumQty(next)
  return cur
}

// −1 means "I miscounted by one", not "erase that memory", so this peels a taco
// off the newest entry and only deletes the entry once it would hit zero. A
// player with nothing but legacy stub taps has no entry to peel, hence the
// early return that applyEntries can't express.
export function removeLastUpdater(cur) {
  if (!cur) return cur
  const stubs = stubsOf(cur)
  const entries = { ...(cur.entries || {}) }
  const ids = Object.keys(entries)
  if (ids.length === 0) {
    cur.count = Math.max(0, (cur.count || 0) - 1)
    return cur
  }
  let latestId = ids[0]
  for (const id of ids) if ((entries[id].ts || 0) > (entries[latestId].ts || 0)) latestId = id
  const qty = entryQty(entries[latestId])
  if (qty > 1) entries[latestId] = { ...entries[latestId], qty: qty - 1 }
  else delete entries[latestId]
  cur.entries = entries
  cur.count = stubs + sumQty(entries)
  return cur
}

// Merges a patch into one entry. Stripping null keys reproduces RTDB update()'s
// delete-on-null semantics, which is how a removed photo actually clears.
export function mergeEntry(entries, entryId, patch) {
  const prev = entries[entryId]
  if (!prev) return undefined
  const merged = { ...prev, ...patch }
  for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k]
  return { ...entries, [entryId]: merged }
}
