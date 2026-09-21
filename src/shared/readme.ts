export type ReadmeBlock =
  | { type: 'h1' | 'h2' | 'p'; text: string }
  | { type: 'code'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'checks'; items: Array<{ done: boolean; text: string }> }

export function parseReadme(markdown: string): ReadmeBlock[] {
  const blocks: ReadmeBlock[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i])
        i += 1
      }
      blocks.push({ type: 'code', text: body.join('\n') })
      i += 1
      continue
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2) })
      i += 1
      continue
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) })
      i += 1
      continue
    }
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const items: Array<{ done: boolean; text: string }> = []
      while (i < lines.length && (lines[i].startsWith('- [ ] ') || lines[i].startsWith('- [x] '))) {
        items.push({ done: lines[i].startsWith('- [x] '), text: lines[i].slice(6) })
        i += 1
      }
      blocks.push({ type: 'checks', items })
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    if (!line.trim()) {
      i += 1
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('- ') &&
      !lines[i].startsWith('```')
    ) {
      para.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }
  return blocks
}
