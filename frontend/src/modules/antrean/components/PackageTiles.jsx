import SessionTimer from './SessionTimer'

// Deretan kartu paket di atas papan (desain: RG Reguler · Dipakai, WD · Kosong, PB · Ditutup).
// rooms: hasil buildBoard(); selectedId: id paket terpilih.
function roomState(room) {
  if (!room.isOpen) return { label: 'Ditutup', tone: 'closed' }
  if (room.inRoom?.status === 'SEDANG_DILAYANI') return { label: 'Dipakai', tone: 'busy' }
  if (room.inRoom) return { label: 'Dipanggil', tone: 'busy' }
  return { label: 'Kosong', tone: 'free' }
}

const STATE_PILL = {
  closed: 'bg-red-100 text-red-700',
  busy: 'bg-amber-100 text-amber-800',
  free: 'bg-brand-50 text-brand-600',
}

export default function PackageTiles({ rooms, selectedId, onSelect }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pilih paket">
      {rooms.map((room) => {
        const selected = room.pkg.id === selectedId
        const state = roomState(room)
        const summary = [
          room.inRoom?.status === 'SEDANG_DILAYANI' ? '1 foto' : null,
          `${room.waiting.length} antre`,
        ]
          .filter(Boolean)
          .join(' · ')
        let tileClass = 'border-brand-100 bg-white text-slate-800 hover:border-brand-300'
        if (selected) tileClass = 'border-transparent bg-linear-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25'
        else if (!room.isOpen) tileClass = 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'

        return (
          <button
            key={room.pkg.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(room.pkg)}
            className={`min-w-40 flex-1 rounded-2xl border p-4 text-left transition ${tileClass}`}
          >
            <p className={`text-2xl font-black ${selected || !room.isOpen ? '' : 'text-brand-500'}`}>{room.pkg.queue_code}</p>
            <p className="mt-0.5 truncate text-sm font-semibold">{room.pkg.name}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`flex min-w-0 items-center gap-1.5 text-xs ${selected ? 'text-white/80' : 'text-slate-500'}`}>
                {summary}
                {room.inRoom && <SessionTimer visit={room.inRoom} className="px-2" />}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                  selected ? 'bg-white text-brand-600' : STATE_PILL[state.tone]
                }`}
              >
                {state.label}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
