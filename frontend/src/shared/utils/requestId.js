// Buat SATU id per tindakan (pendaftaran, pembayaran, refund) lalu simpan
// bersama payload-nya. Saat retry karena timeout, kirim ulang id yang sama
// supaya backend tidak mencatat dua kali (NFR-02, docs/API.md).
export function newRequestId() {
  return crypto.randomUUID()
}
