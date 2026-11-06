import { safeStorage } from 'electron'

/** Encrypts one secret for disk: empty writes neither field, no keyring writes plaintext. */
export function encryptSecret(plain: string): { enc?: string; plain?: string } {
  if (!plain) return {}
  if (!safeStorage.isEncryptionAvailable()) return { plain }
  return { enc: safeStorage.encryptString(plain).toString('base64') }
}

/** Decrypts one secret off disk, preferring the blob; one DPAPI refuses reads as unset. */
export function decryptSecret(enc: string | undefined, plain: string | undefined, field: string): string {
  if (enc) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch (err) {
      console.warn(
        `${field} could not be decrypted; treating it as unset.`,
        err
      )
      return ''
    }
  }
  return plain ?? ''
}
