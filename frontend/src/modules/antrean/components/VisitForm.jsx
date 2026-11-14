import { TodoCard } from '@/shared/components/ui'

// Tab "Pendaftaran" di halaman Antrean (T-04), Admin saja.
export default function VisitForm() {
  return (
    <TodoCard
      title="Pendaftaran datang langsung & reservasi WhatsApp"
      items={[
        'Datang langsung (WALK_IN): nama panggilan, paket, latar, jumlah orang → langsung masuk antrean.',
        'Reservasi WhatsApp (RESERVASI): nama panggilan, tanggal & jam janji, paket/latar/jumlah orang bila sudah dipilih.',
        'DP opsional: cukup nominal + metode (Tunai/Transfer/QRIS) dan referensi untuk nontunai. Tanpa gambar QRIS, nomor rekening, atau unggah bukti.',
        'Tanpa kolom nomor telepon (NFR-07).',
        'Simpan dengan createVisit(); client_request_id dari newRequestId() sekali per pengisian, pakai ulang saat retry.',
      ]}
    />
  )
}
