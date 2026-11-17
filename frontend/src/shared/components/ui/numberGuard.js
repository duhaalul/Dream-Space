// Kolom angka (type="number") bawaan browser menerima "e", "+", "-", "." karena sah untuk notasi ilmiah
// (mis. 1e5 = 100000). Semua isian angka di aplikasi ini bilangan bulat ≥ 0 (Rupiah, orang, menit, jumlah),
// jadi tombol itu diblokir dan tempelan yang bukan angka ditolak.
// Input memasangnya otomatis untuk type="number"; kolom <input> mentah: <input type="number" {...numberGuard()} />.
const BLOCKED_KEYS = new Set(['e', 'E', '+', '-', '.', ','])

export function numberGuard({ onKeyDown, onPaste } = {}) {
  return {
    onKeyDown: (event) => {
      if (BLOCKED_KEYS.has(event.key)) event.preventDefault()
      onKeyDown?.(event)
    },
    onPaste: (event) => {
      if (!/^\d+$/.test(event.clipboardData.getData('text').trim())) event.preventDefault()
      onPaste?.(event)
    },
  }
}
