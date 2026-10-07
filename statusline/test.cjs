// node test.cjs -- every id in PRICES must render a cost, and anything
// else must render no cost at all. A missing row used to fall through to the
// client's own USD estimate, which is how the deepseek numbers went wrong: the
// ids never matched the table. The list is read out of PRICES, so a new row
// cannot be added without being covered here.
const { execFileSync } = require('child_process')
const fs = require('fs'), os = require('os'), path = require('path')
const { PRICES } = require('./statusline.cjs')

const strip = s => s.replace(/\x1b\[[\d;]*m/g, '')
const run = (obj, cols) => {
  const env = { ...process.env }
  if (cols === undefined) delete env.COLUMNS
  else env.COLUMNS = String(cols)
  return strip(execFileSync(process.execPath, [path.join(__dirname, 'statusline.cjs')], {
    input: JSON.stringify(obj), encoding: 'utf8', env,
  }))
}
// everything but the trailing clock, so two runs over the same bytes compare equal
const metrics = s => s.split(' │ ').slice(0, -1).join(' │ ')

// cache files this test owns, so a re-run never inherits one and tmpdir stays clean
const sweep = () => {
  for (const f of fs.readdirSync(os.tmpdir()))
    if (f.startsWith('claude-statusline-test-'))
      try { fs.unlinkSync(path.join(os.tmpdir(), f)) } catch {}
}
sweep()

// --- every priced id renders a cost, an unlisted one renders none -------------
const t = path.join(os.tmpdir(), 'statusline-test.jsonl')
fs.writeFileSync(t, JSON.stringify({
  message: { usage: { input_tokens: 1e6, output_tokens: 1e6, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
}) + '\n')

// every priced id, plus one [1m] case: that marker is stripped before lookup
for (const id of [...Object.keys(PRICES), 'deepseek-flash[1m]']) {
  const yen = /¥([\d.]+)/.exec(run({ model: { id }, transcript_path: t }))
  if (!yen || !(Number(yen[1]) > 0)) throw new Error(`${id}: not priced, no cost rendered`)
  console.log('ok', id, '¥' + yen[1])
}

if (/¥/.test(run({ model: { id: 'some-model-that-is-not-listed' }, transcript_path: t }))) {
  throw new Error('an unlisted model rendered a cost')
}
console.log('ok unlisted model renders no cost')

// --- incremental transcript cache --------------------------------------------
// The scan resumes from a cached byte offset, so the ways it can go wrong are:
// dropping the appended tail, counting it twice, keeping a total after the file
// was rewritten underneath, and eating a line that was only half-written. Each
// is compared against a cold scan of the same bytes.
const file = path.join(os.tmpdir(), 'statusline-test-inc.jsonl')
const model = { id: 'deepseek-v4-pro' }
const usage = n => JSON.stringify({
  message: { usage: { input_tokens: n, output_tokens: n, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
}) + '\n'
const scan = session => metrics(run({ model, transcript_path: file, session_id: 'test-' + session }))
let n = 0
const cold = () => scan('cold-' + ++n) // a never-used key, so always a full scan

// a line appended after the first run is picked up, exactly once
fs.writeFileSync(file, usage(1e5) + usage(2e5))
const both = cold()
fs.writeFileSync(file, usage(1e5))
scan('append') // caches an offset covering only the first line
fs.appendFileSync(file, usage(2e5))
if (scan('append') !== both) throw new Error('append: the new tail was dropped or double-counted')
console.log('ok append resumes from the cached offset, exactly once')

// a redraw with nothing appended must reuse the cache, not rescan and rewrite it
const idleCache = path.join(os.tmpdir(), 'claude-statusline-test-idle.json')
scan('idle')
const past = new Date(Date.now() - 3600e3)
fs.utimesSync(idleCache, past, past) // a rewrite would stamp it with now
scan('idle')
if (Math.abs(fs.statSync(idleCache).mtimeMs - past.getTime()) > 1000)
  throw new Error('an idle redraw rescanned and rewrote the cache')
console.log('ok an idle redraw leaves the cache untouched')

// a shorter file cannot mean the cached total is still ours
fs.writeFileSync(file, usage(1e5) + usage(2e5))
scan('shrink')
fs.writeFileSync(file, usage(7e5))
if (scan('shrink') !== cold()) throw new Error('shrink: a shorter transcript kept its cached total')
console.log('ok a shorter transcript is rescanned')

// same length, different bytes: only the mtime gives it away
fs.writeFileSync(file, usage(3e5))
const moved = new Date(Date.now() + 5000) // force a distinguishable mtime
fs.utimesSync(file, moved, moved)
if (scan('shrink') !== cold()) throw new Error('rewrite: an equal-length replacement kept its cached total')
console.log('ok an equal-length rewrite is rescanned')

// a half-written line waits for its newline, then counts once
fs.writeFileSync(file, usage(1e5))
scan('partial')
const half = usage(2e5)
fs.appendFileSync(file, half.slice(0, -1))
if (scan('partial') !== cold()) throw new Error('partial: counted a line before it was complete')
fs.appendFileSync(file, '\n')
if (scan('partial') !== cold()) throw new Error('partial: the completed line was dropped or double-counted')
console.log('ok a half-written line waits for its newline')

// --- the bar gives up width on a narrow terminal ------------------------------
const wide_file = path.join(os.tmpdir(), 'statusline-test-wide.jsonl')
fs.writeFileSync(wide_file, JSON.stringify({
  message: { usage: { input_tokens: 125800, output_tokens: 2100, cache_creation_input_tokens: 0, cache_read_input_tokens: 2e6 } },
}) + '\n')
const ctx = {
  model, transcript_path: wide_file,
  context_window: { context_window_size: 200000, total_input_tokens: 125800 },
}
const wide = run(ctx)
const tight = run(ctx, 80)
const cells = s => (s.match(/[█░▏▎▍▌▋▊▉]/g) || []).length
if (tight.length > 80) throw new Error(`COLUMNS=80 still rendered ${tight.length} columns`)
if (tight.includes('cached')) throw new Error('COLUMNS=80 kept the cache detail')
if (cells(tight) >= cells(wide)) throw new Error('the bar did not give up width either')
for (const keep of ['deepseek-v4-pro', '63%', '¥'])
  if (!tight.includes(keep)) throw new Error(`COLUMNS=80 dropped ${keep}`)
if (cells(run(ctx, 400)) !== cells(wide)) throw new Error('a wide terminal stretched the bar past MAXW')
console.log(`ok COLUMNS: ${wide.length} cols -> ${tight.length} cols, bar ${cells(wide)} -> ${cells(tight)} cells`)

sweep()
fs.unlinkSync(wide_file)
fs.unlinkSync(file)
fs.unlinkSync(t)
