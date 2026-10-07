// Claude Code status line: context progress bar + session token totals in ¥.
// Reads statusline JSON on stdin; cumulative tokens and cost come from the
// transcript JSONL (every assistant entry carries message.usage).
// Prices: ¥/M tokens [cache-hit, cache-miss, output]; deepseek peak = Mon-Fri
// 01:00-04:00 and 06:00-10:00 UTC. Add or edit models in PRICES below.
// ponytail: reparses the whole transcript each run and uses a fixed 7.2 USD/CNY
// rate for models not in PRICES; cache or reprice if that ever matters.
const fs = require('fs')

// Ids are matched literally -- one row per model id, nothing is folded together.
// A renamed id is meant to show up as unpriced, and test.cjs fails until you add
// it here, rather than quietly using another model's rate.
// DeepSeek rows are the published USD rates × USD_CNY: $0.006/$0.30/$1.20 per M
// for Flash, $0.044/$1.32/$3.96 for V4-Pro, off-peak exactly half.
// ponytail: no Chinese-holiday calendar, so holidays are billed at peak rates here.
const PRICES = {
  'deepseek-flash': peak => peak ? [0.0432, 2.16, 8.64] : [0.0216, 1.08, 4.32],
  'deepseek-v4.1-flash': peak => peak ? [0.0432, 2.16, 8.64] : [0.0216, 1.08, 4.32],
  'deepseek-v4.1-flash-expires-on-0910': peak => peak ? [0.0432, 2.16, 8.64] : [0.0216, 1.08, 4.32],
  'deepseek-v4-pro': peak => peak ? [0.3168, 9.504, 28.512] : [0.1584, 4.752, 14.256],
  'qwen3.8-flash': [0.1, 0.8, 2.7],
  'glm-5.3-flash': [0.23, 0.8, 2.8],
  'mimo-v2.6-pro': [0.025, 3, 6],
  'mimo-v2.6-flash': [0.02, 1, 2],
}
const USD_CNY = 7.2

let raw = ''
process.stdin.on('data', d => (raw += d))
process.stdin.on('end', () => {
  let j = {}
  try { j = JSON.parse(raw) } catch {}

  const C = s => `\x1b[${s}m`, R = '\x1b[0m'
  const dim = t => C('90') + t + R
  const fmt = n => n >= 1e6 ? Number((n / 1e6).toFixed(1)) + 'M' : n >= 1e3 ? Number((n / 1e3).toFixed(1)) + 'k' : String(n)
  const d = new Date()
  const p2 = n => String(n).padStart(2, '0')
  const now = `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`

  // context bar: input side (incl. cache) over the window, like /context
  const cw = j.context_window || {}
  const win = cw.context_window_size || 200000
  const used = cw.total_input_tokens || 0
  const pct = Math.min(100, Math.round((used / win) * 100))
  const W = 14, fill = Math.round((pct / 100) * W)
  const color = pct < 50 ? '32' : pct < 80 ? '33' : '31'
  const bar = C(color) + '█'.repeat(fill) + dim('░'.repeat(W - fill))

  // session-cumulative: 输入 = fresh input (incl. cache writes), 缓存 = cache reads
  let fresh = 0, cacheWrite = 0, cacheRead = 0, out = 0
  try {
    for (const line of fs.readFileSync(j.transcript_path, 'utf8').split('\n')) {
      if (!line.trim()) continue
      let o; try { o = JSON.parse(line) } catch { continue }
      const u = o && o.message && o.message.usage
      if (u) {
        fresh += u.input_tokens || 0
        cacheWrite += u.cache_creation_input_tokens || 0
        cacheRead += u.cache_read_input_tokens || 0
        out += u.output_tokens || 0
      }
    }
  } catch {} // no transcript yet

  // cost in ¥: per-model price table, else the client's USD estimate converted.
  // `id` and `display_name` can disagree, so try both; the only thing stripped is
  // the [1m] context marker, which is not part of the model name.
  const m = j.model || {}
  const norm = s => (s || '').replace(/\[1m\]$/, '')
  const id = [m.id, m.display_name].map(norm).find(k => PRICES[k]) || norm(m.display_name || m.id)
  const p = PRICES[id]
  let cost
  if (p) {
    // deepseek peak is defined in UTC, not local time
    const d = new Date(), h = d.getUTCHours(), day = d.getUTCDay()
    const peak = day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
    const [hit, inp, outp] = typeof p === 'function' ? p(peak) : p
    cost = ((fresh + cacheWrite) * inp + cacheRead * hit + out * outp) / 1e6
  } else {
    cost = ((j.cost && j.cost.total_cost_usd) || 0) * USD_CNY
  }

  const parts = [
    dim(id),
    `${bar} ${C(color)}${pct}%${R} ${dim(fmt(used) + '/' + fmt(win))}`,
    dim('in ') + fmt(fresh + cacheWrite) + dim(' (cached ') + fmt(cacheRead) + dim(')'),
    dim('out ') + fmt(out),
    dim('¥') + (cost >= 1 ? cost.toFixed(2) : cost.toFixed(3)),
    dim(now),
  ]
  process.stdout.write(parts.filter(Boolean).join(dim(' │ ')))
})
