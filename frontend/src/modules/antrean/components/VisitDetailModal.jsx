import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getPackages } from '@/modules/paket/api'
import { Alert, Badge, Button, Modal } from '@/shared/components/ui'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { formatDate, formatDateTime, formatRupiah } from '@/shared/utils/format'
import { getVisit } from '../api'
import { customerTypeLabel, queueLabel } from '../queue'
import EditSelectionForm from './EditSelectionForm'
import RenameForm from './RenameForm'
import VisitTimeline from './VisitTimeline'

const ACTIVE = ['RESERVASI', 'MENUNGGU', 'DIPANGGIL', 'SEDANG_DILAYANI', 'DILEWATI']
const EDITABLE = ['RESERVASI', 'MENUNGGU'] // paket/latar/jumlah orang hanya sebelum dipanggil

function Info({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </div>
  )
}

// Detail kunjungan (dibuka dari tombol "Detail" di Per Paket/Ringkasan).
// Admin: ubah paket/latar/jumlah orang, koreksi nama, batalkan. Owner: hanya melihat.
// Pasang dengan key = visitId. onChanged() memuat ulang papan; onCancelVisit(visit)
// menutup modal ini lalu membuka dialog alasan batal milik papan.
export default function VisitDetailModal({ visitId, isAdmin, onClose, onChanged, onCancelVisit }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [mode, setMode] = useState(null) // 'edit' | 'rename'
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    Promise.all([getVisit(visitId), getPackages()])
      .then(([visitDetail, packages]) => {
        setDetail(visitDetail)
        setCatalog({ packages: packages?.packages ?? [], backgrounds: packages?.backgrounds ?? [] })
      })
      .catch(setLoadError)
  }, [visitId])

  function saved(next, message) {
    setDetail(next)
    setMode(null)
    setNotice(message)
    onChanged?.()
  }

  let body
  if (loadError) {
    body = (
      <Alert variant="error" requestId={loadError.requestId}>
        Detail gagal dimuat. {loadError.message}
      </Alert>
    )
  } else if (!detail || !catalog) {
    body = <p className="text-sm text-slate-500">Memuat detail…</p>
  } else {
    const { visit, transaction, balance, events } = detail
    const pkg = catalog.packages.find((item) => item.id === visit.package_id)
    const background = catalog.backgrounds.find((item) => item.id === visit.background_id)?.name ?? transaction.background_snapshot
    const active = ACTIVE.includes(visit.status)
    const unallocated = transaction.price_type_snapshot === null

    body = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-slate-800">{visit.customer_name}</p>
          <Badge tone={VISIT_STATUS_TONES[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
          {queueLabel(visit) && <Badge tone="gray">{queueLabel(visit)}</Badge>}
        </div>
        {notice && <Alert variant="success">{notice}</Alert>}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Info label="Jenis">{customerTypeLabel(visit)}</Info>
          <Info label="Tanggal layanan">{formatDate(visit.service_date)}</Info>
          {visit.appointment_at && <Info label="Jam janji">{formatDateTime(visit.appointment_at)} WIB</Info>}
          <Info label="Paket">{pkg ? `${pkg.name} (${pkg.queue_code})` : 'Belum dipilih'}</Info>
          <Info label="Latar">{background ?? '-'}</Info>
          <Info label="Jumlah orang">{visit.persons ? `${visit.persons} orang` : '-'}</Info>
          <Info label="No. transaksi">{transaction.transaction_no}</Info>
          {visit.cancel_reason && <Info label="Alasan batal">{visit.cancel_reason}</Info>}
          {visit.note && <Info label="Catatan">{visit.note}</Info>}
        </dl>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <span>
            Total <strong>{unallocated ? '-' : formatRupiah(transaction.total)}</strong>
          </span>
          <span>
            Sudah dibayar <strong className="text-emerald-700">{formatRupiah(balance.net)}</strong>
          </span>
          {!unallocated && balance.due > 0 && (
            <span>
              Sisa <strong className="text-amber-700">{formatRupiah(balance.due)}</strong>
            </span>
          )}
          <Badge tone={PAYMENT_STATUS_TONES[transaction.payment_status] ?? 'gray'}>
            {PAYMENT_STATUS_LABELS[transaction.payment_status] ?? transaction.payment_status}
          </Badge>
        </div>

        {isAdmin && active && mode === null && (
          <div className="flex flex-wrap gap-2">
            {EDITABLE.includes(visit.status) && (
              <Button size="sm" variant="soft" onClick={() => setMode('edit')}>
                {visit.package_id ? 'Ubah Paket/Latar/Jumlah Orang' : 'Lengkapi Paket'}
              </Button>
            )}
            <Button size="sm" variant="soft" onClick={() => setMode('rename')}>
              Koreksi Nama
            </Button>
            <Button size="sm" variant="neutral" onClick={() => navigate(`/kasir/${visit.id}`)}>
              Buka Kasir
            </Button>
            {visit.status !== 'SEDANG_DILAYANI' && (
              <Button size="sm" variant="danger" onClick={() => onCancelVisit(visit)}>
                Batalkan Kunjungan
              </Button>
            )}
          </div>
        )}
        {isAdmin && active && !EDITABLE.includes(visit.status) && mode === null && (
          <p className="-mt-3 text-xs text-slate-500">Paket, latar, dan jumlah orang hanya bisa diubah sebelum dipanggil.</p>
        )}

        {mode === 'edit' && (
          <EditSelectionForm
            detail={detail}
            catalog={catalog}
            onCancel={() => setMode(null)}
            onSaved={(next) => saved(next, 'Paket, latar, dan jumlah orang tersimpan. Tagihan sudah diperbarui.')}
          />
        )}
        {mode === 'rename' && (
          <RenameForm detail={detail} onCancel={() => setMode(null)} onSaved={(next) => saved(next, 'Nama panggilan dikoreksi dan tercatat di riwayat koreksi.')} />
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Riwayat Status</p>
          <VisitTimeline events={events} />
        </div>
      </div>
    )
  }

  return (
    <Modal open size="lg" title="Detail Kunjungan" onClose={onClose}>
      {body}
    </Modal>
  )
}
