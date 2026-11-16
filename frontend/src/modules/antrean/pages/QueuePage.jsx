import { PageHeader } from '@/shared/components/ui'
import QueueBoard from '../components/QueueBoard'

// T-03 Antrean — satu halaman per paket (pendaftaran & pembayaran ada di menu Pendaftaran).
// Admin menjalankan tindakan, Owner hanya melihat. Paket terpilih disimpan di URL (?paket=RG).
export default function QueuePage() {
  return (
    <>
      <PageHeader title="Antrean" code="T-03" />
      <QueueBoard />
    </>
  )
}
