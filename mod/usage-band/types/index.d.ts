export type Totals = {
  fresh: number
  cacheWrite: number
  cacheRead: number
  out: number
  cost: number
  unpriced: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { totals: Totals; now: string }
  }
}
