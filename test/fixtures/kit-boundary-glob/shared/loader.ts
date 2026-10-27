// The packs mod loads every entry in a folder that also holds another mod's.
const entries = import.meta.glob('./entries/*.ts', { eager: true })

export const loaded = Object.keys(entries)
