import { useState } from 'react'
import { runVisitAction } from './api'
import { queueLabel } from './queue'

const nameOf = (visit) => {
  const queue = queueLabel(visit)
  return queue ? `${visit.customer_name} (${queue})` : visit.customer_name
}

const SUCCESS = {
  CALL: (visit) => `${nameOf(visit)} dipanggil.`,
  START: (visit) => `Sesi foto ${nameOf(visit)} dimulai.`,
  SKIP: (visit) => `${nameOf(visit)} dilewati.`,
  RETURN: (visit) => `${visit.customer_name} kembali ke antrean paling belakang.`,
  CANCEL: (visit) => `${nameOf(visit)} dibatalkan.`,
  FINISH: (visit) => `Sesi ${nameOf(visit)} selesai.`,
}

// Isi dialog alasan (backend: REASON_REQUIRED). Teks dibuat singkat.
// Memanggil di luar urutan tidak perlu alasan: siapa yang dipanggil diputuskan Admin.
function reasonDialog(visit, action) {
  const name = nameOf(visit)
  const configs = {
    SKIP: {
      title: `Lewati ${name}`,
      description: null,
      confirmLabel: 'Lewati',
      variant: 'neutral',
      placeholder: 'Mis. tidak ada di studio',
    },
    RETURN: {
      title: `Kembalikan ${name}`,
      description: 'Masuk antrean paling belakang.',
      confirmLabel: 'Kembalikan',
      variant: 'primary',
      placeholder: 'Mis. sudah kembali ke studio',
    },
    CANCEL: {
      title: `Batalkan ${name}`,
      description: visit.status === 'RESERVASI' ? 'DP/pembayaran tidak dikembalikan.' : 'Uang yang sudah dibayar tidak dikembalikan.',
      confirmLabel: 'Batalkan',
      variant: 'danger',
      placeholder: 'Mis. pelanggan tidak jadi',
    },
  }
  return { visit, action, ...configs[action] }
}

function errorNotice(error, visit) {
  if (error?.code === 'PAYMENT_REQUIRED_BEFORE_START') {
    return { variant: 'warning', message: `${nameOf(visit)}: ${error.message}.` }
  }
  if (error?.code === 'STALE_VERSION') {
    return {
      variant: 'warning',
      message: `Data ${nameOf(visit)} baru saja berubah di komputer lain. Tampilan sudah dimuat ulang; periksa lagi sebelum mengulang.`,
    }
  }
  if (error?.code === 'NETWORK_ERROR') {
    return { variant: 'error', message: 'Koneksi ke server terputus. Tampilan dimuat ulang; periksa status pelanggan sebelum mengulang.' }
  }
  return { variant: 'error', message: error?.message ?? 'Tindakan gagal.', requestId: error?.requestId }
}

// Menjalankan tombol tindakan kunjungan. Selalu mengirim visit.version terbaru;
// setelah berhasil atau gagal, data dimuat ulang (STALE_VERSION tidak dikirim ulang otomatis).
// Dipancarkan setelah tindakan berhasil, supaya notifikasi waktu habis langsung diperbarui.
export const QUEUE_CHANGED_EVENT = 'dreamspace:queue-changed'

export function useVisitActions(reload) {
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null) // { variant, message, kasirVisitId?, requestId? }
  const [dialog, setDialog] = useState(null)

  async function run(visit, action, { reason } = {}) {
    setBusyId(visit.id)
    setNotice(null)
    try {
      await runVisitAction(visit.id, { version: visit.version, action, ...(reason ? { reason } : {}) })
      setDialog(null)
      setNotice({ variant: 'success', message: SUCCESS[action](visit) })
      window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT))
    } catch (error) {
      setDialog(null)
      setNotice(errorNotice(error, visit))
    } finally {
      setBusyId(null)
      reload()
    }
  }

  // Buka dialog alasan (Lewati, Kembalikan, Batalkan).
  function ask(visit, action) {
    setNotice(null)
    setDialog(reasonDialog(visit, action))
  }

  return { run, ask, busyId, notice, clearNotice: () => setNotice(null), dialog, closeDialog: () => setDialog(null) }
}
