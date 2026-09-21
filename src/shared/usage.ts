export type SessionUsage = {
  sessionId: string
  usd: number
  turnCount: number
  totalTokens: number
  model?: string
}

export function usdFromTicks(ticks: number): number {
  return ticks / 1e10
}

export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 10) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(2)}`
}

export function parseGrokUsage(jsonText: string): SessionUsage | null {
  try {
    const payload = JSON.parse(jsonText) as {
      sessionId?: string
      session?: {
        costUsdTicks?: number
        turnCount?: number
        totalTokens?: number
        primaryModelId?: string
      }
    }
    if (!payload.sessionId || !payload.session) return null
    return {
      sessionId: payload.sessionId,
      usd: usdFromTicks(Number(payload.session.costUsdTicks ?? 0)),
      turnCount: Number(payload.session.turnCount ?? 0),
      totalTokens: Number(payload.session.totalTokens ?? 0),
      model: payload.session.primaryModelId
    }
  } catch {
    return null
  }
}
