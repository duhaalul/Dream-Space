import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { Alert, Button } from '@/shared/components/ui'
import { ROLES, VISIT_ACTIONS } from '@/shared/utils/constants'
import { formatTime } from '@/shared/utils/format'
import { appointmentDue, backgroundNames, buildBoard, customerTypeLabel, ticketFor, visitMeta } from '../queue'
import { useQueueData } from '../useQueueData'
import { useVisitActions } from '../useVisitActions'
import { nowWibTime } from '../visitForm'
import { ActionFeedback, EmptyNote, QueueLoading, RefreshButton, Section } from './BoardParts'
import PackageTiles from './PackageTiles'
import RoomBanner from './RoomBanner'
import VisitActionButtons from './VisitActionButtons'
import VisitCard from './VisitCard'
import VisitDetailModal from './VisitDetailModal'

// Tab "Per Paket" di halaman Antrean (desain 03_Antrean_Owner_dan_Admin).
// Admin: tombol tindakan sesuai status. Owner: hanya melihat.
export default function QueueBoard() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, error, reload } = useQueueData()
  const actions = useVisitActions(reload)
  const [detailId, setDetailId] = useState(null)

  if (!data) return <QueueLoading error={error} onRetry={reload} />

  const rooms = buildBoard(data)
  if (!rooms.length) return <EmptyNote>Belum ada paket aktif. Owner dapat menambah paket di menu Kelola Paket.</EmptyNote>

  const room = rooms.find((item) => item.pkg.queue_code === searchParams.get('paket')) ?? rooms[0]
  const backgrounds = backgroundNames(data.backgrounds)
  const now = `${data.today} ${nowWibTime()}`
  const callBlocked = !room.isOpen ? 'Ruangan sedang ditutup.' : room.inRoom ? 'Panggil aktif lagi setelah ruangan kosong.' : null
  const title = (visit) => `${visit.customer_name} (${customerTypeLabel(visit)})`
  // Admin: tombol tindakan + Detail. Owner: Detail saja (hanya melihat).
  const buttons = (visit, call) => (
    <>
      {isAdmin && <VisitActionButtons visit={visit} actions={actions} call={call} />}
      <Button size="sm" variant="ghost" onClick={() => setDetailId(visit.id)}>
        Detail
      </Button>
    </>
  )

  function selectPackage(pkg) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('paket', pkg.queue_code)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-6">
      <PackageTiles rooms={rooms} selectedId={room.pkg.id} onSelect={selectPackage} />
      <RoomBanner room={room} isAdmin={isAdmin} onChanged={reload} />

      <ActionFeedback actions={actions} />
      {error && <Alert variant="warning">Gagal memperbarui data ({error.message}). Yang tampil adalah data terakhir.</Alert>}

      <Section title="Sedang Dilayani di Ruangan" aside={<RefreshButton loadedAt={data.loadedAt} onClick={reload} />}>
        {room.inRoom ? (
          <VisitCard
            visit={room.inRoom}
            ticket={ticketFor(room.inRoom)}
            title={room.inRoom.customer_name}
            meta={visitMeta(room.inRoom, backgrounds)}
            note={room.inRoom.service_date !== data.today ? `Antrean tanggal ${room.inRoom.service_date} yang belum selesai.` : null}
            actions={buttons(room.inRoom)}
          />
        ) : (
          <EmptyNote>Ruangan kosong. {room.waiting.length ? 'Panggil pelanggan urutan berikutnya.' : ''}</EmptyNote>
        )}
      </Section>

      <Section title={`Urutan Menunggu (${room.waiting.length} Pelanggan)`} hint={isAdmin && room.waiting.length ? callBlocked : null}>
        {room.waiting.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {room.waiting.map((visit, index) => (
              <VisitCard
                key={visit.id}
                stacked
                visit={visit}
                ticket={ticketFor(visit, index)}
                title={title(visit)}
                meta={visitMeta(visit, backgrounds)}
                actions={buttons(visit, { isFirst: index === 0, blocked: callBlocked })}
              />
            ))}
          </div>
        ) : (
          <EmptyNote>Belum ada pelanggan menunggu di paket ini.</EmptyNote>
        )}
      </Section>

      <Section title="Pelanggan Dilewati & Reservasi Mendatang">
        {room.skipped.length + room.reservations.length ? (
          <div className="space-y-4">
            {room.skipped.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                ticket={ticketFor(visit)}
                title={title(visit)}
                meta={visitMeta(visit, backgrounds)}
                note="Bila pelanggan kembali, klik Kembalikan untuk masuk antrean paling belakang."
                actions={buttons(visit)}
              />
            ))}
            {room.reservations.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                ticket={ticketFor(visit)}
                title={title(visit)}
                meta={visitMeta(visit, backgrounds)}
                note={
                  appointmentDue(visit, now)
                    ? 'Sudah lewat jam janji. Tekan Sudah datang bila pelanggan hadir.'
                    : `Tombol Sudah datang aktif mulai pukul ${formatTime(visit.appointment_at)}.`
                }
                actions={buttons(visit)}
              />
            ))}
          </div>
        ) : (
          <EmptyNote>Tidak ada pelanggan dilewati atau reservasi hari ini untuk paket ini.</EmptyNote>
        )}
      </Section>

      {detailId && (
        <VisitDetailModal
          key={detailId}
          visitId={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onChanged={reload}
          onCancelVisit={(visit) => {
            setDetailId(null)
            actions.ask(visit, VISIT_ACTIONS.CANCEL)
          }}
        />
      )}
    </div>
  )
}
