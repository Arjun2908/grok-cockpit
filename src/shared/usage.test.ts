import { describe, expect, it } from 'vitest'
import { formatUsd, parseGrokUsage, usdFromTicks } from './usage'

describe('usage', () => {
  it('converts ticks to dollars', () => {
    expect(usdFromTicks(88747440000)).toBeCloseTo(8.874744)
  })

  it('formats usd', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(0.0042)).toBe('$0.0042')
    expect(formatUsd(8.874)).toBe('$8.87')
  })

  it('parses grok usage json', () => {
    const usage = parseGrokUsage(
      JSON.stringify({
        sessionId: 'abc',
        session: {
          costUsdTicks: 88747440000,
          turnCount: 5,
          totalTokens: 100,
          primaryModelId: 'grok-4.6'
        }
      })
    )
    expect(usage?.sessionId).toBe('abc')
    expect(usage?.usd).toBeCloseTo(8.874744)
    expect(usage?.turnCount).toBe(5)
  })
})
