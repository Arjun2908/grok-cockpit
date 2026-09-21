import { CURATED_SKILLS, type SkillInfo } from './types'

export function mergeSkills(discovered: SkillInfo[]): SkillInfo[] {
  const byName = new Map<string, SkillInfo>()
  for (const skill of CURATED_SKILLS) byName.set(skill.name, skill)
  for (const skill of discovered) {
    if (!skill.userInvocable) continue
    if (byName.has(skill.name)) continue
    byName.set(skill.name, skill)
  }
  return [...byName.values()]
}

export function skillPrompt(name: string, extra = ''): string {
  const arg = extra.trim()
  return arg ? `/${name} ${arg}` : `/${name}`
}

export function parsePaletteQuery(raw: string): { name: string; extra: string } {
  const trimmed = raw.trim().replace(/^\//, '')
  const space = trimmed.indexOf(' ')
  if (space === -1) return { name: trimmed, extra: '' }
  return { name: trimmed.slice(0, space), extra: trimmed.slice(space + 1) }
}

export function filterSkills(skills: SkillInfo[], query: string): SkillInfo[] {
  const parsed = parsePaletteQuery(query)
  const q = (parsed.name || query.trim()).toLowerCase()
  if (!q) return skills
  return skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q)
  )
}
