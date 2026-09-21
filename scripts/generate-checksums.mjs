import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const releaseDir = process.argv[2] || 'release'
const entries = (await readdir(releaseDir))
  .filter((entry) =>
    entry.endsWith('.dmg') ||
    entry.endsWith('.zip') ||
    entry.endsWith('.zip.blockmap') ||
    entry === 'latest-mac.yml'
  )
  .sort((left, right) => left.localeCompare(right))

if (!entries.some((entry) => entry.endsWith('.dmg')) || !entries.some((entry) => entry.endsWith('.zip'))) {
  throw new Error('Cannot generate checksums without both DMG and ZIP artifacts')
}

const lines = []
for (const entry of entries) {
  const contents = await readFile(join(releaseDir, entry))
  lines.push(`${createHash('sha256').update(contents).digest('hex')}  ${entry}`)
}

await writeFile(join(releaseDir, 'SHA256SUMS'), `${lines.join('\n')}\n`, 'utf8')
console.log(`Generated SHA256SUMS for ${entries.length} release assets`)
