import { describe, expect, it } from 'vitest'
import {
  duplicateCwdWarning,
  implementTicketPrompt,
  parseTicketId,
  ticketSlug,
  worktreePathForSlug
} from './ticket'

describe('parseTicketId', () => {
  it('parses team and number', () => {
    expect(parseTicketId('ava-1031')).toEqual({ team: 'AVA', number: 1031 })
  })

  it('rejects junk', () => {
    expect(parseTicketId('not-a-ticket')).toBeNull()
  })
})

describe('ticketSlug', () => {
  it('lowercases Linear identifiers', () => {
    expect(ticketSlug('AVA-1031')).toBe('ava-1031')
  })
})

describe('worktreePathForSlug', () => {
  it('uses Nutshell /private/tmp convention', () => {
    expect(worktreePathForSlug('ava-1031')).toBe('/private/tmp/ava-1031-wt')
  })
})

describe('implementTicketPrompt', () => {
  it('builds slash invocation with flags', () => {
    expect(implementTicketPrompt('ava-12', { planOnly: true, paired: true })).toBe(
      '/implement-ticket AVA-12 --plan-only --paired'
    )
  })
})

describe('duplicateCwdWarning', () => {
  it('warns when two tabs share a path', () => {
    expect(duplicateCwdWarning(['/repo', '/repo/'])).toMatch(/PHPUnit/)
  })

  it('is silent for distinct worktrees', () => {
    expect(duplicateCwdWarning(['/private/tmp/a-wt', '/private/tmp/b-wt'])).toBeNull()
  })
})
