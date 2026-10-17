import { describe, expect, it } from 'vitest'
import { placeOf } from '../src/renderer/minigames/place'

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

describe("a place City Life adds", () => {
  it('is a place only where the playthrough has City Life', async () => {
    const { setCityLifeEnabled } = await import('@shared/cityLife')
    setCityLifeEnabled(true, true)
    expect(placeOf('the student lanes', 'bowling_alley')).toBe('bowling_alley')
    expect(placeOf('bowling', null)).toBe('bowling_alley')
    setCityLifeEnabled(false, false)
    expect(placeOf('bowling', null)).toBeNull()
    expect(placeOf('the student lanes', 'bowling_alley')).toBeNull()
  })
})
