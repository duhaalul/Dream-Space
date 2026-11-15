import { useState } from 'react'
import { Link } from 'react-router'
import { queueLabel } from '@/modules/antrean/queue'
import { Alert, Badge, Card } from '@/shared/components/ui'
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { formatRupiah, formatTime } from '@/shared/utils/format'
import { activeItems, itemLabel } from '../cashier'
import SessionAdjustments from './SessionAdjustments'

function Row({ label, value, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <span>{label}</span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  )
}

function statusTime(visit) {
  if (visit.status === 'SELESAI') return `Selesai ${formatTime(visit.finished_at)} WIB`
  if (visit.status === 'SEDANG_DILAYANI') return `Mulai foto ${formatTime(visit.started_at)} WIB`
  if (visit.status === 'DIPANGGIL') return `Dipanggil ${formatTime(visit.called_at)} WIB`
  if (visit.status === 'RESERVASI') return `Janji ${formatTime(visit.appointment_at)} WIB`
  return null
}

// Kolom "Rincian Tagihan" (desain 05_Kasir_Admin). Semua angka dari backend (detail.balance).
// Pasang dengan key = id kunjungan supaya pesan tidak terbawa ke pelanggan lain.
export default function BillDetails({ detail, catalog, onUpdated, onReload }) {
  const { visit, transaction, balance, payments, refunds } = detail
  const [adjustFeedback, setAdjustFeedback] = useState(null)
  const pkg = catalog.packages.find((item) => item.id === visit.package_id)
  const items = activeItems(detail)
  const queue = queueLabel(visit)
  const onlyDp = payments.length > 0 && payments.every((payment) => payment.payment_type === 'DP')
  const unallocated = transaction.price_type_snapshot === null

  return (
    <Card
      title={`Rincian Tagihan: ${visit.customer_name}${queue ? ` (${queue})` : ''}`}
      description={[pkg ? `Paket ${pkg.name}` : 'Paket belum dipilih', statusTime(visit)].filter(Boolean).join(' · ')}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={VISIT_STATUS_TONES[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
        <span className="text-xs text-slate-400">{transaction.transaction_no}</span>
        {['MENUNGGU', 'DIPANGGIL', 'DILEWATI'].includes(visit.status) && pkg && (
          <Link to={`/antrean?tab=paket&paket=${pkg.queue_code}`} className="text-xs font-semibold text-brand-600 hover:underline">
            Lihat di Antrean →
          </Link>
        )}
      </div>

      <div className="space-y-2.5 border-t border-slate-100 pt-4 text-sm text-slate-700">
        {unallocated ? (
          <p className="text-slate-500">Paket belum dipilih. DP tercatat sebagai uang muka sampai paket ditentukan.</p>
        ) : (
          items.map((item) => <Row key={item.id} label={itemLabel(item, transaction)} value={formatRupiah(item.amount)} />)
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <Row label={<span className="font-bold text-slate-800">Total Tagihan</span>} value={<span className="text-lg text-brand-600">{formatRupiah(transaction.total)}</span>} />
        <Row className="text-emerald-700" label={onlyDp ? 'Sudah Dibayar (DP)' : 'Sudah Dibayar'} value={formatRupiah(-balance.paid)} />
        {balance.refunded > 0 && <Row className="text-slate-500" label="Sudah Dikembalikan" value={formatRupiah(balance.refunded)} />}
      </div>

      {!unallocated && visit.status !== 'DIBATALKAN' && (
        <div className="mt-4">
          {balance.due > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm text-amber-800">Sisa Tagihan yang Harus Dibayar:</p>
              <p className="text-2xl font-bold text-amber-800">{formatRupiah(balance.due)}</p>
            </div>
          ) : balance.surplus > 0 ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
              <p className="text-sm text-indigo-700">Kelebihan Bayar (perlu dikembalikan):</p>
              <p className="text-2xl font-bold text-indigo-700">{formatRupiah(balance.surplus)}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-sm text-emerald-800">Status Tagihan:</p>
              <p className="text-2xl font-bold text-emerald-800">Lunas</p>
            </div>
          )}
        </div>
      )}

      {visit.status === 'SEDANG_DILAYANI' && (
        <div className="mt-4 space-y-3">
          {adjustFeedback && (
            <Alert variant={adjustFeedback.variant} requestId={adjustFeedback.requestId}>
              {adjustFeedback.message}
            </Alert>
          )}
          <SessionAdjustments
            key={`${visit.version}-${transaction.version}`}
            detail={detail}
            catalog={catalog}
            onUpdated={onUpdated}
            onReload={onReload}
            onFeedback={setAdjustFeedback}
          />
        </div>
      )}

      {(payments.length > 0 || refunds.length > 0) && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Riwayat Pembayaran</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {payments.map((payment) => (
              <li key={`p-${payment.id}`} className="flex justify-between gap-3">
                <span>
                  {PAYMENT_TYPE_LABELS[payment.payment_type]} · {PAYMENT_METHOD_LABELS[payment.method]} · {formatTime(payment.paid_at)}
                  {Number(payment.change_amount) > 0 && ` · kembalian ${formatRupiah(payment.change_amount)}`}
                </span>
                <span className="shrink-0 font-semibold text-emerald-700">{formatRupiah(payment.amount)}</span>
              </li>
            ))}
            {refunds.map((refund) => (
              <li key={`r-${refund.id}`} className="flex justify-between gap-3">
                <span>Refund · {PAYMENT_METHOD_LABELS[refund.method]}</span>
                <span className="shrink-0 font-semibold text-slate-500">{formatRupiah(-refund.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
