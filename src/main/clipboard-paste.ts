import { clipboard, nativeImage } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type PasteResult =
  | { kind: 'image'; path: string; dataUrl: string }
  | { kind: 'text'; text: string }
  | { kind: 'empty' }

export function pasteFromClipboard(): PasteResult {
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const png = image.toPNG()
    const dir = join(tmpdir(), 'grok-cockpit-paste')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, `paste-${Date.now()}.png`)
    writeFileSync(path, png)
    const dataUrl = nativeImage.createFromBuffer(png).toDataURL()
    return { kind: 'image', path, dataUrl }
  }
  const text = clipboard.readText()
  if (text) return { kind: 'text', text }
  return { kind: 'empty' }
}

export function imageFileToDataUrl(path: string): string | null {
  try {
    const image = nativeImage.createFromPath(path)
    if (image.isEmpty()) return null
    return image.toDataURL()
  } catch {
    return null
  }
}
