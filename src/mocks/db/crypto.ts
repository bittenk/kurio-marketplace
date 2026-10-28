const SALT = 'kurio::'

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + password)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
