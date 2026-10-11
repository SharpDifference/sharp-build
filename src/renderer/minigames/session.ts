import { create } from 'zustand'

/**
 * What stands between a game being asked for and being played: the reader's proposal while the
 * turn carrying it is out, and the game a girl agreed to until the table opens on it. Neither is
 * saved: a game not yet begun is simply asked for again.
 */

/** A game the reader has asked a girl to play, in the words he asked with. */
export interface Proposal {
  gameId: string
  charId: string
  text: string
}

/** A game she said yes to, and what the two of them put on it. */
export interface Agreed {
  gameId: string
  charId: string
  /** What is riding on the game, as the scene settled it; empty where nothing is. */
  stake: string
}

interface TableState {
  proposal: Proposal | null
  agreed: Agreed | null
  setProposal: (proposal: Proposal | null) => void
  setAgreed: (agreed: Agreed | null) => void
}

export const useTableStore = create<TableState>((set) => ({
  proposal: null,
  agreed: null,
  setProposal: (proposal) => set({ proposal }),
  setAgreed: (agreed) => set({ agreed })
}))
