// Aturan kata sandi sama dengan backend: minimal 12 karakter, maksimal 72 byte UTF-8 (NFR-08).
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_BYTES = 72

// Mengembalikan pesan error, atau null bila valid.
export function validateNewPassword(password, confirmation) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'Kata sandi terlalu panjang. Kurangi jumlah karakternya.'
  }
  if (password !== confirmation) return 'Konfirmasi kata sandi tidak sama.'
  return null
}
