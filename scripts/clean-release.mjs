import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const releaseDirectory = resolve('release')
const expectedDirectory = join(process.cwd(), 'release')

if (releaseDirectory !== expectedDirectory) {
  throw new Error(`Refusing to clean unexpected path: ${releaseDirectory}`)
}

await rm(releaseDirectory, { recursive: true, force: true })
console.log(`Cleaned ${releaseDirectory}`)
