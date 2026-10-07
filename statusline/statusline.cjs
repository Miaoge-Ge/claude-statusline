// Claude Code status line: context progress bar + session token totals in ¥.
// Reads statusline JSON on stdin; cumulative tokens and cost come from the
// transcript JSONL (every assistant entry carries message.usage) -- nothing in
// the statusline JSON reports session token totals, and `cost.total_cost_usd`
// prices at Anthropic list rates, so it is wrong for every model in PRICES.
// Prices: ¥/M tokens [cache-hit, cache-miss, output]; deepseek peak = Mon-Fri
// 01:00-04:00 and 06:00-10:00 UTC. Add or edit models in PRICES below; a model
// that is not listed shows no cost at all rather than a guessed one.
const fs = require('fs'), os = require('os'), path = require('path')

// Ids are matched literally -- one row per model id, nothing is folded together.
// A renamed id is meant to show up as unpriced, and test.cjs fails until you add
// it here, rather than quietly using another model's rate.
// DeepSeek rows are the published USD rates × 7.2: $0.006/$0.30/$1.20 per M for
// Flash, $0.044/$1.32/$3.96 for V4-Pro, off-peak exactly half. The three Flash
// ids are the same rates, so one function backs all three rows.
// ponytail: no Chinese-holiday calendar, so holidays are billed at peak rates here.
const DS_FLASH = peak => peak ? [0.0432, 2.16, 8.64] : [0.0216, 1.08, 4.32]
const PRICES = {
  'deepseek-flash': DS_FLASH,
  'deepseek-v4.1-flash': DS_FLASH,
  'deepseek-v4.1-flash-expires-on-0910': DS_FLASH,
  'deepseek-v4-pro': peak => peak ? [0.3168, 9.504, 28.512] : [0.1584, 4.752, 14.256],
  'qwen3.8-flash': [0.1, 0.8, 2.7],
  'glm-5.3-flash': [0.23, 0.8, 2.8],
  'mimo-v2.6-pro': [0.025, 3, 6],
  'mimo-v2.6-flash': [0.02, 1, 2],
}

// test.cjs requires this file to get the id list; run as a script it reads stdin.
module.exports = { PRICES }
if (require.main !== module) return

