import { describe, expect, it } from 'vitest'
import { hereLine, placeOf } from '../src/renderer/minigames/place'

describe("the mini-games' place for a scene", () => {
  it('takes an id the classifier gave', () => {
    expect(placeOf('btb_arcade', null)).toBe('btb_arcade')
  })

  it("reads a place's own words against its lorebook keys", () => {
    expect(placeOf('arcade', null)).toBe('btb_arcade')
    expect(placeOf('the arcade downtown', null)).toBe('btb_arcade')
  })

  it("falls back on the scene's background when the words name no place", () => {
    expect(placeOf('the student lanes', 'arcade')).toBe('btb_arcade')
    expect(placeOf('', 'cutetea')).toBe('cutetea')
  })

  it('is null where neither says where it is', () => {
    expect(placeOf('somewhere quiet', null)).toBeNull()
    expect(placeOf(null, null)).toBeNull()
  })
})

describe('a game played where the scene is', () => {
  it('tells the model the game is here and the background stays', () => {
    expect(hereLine('btb_arcade').join(' ')).toMatch(/right here at BTB Arcade.*background stays/)
    expect(hereLine(null)).toEqual([])
  })
})
