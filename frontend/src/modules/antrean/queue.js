// Logika papan antrean (tanpa komponen). Urutan pelanggan TIDAK dihitung di sini:
// GET /visits sudah mengurutkan (prioritas reservasi, jam janji, waktu masuk, id).
import { formatTime } from '@/shared/utils/format'
import { activePackages } from './visitForm'

export const ROOM_STATUSES = ['DIPANGGIL', 'SEDANG_DILAYANI']

// RG + 4 → "RG-004"
export function formatQueueNumber(code, number) {
  if (!code || number == null) return null
  return `${code}-${String(number).padStart(3, '0')}`
}

export function queueLabel(visit) {
  return formatQueueNumber(visit.queue_code_snapshot, visit.queue_number)
}

// Data per paket aktif: ruangan, pelanggan di ruangan, menunggu, dilewati, reservasi hari ini.
export function buildBoard({ packages, visits, today }) {
  return activePackages(packages).map((pkg) => {
    const own = visits.filter((visit) => visit.package_id === pkg.id)
    const todays = (status) => own.filter((visit) => visit.status === status && visit.service_date === today)
    return {
      pkg,
      isOpen: Number(pkg.is_open) === 1,
      // Dipanggil/sedang foto bisa berasal dari hari sebelumnya (dari GET /queue/rooms).
      inRoom: own.find((visit) => ROOM_STATUSES.includes(visit.status)) ?? null,
      waiting: todays('MENUNGGU'),
      skipped: todays('DILEWATI'),
      reservations: todays('RESERVASI'),
    }
  })
}

export function backgroundNames(backgrounds = []) {
  return new Map(backgrounds.map((background) => [background.id, background.name]))
}

export function customerTypeLabel(visit) {
  return visit.customer_type === 'RESERVASI' ? 'Reservasi WhatsApp' : 'Datang Langsung'
}

// "3 orang · Latar Putih · Sesi mulai 10.12 WIB"
export function visitMeta(visit, backgrounds) {
  const parts = []
  if (visit.persons) parts.push(`${visit.persons} orang`)
  const background = backgrounds.get(visit.background_id)
  if (background) parts.push(`Latar ${background}`)
  if (visit.status === 'SEDANG_DILAYANI' && visit.started_at) parts.push(`Sesi mulai ${formatTime(visit.started_at)} WIB`)
  else if (visit.status === 'DIPANGGIL' && visit.called_at) parts.push(`Dipanggil ${formatTime(visit.called_at)} WIB`)
  else if (visit.status === 'DILEWATI') parts.push(`Dilewati pukul ${formatTime(visit.updated_at)} WIB`)
  else if (visit.appointment_at) parts.push(`Janji ${formatTime(visit.appointment_at)} WIB`)
  else if (visit.queue_entered_at) parts.push(`Masuk ${formatTime(visit.queue_entered_at)} WIB`)
  return parts.join(' · ')
}

// Kotak nomor antrean di VisitCard. waitingIndex diisi di papan Per Paket (Urutan #n).
export function ticketFor(visit, waitingIndex = null) {
  const code = queueLabel(visit)
  switch (visit.status) {
    case 'SEDANG_DILAYANI':
      return { code, caption: 'Sedang Foto', tone: 'serving' }
    case 'DIPANGGIL':
      return { code, caption: 'Dipanggil', tone: 'called' }
    case 'DILEWATI':
      return { code, caption: 'Dilewati', tone: 'muted' }
    case 'RESERVASI':
      return { code: formatTime(visit.appointment_at), caption: 'Reservasi', tone: 'reservation' }
    default:
      if (Number(visit.has_priority) === 1) return { code, caption: 'Prioritas', tone: 'priority' }
      return { code, caption: waitingIndex === null ? 'Menunggu' : `Urutan #${waitingIndex + 1}`, tone: 'normal' }
  }
}

// Reservasi baru boleh "Sudah datang" mulai jam janji (backend: APPOINTMENT_NOT_DUE).
export function appointmentDue(visit, nowWib) {
  return !!visit.appointment_at && visit.appointment_at.slice(0, 16) <= nowWib
}
