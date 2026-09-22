import { describe, expect, it } from 'vitest'
import { parseReadme } from './readme'

describe('parseReadme', () => {
  it('parses headings, lists, and code fences', () => {
    const blocks = parseReadme(`# Title

Intro **bold** and \`code\`.

## Daily use

- **⌘T** — new session

\`\`\`bash
npm run dev
\`\`\`
`)
    expect(blocks[0]).toEqual({ type: 'h1', text: 'Title' })
    expect(blocks[1].type).toBe('p')
    expect(blocks[2]).toEqual({ type: 'h2', text: 'Daily use' })
    expect(blocks[3]).toEqual({ type: 'ul', items: ['**⌘T** — new session'] })
    expect(blocks[4]).toEqual({ type: 'code', text: 'npm run dev' })
  })

  it('skips HTML lines that only render on GitHub', () => {
    const blocks = parseReadme(`<div align="center">

<img src="build/icon.png" width="128">

</div>

Body text.`)
    expect(blocks).toEqual([{ type: 'p', text: 'Body text.' }])
  })

  it('parses h3, ordered lists, and tables', () => {
    const blocks = parseReadme(`### Feature.
One line.

1. Download
2. Open

| Shortcut | Action |
| :-- | :-- |
| <kbd>⌘T</kbd> | New session |
| <kbd>⌘W</kbd> | Close tab |`)
    expect(blocks).toEqual([
      { type: 'h3', text: 'Feature.' },
      { type: 'p', text: 'One line.' },
      { type: 'ol', items: ['Download', 'Open'] },
      {
        type: 'table',
        header: ['Shortcut', 'Action'],
        rows: [
          ['<kbd>⌘T</kbd>', 'New session'],
          ['<kbd>⌘W</kbd>', 'Close tab']
        ]
      }
    ])
  })

  it('treats unsupported heading levels as text instead of stalling', () => {
    expect(parseReadme('#### Deep')).toEqual([{ type: 'p', text: '#### Deep' }])
  })
})
