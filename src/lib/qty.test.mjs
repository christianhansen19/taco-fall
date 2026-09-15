import { applyEntries, entryQty, mergeEntry, removeLastUpdater, sumQty } from './qty.js'

let pass = 0
let fail = 0
function eq(label, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ok   ${label}`) }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${g}\n         want ${w}`) }
}

// The exact reducer the app runs, so a bug here is a bug in production.
const log = (cur, id, entry) => applyEntries(cur, (es) => ({ ...es, [id]: entry }))
const del = (cur, id) => applyEntries(cur, (es) => { delete es[id]; return es })
const edit = (cur, id, patch) => applyEntries(cur, (es) => mergeEntry(es, id, patch))

console.log('\nentryQty — absent/garbage means exactly one taco')
eq('undefined entry', entryQty(undefined), 1)
eq('no qty field (legacy)', entryQty({ ts: 1 }), 1)
eq('qty null', entryQty({ qty: null }), 1)
eq('qty NaN', entryQty({ qty: 'abc' }), 1)
eq('qty 3', entryQty({ qty: 3 }), 3)
eq('qty 3.7 floors', entryQty({ qty: 3.7 }), 3)
eq('qty 0 clamps up', entryQty({ qty: 0 }), 1)
eq('qty -5 clamps up', entryQty({ qty: -5 }), 1)
eq('qty 999 clamps down', entryQty({ qty: 999 }), 20)

console.log('\nBackward compatibility — legacy rows must be byte-identical after a rewrite')
{
  // 5 legacy entries, none with qty, count matches. Log a 6th single taco.
  const legacy = { count: 5, entries: Object.fromEntries([1,2,3,4,5].map(i => [`e${i}`, { ts: i }])) }
  const after = log(structuredClone(legacy), 'e6', { ts: 6, qty: 1 })
  eq('legacy 5 + 1 = 6', after.count, 6)
}
{
  // Legacy player with 3 stub taps and 2 real entries: count 5, entries 2.
  const mixed = { count: 5, entries: { a: { ts: 1 }, b: { ts: 2 } } }
  eq('stubs preserved on log', log(structuredClone(mixed), 'c', { ts: 3, qty: 1 }).count, 6)
  eq('stubs preserved on delete', del(structuredClone(mixed), 'a').count, 4)
  eq('stub-only player −1', removeLastUpdater({ count: 4, entries: {} }).count, 3)
  eq('stub-only player floors at 0', removeLastUpdater({ count: 0, entries: {} }).count, 0)
}

console.log('\nLogging with qty')
{
  let p = { count: 0, entries: {} }
  p = log(p, 'a', { ts: 1, qty: 1 })
  eq('qty 1 → count 1', p.count, 1)
  p = log(p, 'b', { ts: 2, qty: 3 })
  eq('qty 3 → count 4', p.count, 4)
  eq('two posts', Object.keys(p.entries).length, 2)
}

console.log('\n−1 peels one taco off the newest entry, never destroys it early')
{
  let p = { count: 0, entries: {} }
  p = log(p, 'old', { ts: 1, qty: 1 })
  p = log(p, 'new', { ts: 2, qty: 3, photoUrl: 'x.jpg', rating: 5 })
  eq('count before', p.count, 4)

  p = removeLastUpdater(p)
  eq('count after one −1', p.count, 3)
  eq('entry survives', p.entries.new.qty, 2)
  eq('photo survives', p.entries.new.photoUrl, 'x.jpg')
  eq('rating survives', p.entries.new.rating, 5)

  p = removeLastUpdater(p)
  eq('count 2', p.count, 2)
  eq('qty 1', p.entries.new.qty, 1)

  p = removeLastUpdater(p)
  eq('entry deleted at zero', p.entries.new, undefined)
  eq('count 1', p.count, 1)
  eq('older entry untouched', p.entries.old.ts, 1)

  p = removeLastUpdater(p)
  eq('count 0', p.count, 0)
  eq('no entries left', Object.keys(p.entries).length, 0)
}

console.log('\nEditing qty must move the count (the plain-update() regression)')
{
  let p = log({ count: 0, entries: {} }, 'a', { ts: 1, qty: 3, rating: 4 })
  eq('count 3', p.count, 3)
  p = edit(p, 'a', { qty: 1 })
  eq('edit 3 → 1 drops count to 1', p.count, 1)
  eq('rating preserved through merge', p.entries.a.rating, 4)
  p = edit(p, 'a', { qty: 5 })
  eq('edit 1 → 5 raises count to 5', p.count, 5)
}
{
  // Editing a LEGACY entry that has no qty at all.
  let p = { count: 1, entries: { a: { ts: 1, rating: 3 } } }
  p = edit(p, 'a', { qty: 4 })
  eq('legacy entry edited to qty 4', p.count, 4)
}
{
  // delete-on-null semantics that photo clearing relies on
  let p = { count: 1, entries: { a: { ts: 1, qty: 1, photoUrl: 'x.jpg' } } }
  p = edit(p, 'a', { photoUrl: null })
  eq('null patch removes the key', 'photoUrl' in p.entries.a, false)
  eq('count unchanged by photo clear', p.count, 1)
  eq('edit of missing entry is a no-op', edit(p, 'nope', { qty: 9 }).count, 1)
}

console.log('\nDeleting a multi-taco entry removes all of its tacos')
{
  let p = log(log({ count: 0, entries: {} }, 'a', { ts: 1, qty: 1 }), 'b', { ts: 2, qty: 4 })
  eq('count 5', p.count, 5)
  eq('delete qty-4 entry → 1', del(p, 'b').count, 1)
}

console.log('\nsumQty over a flattenEntries-style array')
eq('mixed array', sumQty([{ qty: 3 }, { ts: 1 }, { qty: 2 }]), 6)
eq('empty', sumQty([]), 0)
eq('null safe', sumQty(null), 0)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
