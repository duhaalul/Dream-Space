import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Info } from 'lucide-react'
import { useAuth } from '@/modules/akun/useAuth'
import { Alert, Button } from '@/shared/components/ui'
import { ROLES, VISIT_ACTIONS } from '@/shared/utils/constants'
import { todayWib } from '@/shared/utils/format'
import { backgroundNames, buildBoard, ticketFor, visitMeta } from '../queue'
import { useOverdueReservations, useQueueData, useReservations } from '../useQueueData'
import { useVisitActions } from '../useVisitActions'
import { ActionFeedback, EmptyNote, QueueLoading, RefreshButton, Section } from './BoardParts'
import CheckInModal from './CheckInModal'
import PackageTiles from './PackageTiles'
import ReservationEditModal from './ReservationEditModal'
import ReservationSection from './ReservationSection'
import RoomBanner from './RoomBanner'
import VisitActionButtons from './VisitActionButtons'
import VisitCard from './VisitCard'
import VisitDetailModal from './VisitDetailModal'

// Halaman Antrean (desain 03_Antrean): papan per paket (Di Ruangan, Menunggu, Dilewati),
// lalu bagian Reservasi (semua paket, per tanggal). Admin: tombol tindakan. Owner: hanya melihat.
export default function QueueBoard() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, error, reload } = useQueueData()
  const [reservationDate, setReservationDate] = useState(todayWib)
  const reservations = useReservations(reservationDate)
  const overdue = useOverdueReservations()
  const [showOverdue, setShowOverdue] = useState(false)
  const reloadReservations = () => {
    reservations.reload()
    overdue.reload()
  }
  const reloadAll = () => {
    reload()
    reloadReservations()
  }
  const actions = useVisitActions(reloadAll)
  const [detailId, setDetailId] = useState(null)
  const [checkInId, setCheckInId] = useState(null)
  const [editingId, setEditingId] = useState(null)

  if (!data) return <QueueLoading error={error} onRetry={reload} />

  const rooms = buildBoard(data)
  if (!rooms.length) return <EmptyNote>Belum ada paket aktif.</EmptyNote>

  const room = rooms.find((item) => item.pkg.queue_code === searchParams.get('paket')) ?? rooms[0]
  const backgrounds = backgroundNames(data.backgrounds)
  const callBlocked = !room.isOpen ? 'Ruangan ditutup.' : room.inRoom ? 'Ruangan masih dipakai.' : null
  // Admin: tombol tindakan + Detail. Owner: Detail saja.
  const buttons = (visit, call) => (
    <>
      {isAdmin && <VisitActionButtons visit={visit} actions={actions} call={call} />}
      <Button size="sm" variant="ghost" onClick={() => setDetailId(visit.id)}>
        <Info aria-hidden="true" className="h-3.5 w-3.5" /> Detail
      </Button>
    </>
  )
  const card = (visit, props = {}) => (
    <VisitCard
      key={visit.id}
      visit={visit}
      ticket={ticketFor(visit, props.index ?? null)}
      title={visit.customer_name}
      meta={visitMeta(visit, backgrounds)}
      stacked={props.stacked}
      actions={buttons(visit, props.call)}
    />
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
      {error && <Alert variant="warning">Gagal memperbarui data ({error.message}).</Alert>}

      <Section title="Di Ruangan" aside={<RefreshButton loadedAt={data.loadedAt} onClick={reloadAll} />}>
        {room.inRoom ? card(room.inRoom) : <EmptyNote>Ruangan kosong.</EmptyNote>}
      </Section>

      <Section title={`Menunggu (${room.waiting.length})`} hint={isAdmin && room.waiting.length ? callBlocked : null}>
        {room.waiting.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {room.waiting.map((visit, index) => card(visit, { index, stacked: true, call: { blocked: callBlocked } }))}
          </div>
        ) : (
          <EmptyNote>Tidak ada yang menunggu.</EmptyNote>
        )}
      </Section>

      {room.skipped.length > 0 && (
        <Section title={`Dilewati (${room.skipped.length})`}>
          <div className="space-y-4">{room.skipped.map((visit) => card(visit))}</div>
        </Section>
      )}

      <ReservationSection
        date={reservationDate}
        onDateChange={(next) => {
          setReservationDate(next)
          setShowOverdue(false)
        }}
        data={reservations.data}
        error={reservations.error}
        overdue={overdue.data}
        showOverdue={showOverdue}
        onToggleOverdue={() => setShowOverdue((shown) => !shown)}
        packages={data.packages}
        isAdmin={isAdmin}
        busy={actions.busyId !== null}
        onCheckIn={(visit) => setCheckInId(visit.id)}
        onCancel={(visit) => actions.ask(visit, VISIT_ACTIONS.CANCEL)}
        onDetail={setDetailId}
      />

      {detailId && (
        <VisitDetailModal
          key={detailId}
          visitId={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onCancelVisit={(visit) => {
            setDetailId(null)
            actions.ask(visit, VISIT_ACTIONS.CANCEL)
          }}
          onEditReservation={(visit) => {
            setDetailId(null)
            setEditingId(visit.id)
          }}
        />
      )}

      {checkInId && <CheckInModal key={checkInId} visitId={checkInId} onClose={() => setCheckInId(null)} onDone={reloadAll} />}

      {editingId && (
        <ReservationEditModal
          key={editingId}
          visitId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null)
            reloadReservations()
          }}
        />
      )}
    </div>
  )
}
