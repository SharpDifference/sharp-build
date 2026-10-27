// The packs mod loads its own packs from the folder under it.
const packs = import.meta.glob('./packs/*.ts', { eager: true })

export const catalog = Object.keys(packs)
