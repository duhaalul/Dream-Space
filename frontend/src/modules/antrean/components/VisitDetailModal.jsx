import { Modal, TodoCard } from '@/shared/components/ui'

// Detail kunjungan dalam modal, dibuka dari tab Ringkasan/Per Paket.
// Props yang disarankan: { visitId, open, onClose, onChanged }
export default function VisitDetailModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Detail kunjungan">
      <TodoCard
        title="Detail, ubah, dan batalkan"
        items={[
          'Ambil data dengan getVisit(visitId); simpan visit.version.',
          'Ubah paket, latar, atau jumlah orang sebelum dipanggil: updateVisitSelection() (endpoint ini tidak mengubah nama).',
          'Salah ketik nama panggilan: koreksi lewat addCorrection(transactionId, { version, reason, customer_name }) dari modul kasir.',
          'Batalkan sebelum foto dengan alasan: runVisitAction({ action: CANCEL }); uang tidak dikembalikan.',
          'Riwayat status dari events.',
        ]}
      />
    </Modal>
  )
}
