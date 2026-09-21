import { describe, expect, it } from 'vitest'
import {
  filterSessions,
  formatSessionDate,
  groupSessions,
  parseGrokSessionsList,
  resolveSessionCwd,
  ticketIdsIn
} from './sessions'

const SAMPLE = `(no label)
SESSION ID                            CREATED     UPDATED     STATUS      SUMMARY
01a0b10e-8e9e-76a0-a090-61015a766769  2026-09-17  2026-09-21  local  Grok CLI setup for Nutshell agentic work
01a0b104-ced4-71f2-931e-93544178c659  2026-09-17  2026-09-17  local  Inquiry About Fast Mode Feature Availability
feat/login
aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee  2026-09-18  2026-09-18  local  Implement login
`

describe('parseGrokSessionsList', () => {
  it('parses ids, summaries, and group labels', () => {
    const sessions = parseGrokSessionsList(SAMPLE)
    expect(sessions).toHaveLength(3)
    expect(sessions[0]).toMatchObject({
      id: '01a0b10e-8e9e-76a0-a090-61015a766769',
      group: '(no label)',
      summary: 'Grok CLI setup for Nutshell agentic work'
    })
    expect(sessions[2].group).toBe('feat/login')
  })

  it('resolves cwd from worktree branch labels', () => {
    const cwd = resolveSessionCwd(
      { group: 'ava-1' },
      '/repo',
      [{ path: '/private/tmp/ava-1-wt', branch: 'ava-1', isMain: false, dirty: false }]
    )
    expect(cwd).toBe('/private/tmp/ava-1-wt')
  })

  it('filters by summary and ticket id', () => {
    const sessions = parseGrokSessionsList(SAMPLE, '/repo')
    sessions[2].summary = 'Implement AVA-12 login'
    sessions[2].cwd = '/private/tmp/ava-12-wt'
    expect(filterSessions(sessions, 'login')).toHaveLength(1)
    expect(filterSessions(sessions, 'ava-12')).toHaveLength(1)
    expect(filterSessions(sessions, '', { filter: 'worktrees', defaultRepo: '/repo' })).toHaveLength(1)
    expect(filterSessions(sessions, '', { filter: 'today', today: '2026-09-21' })).toHaveLength(1)
  })

  it('groups by cwd', () => {
    const sessions = parseGrokSessionsList(SAMPLE, '/repo')
    const groups = groupSessions(sessions, [
      { path: '/repo', branch: 'main', isMain: true, dirty: false }
    ])
    expect(groups[0].label).toBe('repo')
    expect(groups[0].branch).toBe('main')
    expect(groups[0].sessions).toHaveLength(3)
  })

  it('formats dates', () => {
    expect(ticketIdsIn('fix AVA-9 and esc-2')).toEqual(['AVA-9', 'ESC-2'])
    expect(formatSessionDate('2026-09-21', '2026-09-21')).toBe('today')
    expect(formatSessionDate('2026-09-17', '2026-09-21')).toBe('Sep 17')
  })
})