let raw = ''
process.stdin.on('data', d => (raw += d))
process.stdin.on('end', () => {
  let j = {}
  try { j = JSON.parse(raw) } catch {}

  const C = s => `\x1b[${s}m`, R = '\x1b[0m'
  const dim = t => C('90') + t + R
  const bold = t => C('1') + t + R
  const fmt = n => n >= 1e6 ? Number((n / 1e6).toFixed(1)) + 'M' : n >= 1e3 ? Number((n / 1e3).toFixed(1)) + 'k' : String(n)
  const d = new Date()
  const p2 = n => String(n).padStart(2, '0')
  const now = `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`

  // context bar: input side (incl. cache) over the window, like /context
  const cw = j.context_window || {}
  const win = cw.context_window_size || 200000
  const used = cw.total_input_tokens || 0
  const pct = Math.min(100, Math.round((used / win) * 100))
  const color = pct < 50 ? '32' : pct < 80 ? '33' : '31'

  // Every cell splits into eighths, so the bar moves in ~0.9% steps, not 7%.
  const MAXW = 14, EIGHTHS = '▏▎▍▌▋▊▉'
  const bar = w => {
    const e = Math.round((pct / 100) * w * 8), full = Math.floor(e / 8), eighth = e % 8
    return C(color) + '█'.repeat(full) + (eighth ? EIGHTHS[eighth - 1] : '') + R
      + dim('░'.repeat(Math.max(0, w - full - (eighth ? 1 : 0))))
  }

  // session-cumulative: 输入 = fresh input (incl. cache writes), 缓存 = cache reads
  // The transcript only ever grows, so the running totals and the byte offset they
  // cover are cached per session and each run parses just the appended tail. On a
  // 26 MB transcript the scan is ~26 ms of the ~80 ms a redraw costs; the other 54
  // is node starting up, which nothing here can help. Anything suspicious -- no
  // cache, a shrunken file, a resume point that is not just past a newline -- falls
  // back to scanning the whole thing, because a wrong total is worse than a slow one.
  let fresh = 0, cacheWrite = 0, cacheRead = 0, out = 0
  const tp = j.transcript_path
  const cache = path.join(os.tmpdir(), 'claude-statusline-' +
    String(j.session_id || 'nosession').replace(/[^\w-]/g, '') + '.json')
  const onLineStart = (fd, off) => {
    if (!off) return true
    const b = Buffer.alloc(1)
    fs.readSync(fd, b, 0, 1, off - 1)
    return b[0] === 10 // '\n'
  }
  try {
    const fd = fs.openSync(tp, 'r')
    const st = fs.fstatSync(fd)
    let from = 0
    try {
      const c = JSON.parse(fs.readFileSync(cache, 'utf8'))
      // Same path, and either it grew (resume from the offset) or it is the same
      // file untouched (reuse as-is). Equal length with a newer mtime means it was
      // rewritten, so those totals are not ours.
      const ok = c.path === tp &&
        (c.size < st.size || (c.size === st.size && c.mtime === st.mtimeMs))
      if (ok && onLineStart(fd, c.size)) {
        fresh = c.fresh; cacheWrite = c.cacheWrite; cacheRead = c.cacheRead; out = c.out
        from = c.size
      }
    } catch {} // no cache yet
    const buf = Buffer.allocUnsafe(st.size - from)
    const n = fs.readSync(fd, buf, 0, buf.length, from)
    const mtime = fs.fstatSync(fd).mtimeMs
    fs.closeSync(fd)
    const text = buf.toString('utf8', 0, n)
    const nl = text.lastIndexOf('\n') // never consume a line still being written
    const done = nl < 0 ? '' : text.slice(0, nl + 1)
    for (const line of done.split('\n')) {
      // every entry with usage has the literal `"usage"`; skipping the rest first
      // keeps JSON.parse off the user/tool/system lines, which are most of them
      if (!line.includes('"usage"')) continue
      let o; try { o = JSON.parse(line) } catch { continue }
      const u = o && o.message && o.message.usage
      if (u) {
        fresh += u.input_tokens || 0
        cacheWrite += u.cache_creation_input_tokens || 0
        cacheRead += u.cache_read_input_tokens || 0
        out += u.output_tokens || 0
      }
    }
    if (done) fs.writeFileSync(cache, JSON.stringify({
      path: tp, size: from + Buffer.byteLength(done), mtime,
      fresh, cacheWrite, cacheRead, out,
    }))
  } catch {} // no transcript yet

  // cost in ¥, or null when the model is not in PRICES -- an unlisted model shows
  // no cost rather than a guessed one. `id` and `display_name` can disagree, so
  // try both; the only thing stripped is the [1m] context marker.
  const m = j.model || {}
  const norm = s => (s || '').replace(/\[1m\]$/, '')
  const id = [m.id, m.display_name].map(norm).find(k => PRICES[k]) || norm(m.display_name || m.id)
  const p = PRICES[id]
  let cost = null
  if (p) {
    // deepseek peak is defined in UTC, not local time
    const h = d.getUTCHours(), day = d.getUTCDay()
    const peak = day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
    const [hit, inp, outp] = typeof p === 'function' ? p(peak) : p
    cost = ((fresh + cacheWrite) * inp + cacheRead * hit + out * outp) / 1e6
  }

  // labels dim, values default-weight, the four things you actually look at
  // (model, bar, cost, clock) carry the colour
  const render = (w, detail) => [
    C('1;36') + id + R,
    `${bar(w)} ${C('1;' + color)}${pct}%${R} ${dim(fmt(used) + '/' + fmt(win))}`,
    dim('in ') + bold(fmt(fresh + cacheWrite)) +
      (cacheRead && detail ? dim(' (cached ') + fmt(cacheRead) + dim(')') : ''),
    dim('out ') + bold(fmt(out)),
    cost === null ? '' : C('1;33') + '¥' + (cost >= 1 ? cost.toFixed(2) : cost.toFixed(3)) + R,
    dim(now),
  ]
  const plain = s => s.replace(/\x1b\[[\d;]*m/g, '') // ANSI costs no columns
  const line = (w, detail) => render(w, detail).filter(Boolean).join(dim(' │ '))
  // Claude Code sets COLUMNS to the terminal width. The bar is the whole point and
  // the cache detail is a footnote, so spend the footnote first, then the bar --
  // anything rather than wrap to a second row.
  const cols = Number(process.env.COLUMNS) || 0
  let barW = MAXW, detail = true
  if (cols && plain(line(MAXW, true)).length > cols) {
    detail = false
    const noDetail = plain(line(MAXW, false)).length
    if (noDetail > cols) barW = Math.max(0, Math.min(MAXW, MAXW - (noDetail - cols)))
  }
  process.stdout.write(line(barW, detail))
})
