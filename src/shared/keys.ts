/** Alt+Enter / newline-fallback. Grok treats this as a composer newline when Kitty keyboard protocol is off (xterm.js). */
export const GROK_NEWLINE = '\x1b\r'

export function isNewlineChord(event: { key: string; shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): boolean {
  if (event.key !== 'Enter') return false
  if (event.metaKey || event.ctrlKey) return false
  return event.shiftKey || event.altKey
}
