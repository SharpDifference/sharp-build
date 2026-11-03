/** Setup happens inside the entry function so the loader owns its failure. */
export function throwingEntry(): never {
  throw new Error('built-in fixture threw during setup')
}
