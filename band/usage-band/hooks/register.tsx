import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Totals } from '../types'

// ¥/M tokens [cache-hit, input, output]; deepseek peak = Mon-Fri 9-12/14-18.
// Same table as the statusline.cjs install; edit both together.
const PRICES: Record<
  string,
  [number, number, number] | ((peak: boolean) => [number, number, number])
> = {
  'deepseek-v4.1-flash': peak => (peak ? [0.04, 2, 8] : [0.02, 1, 4]),
  'qwen3.8-flash': [0.1, 0.8, 2.7],
  'glm-5.3-flash': [0.23, 0.8, 2.8],
  'mimo-v2.6-pro': [0.025, 3, 6],
  'mimo-v2.6-flash': [0.02, 1, 2],
}

const EMPTY: Totals = { fresh: 0, cacheWrite: 0, cacheRead: 0, out: 0, cost: 0, unpriced: 0 }
const totals = atom({ plugin: 'usage-band', key: 'totals' } as const, EMPTY)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, '')

const stamp = (): string => {
  const d = new Date()
  const p2 = (n: number): string => String(n).padStart(2, '0')
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const fmt = (n: number): string =>
  n >= 1e6 ? Number((n / 1e6).toFixed(1)) + 'M' : n >= 1e3 ? Number((n / 1e3).toFixed(1)) + 'k' : String(n)

type Usage = {
  input_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  output_tokens: number
}

// per-turn cost in ¥; NaN when the model is off the price table
function costOf(model: string, u: Usage): number {
  const rates = PRICES[model.replace(/\[1m\]$/, '')]
  if (!rates) return NaN
  const h = new Date().getHours()
  const day = new Date().getDay()
  const peak = day >= 1 && day <= 5 && ((h >= 9 && h < 12) || (h >= 14 && h < 18))
  const [hit, inp, outp] = typeof rates === 'function' ? rates(peak) : rates
  return ((u.input_tokens + u.cache_creation_input_tokens) * inp + u.cache_read_input_tokens * hit + u.output_tokens * outp) / 1e6
}

// both hooks below refresh once per interaction; nothing runs on a timer
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, now, () => stamp())
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u) {
      const c = costOf(u.model, u)
      const priced = isFinite(c)
      await update($, totals, t => ({
        fresh: t.fresh + u.input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        out: t.out + u.output_tokens,
        cost: t.cost + (priced ? c : 0),
        unpriced: t.unpriced + (priced ? 0 : 1),
      }))
    }
    await update($, now, () => stamp())
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const t = await read($, totals)
    const { Box, Text } = $.ui.resolve(e)

    // live context window; absent until the first response of the window
    let pct = 0
    let ctx: string | null = null
    let model = ''
    try {
      const u = await $.session.usage()
      pct = u.context.percent ?? 0
      ctx = `${fmt(u.context.tokens ?? 0)}/${fmt(u.context.window)}`
      model = (await $.session.model()).replace(/\[1m\]$/, '')
    } catch {}

    const W = 14
    const filled = Math.round((pct / 100) * W)
    const color = pct < 50 ? 'green' : pct < 80 ? 'yellow' : 'red'

    return (
      <Box>
        {ctx && model && (
          <Text dimColor>
            {model + ' │ '}
          </Text>
        )}
        {ctx && (
          <Text color={color}>
            {'█'.repeat(filled)}
          </Text>
        )}
        {ctx && (
          <Text dimColor>
            {'░'.repeat(W - filled)} {pct}% {ctx}{' '}
          </Text>
        )}
        <Text dimColor>
          │ in {fmt(t.fresh + t.cacheWrite)} (cached {fmt(t.cacheRead)}) │ out {fmt(t.out)} │ ¥
          {t.cost >= 1 ? t.cost.toFixed(2) : t.cost.toFixed(3)}
          {t.unpriced > 0 ? '+' : ''}
          {t.now ? ' ' + t.now : ''}
        </Text>
      </Box>
    )
  })
}
