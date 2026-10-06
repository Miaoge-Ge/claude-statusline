// Claude Code status line: context progress bar + session token totals in ¥.
// Reads statusline JSON on stdin; cumulative tokens and cost come from the
// transcript JSONL (every assistant entry carries message.usage).
// Prices: ¥/M tokens [cache-hit, input, output]; deepseek peak = Mon-Fri
// 9-12/14-18. Add or edit models in PRICES below.
// ponytail: reparses the whole transcript each run and uses a fixed 7.2 USD/CNY
// rate for models not in PRICES; cache or reprice if that ever matters.
const fs = require('fs')

const PRICES = {
  'deepseek-v4.1-flash': peak => peak ? [0.04, 2, 8] : [0.02, 1, 4],
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

  // cost in ¥: per-model price table, else the client's USD estimate converted
  const model = (j.model && (j.model.display_name || j.model.id)) || ''
  const id = model.replace(/\[1m\]$/, '')
  const p = PRICES[id]
  let cost
  if (p) {
    const h = new Date().getHours(), day = new Date().getDay()
    const peak = day >= 1 && day <= 5 && ((h >= 9 && h < 12) || (h >= 14 && h < 18))
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
