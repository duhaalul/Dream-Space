import { useState } from 'react'
import { VISIT_ACTIONS } from '@/shared/utils/constants'
import { runVisitAction } from './api'
import { queueLabel } from './queue'

const nameOf = (visit) => {
  const queue = queueLabel(visit)
  return queue ? `${visit.customer_name} (${queue})` : visit.customer_name
}

const SUCCESS = {
  CONFIRM: (visit) => `${visit.customer_name} sudah datang dan masuk antrean.`,
  CALL: (visit) => `${nameOf(visit)} dipanggil.`,
  START: (visit) => `Sesi foto ${nameOf(visit)} dimulai.`,
  SKIP: (visit) => `${nameOf(visit)} dilewati.`,
  RETURN: (visit) => `${visit.customer_name} kembali ke antrean paling belakang.`,
  CANCEL: (visit) => `Kunjungan ${nameOf(visit)} dibatalkan.`,
}

// Isi dialog alasan untuk tindakan yang wajib alasan (backend: REASON_REQUIRED / OUT_OF_ORDER_REASON).
function reasonDialog(visit, action) {
  const name = nameOf(visit)
  const configs = {
    CALL: {
      title: `Panggil ${name} di luar urutan`,
      description: 'Pelanggan ini bukan urutan berikutnya. Tulis alasannya, misalnya pelanggan sebelumnya belum ada di studio.',
      confirmLabel: 'Panggil',
      variant: 'warning',
      placeholder: 'Mis. urutan sebelumnya belum datang',
    },
    SKIP: {
      title: `Lewati ${name}`,
      description: 'Pelanggan pindah ke daftar Dilewati. Bila kembali, bisa dikembalikan ke antrean paling belakang.',
      confirmLabel: 'Lewati',
      variant: 'neutral',
      placeholder: 'Mis. tidak ada di studio saat dipanggil',
    },
    RETURN: {
      title: `Kembalikan ${name} ke antrean`,
      description: 'Pelanggan masuk antrean paling belakang dan kehilangan prioritas reservasi.',
      confirmLabel: 'Kembalikan',
      variant: 'primary',
      placeholder: 'Mis. pelanggan sudah kembali ke studio',
    },
    CANCEL: {
      title: `Batalkan kunjungan ${name}`,
      description: 'Hanya bisa sebelum foto dimulai. Uang yang sudah dibayar (termasuk DP) tidak dikembalikan.',
      confirmLabel: 'Batalkan Kunjungan',
      variant: 'danger',
      placeholder: 'Mis. pelanggan membatalkan lewat WhatsApp',
    },
  }
  return { visit, action, ...configs[action] }
}

function errorNotice(error, visit) {
  if (error?.code === 'PAYMENT_REQUIRED_BEFORE_START') {
    return { variant: 'warning', message: `${error.message}. Selesaikan pembayaran ${nameOf(visit)} di Kasir.`, kasirVisitId: visit.id }
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
export function useVisitActions(reload) {
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null) // { variant, message, kasirVisitId?, requestId? }
  const [dialog, setDialog] = useState(null)

  async function run(visit, action, { reason, priority } = {}) {
    setBusyId(visit.id)
    setNotice(null)
    try {
      await runVisitAction(visit.id, {
        version: visit.version,
        action,
        ...(reason ? { reason } : {}),
        ...(priority !== undefined ? { priority } : {}),
      })
      setDialog(null)
      setNotice({ variant: 'success', message: SUCCESS[action](visit) })
    } catch (error) {
      if (error?.code === 'OUT_OF_ORDER_REASON' && !reason) {
        setDialog(reasonDialog(visit, VISIT_ACTIONS.CALL))
      } else {
        setDialog(null)
        setNotice(errorNotice(error, visit))
      }
    } finally {
      setBusyId(null)
      reload()
    }
  }

  // Buka dialog alasan (Lewati, Kembalikan, Batalkan, Panggil di luar urutan).
  function ask(visit, action) {
    setNotice(null)
    setDialog(reasonDialog(visit, action))
  }

  return { run, ask, busyId, notice, clearNotice: () => setNotice(null), dialog, closeDialog: () => setDialog(null) }
}
