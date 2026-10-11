import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A game pack is self-contained: beyond its own files it uses React, `motion`, and the two kits
 * the framework offers, and nothing else of the game. That is what lets the game change
 * underneath without a pack noticing, and lets anyone's pack be dropped in beside another's.
 */

const ROOT = join(__dirname, '..', 'src')

/** Every `from '...'` and bare `import '...'` in a file. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((match) => match[1])
}

function filesIn(folder: string, ending: string): string[] {
  return readdirSync(join(ROOT, folder))
    .filter((name) => name.endsWith(ending))
    .map((name) => join(ROOT, folder, name))
}

/** A pack's own rules, and its own stylesheet. */
const OWN = /^(@shared\/minigameRules\/|\.\/[A-Za-z]+$|\.\.\/\.\.\/vu_styles\/[A-Za-z]+\.css$)/

describe('a game pack reaches for nothing outside the kits', () => {
  it('in what it draws', () => {
    const allowed = new Set(['react', 'motion/react', '../kit', '@shared/minigameKit'])
    for (const file of filesIn('renderer/minigames/games', '.tsx')) {
      const strays = importsOf(file).filter((source) => !allowed.has(source) && !OWN.test(source))
      expect(strays, file).toEqual([])
    }
  })

  it('in its rules', () => {
    for (const file of filesIn('shared/minigameRules', '.ts')) {
      const strays = importsOf(file).filter(
        (source) => source !== '../minigameKit' && !/^\.\/[A-Za-z]+$/.test(source)
      )
      expect(strays, file).toEqual([])
    }
  })

  it('in its games on paper', () => {
    for (const file of filesIn('shared/minigameEntries', '.ts')) {
      const strays = importsOf(file).filter((source) => source !== '../minigameKit')
      expect(strays, file).toEqual([])
    }
  })

  it('and no pack leans on another: rules are shared only through the kit', () => {
    const rules = filesIn('shared/minigameRules', '.ts')
    for (const file of rules) {
      expect(importsOf(file).filter((source) => source.startsWith('./')), file).toEqual([])
    }
  })
})
