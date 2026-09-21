import { describe, expect, it } from 'vitest'
import { GROK_NEWLINE, isNewlineChord } from './keys'

describe('isNewlineChord', () => {
  it('treats Shift+Enter and Alt+Enter as newline', () => {
    expect(isNewlineChord({ key: 'Enter', shiftKey: true, altKey: false, metaKey: false, ctrlKey: false })).toBe(true)
    expect(isNewlineChord({ key: 'Enter', shiftKey: false, altKey: true, metaKey: false, ctrlKey: false })).toBe(true)
  })

  it('does not steal plain Enter or Cmd+Enter', () => {
    expect(isNewlineChord({ key: 'Enter', shiftKey: false, altKey: false, metaKey: false, ctrlKey: false })).toBe(false)
    expect(isNewlineChord({ key: 'Enter', shiftKey: true, altKey: false, metaKey: true, ctrlKey: false })).toBe(false)
  })

  it('uses the Alt+Enter fallback sequence', () => {
    expect(GROK_NEWLINE).toBe('\x1b\r')
  })
})
