import { describe, expect, it } from 'vitest'
import { dedupeMcpHealth, parseInspectSkills, parseMcpDoctor } from './mcp'
import { filterSkills, mergeSkills, parsePaletteQuery, skillPrompt } from './skills'

describe('parseMcpDoctor', () => {
  it('maps healthy and failed servers', () => {
    const health = parseMcpDoctor(
      JSON.stringify({
        servers: [
          {
            name: 'linear',
            healthy: true,
            checks: [{ label: 'handshake OK', passed: true }]
          },
          {
            name: 'figma',
            healthy: false,
            checks: [{ label: 'disabled in config', passed: false, detail: 'off' }]
          }
        ]
      })
    )
    expect(health[0]).toEqual({ name: 'linear', healthy: true, detail: 'handshake OK' })
    expect(health[1].healthy).toBe(false)
    expect(health[1].detail).toContain('disabled')
  })
})

describe('parseInspectSkills', () => {
  it('keeps user-invocable flags', () => {
    const skills = parseInspectSkills(
      JSON.stringify({
        skills: [{ name: 'bugfix', description: 'fix', userInvocable: true }]
      })
    )
    expect(skills[0].name).toBe('bugfix')
  })
})

describe('skills helpers', () => {
  it('merges curated names first', () => {
    const merged = mergeSkills([
      { name: 'implement-ticket', description: 'dup', userInvocable: true },
      { name: 'create-delta', description: 'schema', userInvocable: true }
    ])
    expect(merged[0].name).toBe('implement-ticket')
    expect(merged.some((s) => s.name === 'create-delta')).toBe(true)
  })

  it('builds slash prompts', () => {
    expect(skillPrompt('plan')).toBe('/plan')
    expect(skillPrompt('implement-ticket', 'AVA-1')).toBe('/implement-ticket AVA-1')
  })

  it('filters by query', () => {
    expect(filterSkills(mergeSkills([]), 'compact').map((s) => s.name)).toEqual(['compact'])
  })

  it('parses palette args', () => {
    expect(parsePaletteQuery('/implement-ticket AVA-12 --paired')).toEqual({
      name: 'implement-ticket',
      extra: 'AVA-12 --paired'
    })
  })
})

describe('dedupeMcpHealth', () => {
  it('keeps the healthy duplicate', () => {
    const deduped = dedupeMcpHealth([
      { name: 'Figma', healthy: false, detail: 'off' },
      { name: 'figma', healthy: true, detail: 'ok' }
    ])
    expect(deduped).toHaveLength(1)
    expect(deduped[0].healthy).toBe(true)
  })
})
