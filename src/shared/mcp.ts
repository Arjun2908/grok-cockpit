import type { McpServerHealth } from './types'

type DoctorServer = {
  name?: string
  healthy?: boolean
  checks?: Array<{ label?: string; passed?: boolean; detail?: string }>
}

type DoctorPayload = {
  servers?: DoctorServer[]
}

export function parseMcpDoctor(jsonText: string): McpServerHealth[] {
  let payload: DoctorPayload
  try {
    payload = JSON.parse(jsonText) as DoctorPayload
  } catch {
    return []
  }
  const servers = payload.servers ?? []
  return servers
    .filter((server) => typeof server.name === 'string' && server.name.length > 0)
    .map((server) => {
      const failed = (server.checks ?? []).find((check) => check.passed === false)
      const ok = (server.checks ?? []).find((check) => check.passed)
      const detail = failed
        ? `${failed.label ?? 'failed'}${failed.detail ? `: ${failed.detail}` : ''}`
        : ok?.label ?? (server.healthy ? 'ok' : 'unknown')
      return {
        name: server.name as string,
        healthy: Boolean(server.healthy),
        detail
      }
    })
}

export function dedupeMcpHealth(servers: McpServerHealth[]): McpServerHealth[] {
  const byKey = new Map<string, McpServerHealth>()
  for (const server of servers) {
    const key = server.name.toLowerCase()
    const existing = byKey.get(key)
    if (!existing || (!existing.healthy && server.healthy)) byKey.set(key, server)
  }
  return [...byKey.values()]
}

export function parseInspectSkills(jsonText: string): Array<{
  name: string
  description: string
  userInvocable: boolean
}> {
  try {
    const payload = JSON.parse(jsonText) as {
      skills?: Array<{ name?: string; description?: string; userInvocable?: boolean }>
    }
    return (payload.skills ?? [])
      .filter((skill) => typeof skill.name === 'string')
      .map((skill) => ({
        name: skill.name as string,
        description: skill.description ?? '',
        userInvocable: Boolean(skill.userInvocable)
      }))
  } catch {
    return []
  }
}
