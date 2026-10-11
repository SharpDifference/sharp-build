import type { MiniGameDef } from '../minigames'

const BOWLING: MiniGameDef = {
  id: 'bowling',
  modId: 'bowling',
  name: 'Bowling',
  icon: '🎳',
  blurb:
    'ten-pin bowling on a short lane: two balls a frame at ten pins, strikes and spares scored as they are in any alley',
  format:
    'Ten-pin bowling. Each frame a bowler has two balls at ten pins; all ten with the first is a strike and scores ten plus the next two balls, all ten with both is a spare and scores ten plus the next ball, and in the last frame a strike or a spare earns the extra balls to settle it. The two take alternate frames, the reader first, each bowling the same number of frames, and the higher total wins; level totals are a draw.',
  options: [
    {
      id: 'frames',
      describe: 'how many frames each bowler plays: 10 is a full game, fewer is a quick one',
      min: 3,
      max: 10,
      default: 5
    }
  ],
  // Lanes are where the lanes are: City Life's bowling alley where that mod is on, and the
  // arcade's own short lanes either way. A place no playthrough has is simply never stood in.
  locations: ['bowling_alley', 'btb_arcade'],
  suggest: 'sometimes',
  suggestAt: { bowling_alley: 'often', btb_arcade: 'sometimes' },
  surface: 'board',
  keys: true,
  players: { min: 0, max: 1 },
  skillBrief:
    'A good bowler has the coordination and the practice to put the ball in the pocket time after time, the strength to carry the pins and the focus to pick up her spares; a poor one sprays it about and finds the gutter.'
}

export default BOWLING
