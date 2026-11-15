import { useSearchParams } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import RoomAvailabilityToggle from '@/modules/paket/components/RoomAvailabilityToggle'
import { Alert } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import { formatDate, formatTime } from '@/shared/utils/format'
import { appointmentDue, backgroundNames, buildBoard, customerTypeLabel, ticketFor, visitMeta } from '../queue'
import { useQueueData } from '../useQueueData'
import { useVisitActions } from '../useVisitActions'
import { activePackages, nowWibTime } from '../visitForm'
import { ActionFeedback, EmptyNote, QueueLoading, RefreshButton, Section } from './BoardParts'
import PackageTiles from './PackageTiles'
import VisitActionButtons from './VisitActionButtons'
import VisitCard from './VisitCard'

const ATTENTION_ORDER = { SEDANG_DILAYANI: 0, DIPANGGIL: 1, DILEWATI: 2 }

// Tab "Ringkasan" di halaman Antrean (desain 02 bagian "State Antrean Admin"):
// hal yang perlu ditindak di semua paket sekaligus. Admin: tombol tindakan. Owner: hanya melihat.
// Tidak ada tombol "tutup antrean kemarin" sekaligus: sisa antrean dibatalkan satu per satu dengan alasan.
export default function QueueOverview() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const [, setSearchParams] = useSearchParams()
  const { data, error, reload } = useQueueData({ includePrevious: true })
  const actions = useVisitActions(reload)

  if (!data) return <QueueLoading error={error} onRetry={reload} />

  const rooms = buildBoard(data)
  const backgrounds = backgroundNames(data.backgrounds)
  const packages = new Map(data.packages.map((pkg) => [pkg.id, pkg]))
  const now = `${data.today} ${nowWibTime()}`
  const todays = data.visits.filter((visit) => visit.service_date === data.today)

  const attention = todays
    .filter((visit) => visit.status in ATTENTION_ORDER)
    .sort((a, b) => ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status])
  const reservations = todays
    .filter((visit) => visit.status === 'RESERVASI')
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at))
  const closedRooms = activePackages(data.packages).filter((pkg) => Number(pkg.is_open) !== 1)
  const previous = [...data.previous].sort((a, b) => a.service_date.localeCompare(b.service_date))

  const title = (visit) => `${visit.customer_name} (${customerTypeLabel(visit)})`
  const meta = (visit) =>
    [packages.get(visit.package_id)?.name ?? 'Paket belum dipilih', visitMeta(visit, backgrounds)].filter(Boolean).join(' · ')
  const buttons = (visit) => isAdmin && <VisitActionButtons visit={visit} actions={actions} call={{ isFirst: false, blocked: null }} />

  return (
    <div className="space-y-6">
      {previous.length > 0 && (
        <Alert variant="warning">
          <strong>
            Ada {previous.length} kunjungan dari hari sebelumnya yang belum ditutup.
          </strong>{' '}
          Selesaikan di Kasir bila sesinya sudah berjalan, atau batalkan satu per satu dengan alasan (daftar di bagian bawah).
        </Alert>
      )}

      <Section title="Kondisi Ruangan" hint="Klik paket untuk membuka papan antreannya." aside={<RefreshButton loadedAt={data.loadedAt} onClick={reload} />}>
        {rooms.length ? (
          <PackageTiles
            rooms={rooms}
            selectedId={null}
            onSelect={(pkg) => setSearchParams({ tab: 'paket', paket: pkg.queue_code })}
          />
        ) : (
          <EmptyNote>Belum ada paket aktif.</EmptyNote>
        )}
      </Section>

      <ActionFeedback actions={actions} />
      {error && <Alert variant="warning">Gagal memperbarui data ({error.message}). Yang tampil adalah data terakhir.</Alert>}

      <Section title={`Perlu Tindakan (${attention.length})`} hint="Pelanggan yang sedang dipanggil, sedang foto, atau dilewati hari ini.">
        {attention.length ? (
          <div className="space-y-4">
            {attention.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                ticket={ticketFor(visit)}
                title={title(visit)}
                meta={meta(visit)}
                note={visit.status === 'DILEWATI' ? 'Bila pelanggan kembali, klik Kembalikan untuk masuk antrean paling belakang.' : null}
                actions={buttons(visit)}
              />
            ))}
          </div>
        ) : (
          <EmptyNote>Tidak ada pelanggan yang sedang dipanggil, foto, atau dilewati.</EmptyNote>
        )}
      </Section>

      <Section title={`Reservasi Hari Ini (${reservations.length})`} hint="Belum datang. Tombol Sudah datang aktif mulai jam janji.">
        {reservations.length ? (
          <div className="space-y-4">
            {reservations.map((visit) => {
              let note = `Tombol Sudah datang aktif mulai pukul ${formatTime(visit.appointment_at)}.`
              if (!visit.package_id) note = 'Paket belum dipilih: lengkapi paket, latar, dan jumlah orang dulu sebelum Sudah datang.'
              else if (appointmentDue(visit, now)) note = 'Sudah lewat jam janji. Tekan Sudah datang bila pelanggan hadir.'
              return (
                <VisitCard key={visit.id} visit={visit} ticket={ticketFor(visit)} title={title(visit)} meta={meta(visit)} note={note} actions={buttons(visit)} />
              )
            })}
          </div>
        ) : (
          <EmptyNote>Tidak ada reservasi yang belum datang hari ini.</EmptyNote>
        )}
      </Section>

      {closedRooms.length > 0 && (
        <Section title="Ruangan Ditutup Sementara">
          <div className="space-y-4">
            {closedRooms.map((pkg) => (
              <article
                key={pkg.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-500 font-bold text-white">
                    {pkg.queue_code}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{pkg.name} · Ruangan Ditutup Sementara</p>
                    <p className="text-sm text-slate-500">{pkg.closed_reason ? `Alasan: ${pkg.closed_reason}` : 'Tanpa keterangan alasan.'}</p>
                  </div>
                </div>
                <RoomAvailabilityToggle packageId={pkg.id} packageName={pkg.name} isOpen={false} onChanged={reload} />
              </article>
            ))}
          </div>
        </Section>
      )}

      {previous.length > 0 && (
        <Section
          title={`Kunjungan Hari Sebelumnya yang Belum Ditutup (${previous.length})`}
          hint="Antrean hari lain tidak bisa dipanggil. Selesaikan di Kasir bila sesi sudah berjalan, atau batalkan dengan alasan."
        >
          <div className="space-y-4">
            {previous.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                ticket={ticketFor(visit)}
                title={title(visit)}
                meta={meta(visit)}
                note={`Tanggal layanan ${formatDate(visit.service_date)}.`}
                actions={buttons(visit)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
