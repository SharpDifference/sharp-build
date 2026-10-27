// Another mod's file in the same folder, and one that reaches into the packs it does not require.
const packs = import.meta.glob('./packs/*.ts', { eager: true })

export const neighbour = Object.keys(packs).length
