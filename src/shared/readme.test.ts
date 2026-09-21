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
})
